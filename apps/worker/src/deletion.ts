// Deleting a project (docs/database.md, "Deleting a project"): apart from the costs and statistics, as if it had never existed. Its row,
// and the stages and LLM calls no project that isn't deleted uses (in its pipeline, or named by its outputs), are kept for the costs, marked with a deletion
// time that every cache lookup ignores; everything else of it that nothing else uses is deleted: the outputs (rows
// and content), the full requests and responses of its calls, its PDF and the PDF's fingerprints. Content in R2 is
// deleted by collecting what no row refers to any more, which also collects the orphans other changes leave behind.

import type { Hono } from "hono";
import type { Deleted, Freed } from "@score3ly/core";
import { anyRunning } from "./pipelineRules.ts";
import { collectOrphans, ORPHAN_MIN_AGE_MS } from "./storage.ts";

// The outputs of marked stages that nothing that isn't marked still uses: no stage that isn't marked read them, no
// output of one was made from them or corrects them.
const UNUSED_OUTPUTS = `
  SELECT o.id FROM outputs o JOIN stages s ON s.id = o.stage_id
  WHERE s.deleted_at IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM stage_inputs si JOIN stages s2 ON s2.id = si.stage_id WHERE si.output_id = o.id AND s2.deleted_at IS NULL)
    AND NOT EXISTS (SELECT 1 FROM output_inputs oi JOIN outputs o2 ON o2.id = oi.output_id JOIN stages s3 ON s3.id = o2.stage_id WHERE oi.input_id = o.id AND s3.deleted_at IS NULL)
    AND NOT EXISTS (SELECT 1 FROM outputs o4 JOIN stages s4 ON s4.id = o4.stage_id WHERE o4.parent_output_id = o.id AND s4.deleted_at IS NULL)`;

// The calls a stage that isn't marked uses but doesn't own: those it was served from the record (its rows'
// `served_from`, the code review's E4), and those an output of it names (a project run before served calls had rows).
const LIVE_CALLS = `SELECT sc.served_from FROM llm_calls sc JOIN stages s ON s.id = sc.stage_id WHERE sc.served_from IS NOT NULL AND s.deleted_at IS NULL
  UNION SELECT o.call_id FROM outputs o JOIN stages s ON s.id = o.stage_id WHERE o.call_id IS NOT NULL AND s.deleted_at IS NULL`;


export async function deleteProject(env: Env, projectId: string, now = new Date()): Promise<Deleted | "not_found" | "running"> {
  const db = env.DB;
  const project = await db.prepare("SELECT pdf_sha256 FROM projects WHERE id = ? AND deleted_at IS NULL").bind(projectId).first<{ pdf_sha256: string }>();
  if (!project) return "not_found";
  if (await anyRunning(db, projectId, now.getTime())) return "running";
  const iso = now.toISOString();
  const pdf = project.pdf_sha256;
  await db.batch([
    db.prepare("UPDATE projects SET deleted_at = ? WHERE id = ?").bind(iso, projectId),
    db.prepare("DELETE FROM dropped_stages WHERE project_id = ?").bind(projectId),
    // A stage is marked if it was created in a deleted project and no project that isn't deleted has it in its
    // pipeline (a fork's stays until the fork is deleted).
    db
      .prepare(
        "UPDATE stages SET deleted_at = ? WHERE deleted_at IS NULL AND created_in IN (SELECT id FROM projects WHERE deleted_at IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM pipeline_entries e JOIN projects p ON p.id = e.project_id WHERE e.stage_id = stages.id AND p.deleted_at IS NULL)",
      )
      .bind(iso),
    // A call is marked when its stage is and no stage that isn't marked uses it (served from the cache to another
    // project, which still has a row served from it): what a live project uses stays alive, and keeps serving the cache.
    db.prepare(`UPDATE llm_calls SET deleted_at = ? WHERE deleted_at IS NULL AND stage_id IN (SELECT id FROM stages WHERE deleted_at IS NOT NULL) AND id NOT IN (${LIVE_CALLS})`).bind(iso),
    // The outputs nothing uses go, with what refers to them from marked stages.
    db.prepare(`DELETE FROM output_inputs WHERE output_id IN (${UNUSED_OUTPUTS}) OR input_id IN (${UNUSED_OUTPUTS})`),
    db.prepare("DELETE FROM stage_inputs WHERE stage_id IN (SELECT id FROM stages WHERE deleted_at IS NOT NULL)"),
    db.prepare(`UPDATE outputs SET parent_output_id = NULL WHERE parent_output_id IN (${UNUSED_OUTPUTS})`),
    db.prepare(`DELETE FROM outputs WHERE id IN (${UNUSED_OUTPUTS})`),
    db
      .prepare("DELETE FROM image_fingerprints WHERE pdf_sha256 = ? AND NOT EXISTS (SELECT 1 FROM projects WHERE pdf_sha256 = ? AND deleted_at IS NULL)")
      .bind(pdf, pdf),
  ]);
  await collectOrphans(env, new Date(now.getTime() - ORPHAN_MIN_AGE_MS));
  const used = await db.prepare("SELECT 1 FROM projects WHERE pdf_sha256 = ? AND deleted_at IS NULL LIMIT 1").bind(pdf).first();
  return { pdfUnused: !used };
}

// Removes an unfinished import (docs/database.md, "Exporting and importing a project"; the owner, 2026-11-24): not marked
// like a deleted project, removed for good, as if it had never been started, so that its calls' costs aren't kept
// under a project nobody saw, and a retry imports them again under the real one. What it created goes: the project, its
// pipeline, the stages it copied (all created in it), their outputs, inputs, saves and calls, the model configs it
// created that nothing else uses by now. What it only pointed to stays as the usual deletion leaves it: the live stages
// and outputs it reused, the configs it matched; a call it brought back to life is deleted again, with its old
// deletion time, unless a live output names it by now. The content in R2 goes by the usual orphan collection, with its
// hour. (A stage or call of an import in progress is never served from the cache, so nothing else refers to them.)
//
// The unfinished imports of a file (`importing` holds its key), removed by a retry of the same file before it begins;
// the content they alone named is then collected.
export async function removeUnfinishedImports(env: Env, key: string, now = new Date()): Promise<number> {
  const { results } = await env.DB.prepare("SELECT id, pdf_sha256 FROM projects WHERE importing = ? AND deleted_at IS NULL").bind(key).all<ImportRow>();
  await removeImports(env, results);
  if (results.length > 0) await collectOrphans(env, new Date(now.getTime() - ORPHAN_MIN_AGE_MS));
  return results.length;
}

// An unfinished import is taken to be abandoned a day after it began (`imported_at`): one still going after that long
// has surely stopped (an import takes minutes).
export const ABANDONED_IMPORT_MS = 24 * 60 * 60 * 1000;

// "Free up storage" (the settings; the code review's dec. 18, with batch 11's proposal): the imports abandoned a day
// ago or more removed as above, then every object no row refers to collected (with its hour), not only after a
// deletion. Returns what was removed.
export async function freeUpStorage(env: Env, now = new Date()): Promise<Freed> {
  const before = new Date(now.getTime() - ABANDONED_IMPORT_MS).toISOString();
  // At most three at a time: each is one batch of 14 statements, within D1's statements per request.
  const { results } = await env.DB.prepare("SELECT id, pdf_sha256 FROM projects WHERE importing IS NOT NULL AND imported_at < ? AND deleted_at IS NULL ORDER BY imported_at LIMIT 3")
    .bind(before)
    .all<ImportRow>();
  await removeImports(env, results);
  const collected = await collectOrphans(env, new Date(now.getTime() - ORPHAN_MIN_AGE_MS));
  return { ...collected, imports: results.length };
}

export function freeUpRoutes(app: Hono<{ Bindings: Env }>) {
  app.post("/api/storage/free", async (c) => c.json<Freed>(await freeUpStorage(c.env)));
}

type ImportRow = { id: string; pdf_sha256: string };

async function removeImports(env: Env, results: ImportRow[]): Promise<void> {
  const db = env.DB;
  for (const { id, pdf_sha256: pdf } of results) {
    const stages = "SELECT id FROM stages WHERE created_in = ?";
    const outputs = `SELECT id FROM outputs WHERE stage_id IN (${stages})`;
    await db.batch([
      db.prepare(`DELETE FROM output_inputs WHERE output_id IN (${outputs}) OR input_id IN (${outputs})`).bind(id, id),
      db.prepare(`DELETE FROM stage_inputs WHERE stage_id IN (${stages})`).bind(id),
      db.prepare(`DELETE FROM manual_saves WHERE stage_id IN (${stages})`).bind(id),
      db.prepare(`DELETE FROM outputs WHERE stage_id IN (${stages})`).bind(id),
      db.prepare(`DELETE FROM llm_calls WHERE stage_id IN (${stages})`).bind(id),
      db
        .prepare(
          `UPDATE llm_calls SET deleted_at = i.was_deleted_at, imported_at = i.was_imported_at FROM import_ids i
           WHERE i.project_id = ? AND i.kind = 'call' AND i.was_deleted_at IS NOT NULL AND i.new_id = llm_calls.id AND llm_calls.id NOT IN (${LIVE_CALLS})`,
        )
        .bind(id),
      db.prepare("DELETE FROM dropped_stages WHERE project_id = ?").bind(id),
      db.prepare("DELETE FROM pipeline_entries WHERE project_id = ?").bind(id),
      db.prepare("DELETE FROM stages WHERE created_in = ?").bind(id),
      db
        .prepare(
          `DELETE FROM model_configs WHERE id IN (SELECT new_id FROM import_ids WHERE project_id = ? AND kind = 'config' AND made = 1)
             AND NOT EXISTS (SELECT 1 FROM stages s WHERE s.model_config_id = model_configs.id)
             AND NOT EXISTS (SELECT 1 FROM llm_calls c WHERE c.model_config_id = model_configs.id)
             AND NOT EXISTS (SELECT 1 FROM settings WHERE key = 'defaultModelConfigId' AND json_extract(value_json, '$') = model_configs.id)`,
        )
        .bind(id),
      db.prepare("DELETE FROM import_ids WHERE project_id = ?").bind(id),
      db.prepare("DELETE FROM projects WHERE id = ?").bind(id),
      db.prepare("DELETE FROM image_fingerprints WHERE pdf_sha256 = ? AND NOT EXISTS (SELECT 1 FROM projects WHERE pdf_sha256 = ? AND deleted_at IS NULL)").bind(pdf, pdf),
    ]);
  }
}
