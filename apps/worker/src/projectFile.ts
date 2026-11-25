// Exporting and importing a project (docs/database.md, "Exporting and importing a project"). The Worker hands out the
// rows of a project's current pipeline and takes them back in; the browser makes and reads the file (a zip with these
// rows, the PDF and the content in R2), since a zip is too much work for a Worker's CPU limit.
//
// An import is looked up like a run: a done stage whose key a live stage here has is that stage (nothing copied);
// any other stage is copied with a new id, and each of its calls is looked up: a live call with the same request key
// is used (no row), a deleted one is brought back to life (its cost stays where it was paid), and only a call found
// nowhere becomes a new row, which counts like any call. Original times are kept.

import { canonicalJson, CONFIG_VALUES, EXPORT_FORMAT, type ExportRow, firstFreeName, IMPORT_CHUNK_ROWS, IMPORT_TABLES, type ImportChunk, type Imported, type ImportHead, isSha256Hex, type ProjectExport, sameConfigValues } from "@score3ly/core";
import type { Hono } from "hono";
import { anyRunning, withModelConfig } from "./pipelineRules.ts";
import { PLACEHOLDER_ITEM, placeProblem } from "./places.ts";
import { badRequest, NO_PROJECT, problemText, refuse } from "./refusals.ts";
import { pdfKey } from "./storage.ts";
import { insertProject } from "./projects.ts";
import { nameBase } from "./names.ts";
import { removeUnfinishedImports } from "./deletion.ts";
import { notImportingProject, notImportingStage } from "./importing.ts";
import { lock } from "./versions.ts";
import { secretsOf, storedConfigProblem } from "./modelConfigs.ts";

// The export format (`EXPORT_FORMAT`) and what an export holds (`ProjectExport`) are in core (api/projectExport.ts).

type Row = ExportRow;

const STAGE_COLUMNS = [
  "id",
  "step",
  "step_version",
  "status",
  "config_json",
  "model_config_id",
  "stage_key",
  "page_count",
  "in_recipe",
  "error",
  "note",
  "replaces_stage_id",
  "created_at",
  "started_at",
  "heartbeat_at",
  "finished_at",
  "run_ms", // its run time (a file without it, made before 2026-11-18: none)
] as const;
const OUTPUT_COLUMNS = [
  "id",
  "stage_id",
  "item",
  "type",
  "content_sha256",
  "recipe_key",
  "recipe_json",
  "parent_output_id",
  "call_id",
  "created_at",
  "duration_ms",
  "calls",
  "calls_cached",
  "images",
  "images_cached",
] as const;
const CALL_COLUMNS = [
  "id",
  "stage_id",
  "model_config_id",
  "request_key",
  "response_model",
  "request_sha256",
  "response_sha256",
  "status",
  "error",
  "error_kind",
  "http_status",
  "input_tokens",
  "output_tokens",
  "cached_tokens",
  "cache_write_tokens",
  "cost_usd",
  "vat_percent",
  "price_json",
  "item",
  "round",
  "started_at",
  "finished_at",
] as const;
// What makes two model configs the same is `CONFIG_VALUES` (core): all but the id, the name and the dates.
const CONFIG_COLUMNS = ["id", "name", ...CONFIG_VALUES, "created_at", "deleted_at"] as const;
const FINGERPRINT_COLUMNS = [
  "recipe_key",
  "pdf_sha256",
  "version",
  "width",
  "height",
  "pixels_sha256",
  "thumbnail",
  "thumbnail_width",
  "thumbnail_height",
  "created_at",
] as const;

const list = (columns: readonly string[], alias: string) => columns.map((c) => `${alias}.${c}`).join(", ");

// The current pipeline's stages, as a subquery (one parameter: the project's id).
const PIPELINE_STAGES = "SELECT stage_id FROM pipeline_entries WHERE project_id = ?";

// The rows of a project's current pipeline (docs/database.md, "Exporting and importing a project"): its stages, whatever
// their state, with their outputs, inputs, calls, the calls their outputs were served from, their manual saves, the
// model configs of those stages and calls, and the PDF's fingerprints. Links to anything outside are cut. Null when no
// such project; "running" while a stage of it runs; `{ problem }` when a call has no place yet (`placeProblem`).
export async function exportProject(db: D1Database, projectId: string, now = Date.now()): Promise<ProjectExport | null | "running" | { problem: string }> {
  const project = await db
    .prepare("SELECT name, pdf_sha256, pdf_filename, page_count, run_mode, next_issue_number, created_at, last_modified_at, last_opened_at FROM projects WHERE id = ? AND deleted_at IS NULL")
    .bind(projectId)
    .first<ProjectExport["project"]>();
  if (!project) return null;
  if (await anyRunning(db, projectId, now)) return "running";
  const [pipeline, stages, outputs, outputInputs, stageInputs, calls, saves, fingerprints] = await db.batch<Row>([
    db.prepare("SELECT position, stage_id, carried FROM pipeline_entries WHERE project_id = ? ORDER BY position").bind(projectId),
    db.prepare(`SELECT ${list(STAGE_COLUMNS, "s")} FROM stages s WHERE s.id IN (${PIPELINE_STAGES})`).bind(projectId),
    db.prepare(`SELECT ${list(OUTPUT_COLUMNS, "o")} FROM outputs o WHERE o.stage_id IN (${PIPELINE_STAGES})`).bind(projectId),
    db
      .prepare(
        `SELECT oi.output_id, oi.input_id FROM output_inputs oi JOIN outputs a ON a.id = oi.output_id JOIN outputs b ON b.id = oi.input_id WHERE a.stage_id IN (${PIPELINE_STAGES}) AND b.stage_id IN (${PIPELINE_STAGES})`,
      )
      .bind(projectId, projectId),
    db
      .prepare(`SELECT si.stage_id, si.output_id FROM stage_inputs si JOIN outputs o ON o.id = si.output_id WHERE si.stage_id IN (${PIPELINE_STAGES}) AND o.stage_id IN (${PIPELINE_STAGES})`)
      .bind(projectId, projectId),
    // The stages' own calls, and those their outputs were served from (another stage's, maybe another project's).
    db
      .prepare(
        `SELECT ${list(CALL_COLUMNS, "c")} FROM llm_calls c WHERE c.stage_id IN (${PIPELINE_STAGES}) OR c.id IN (SELECT call_id FROM outputs WHERE call_id IS NOT NULL AND stage_id IN (${PIPELINE_STAGES}))`,
      )
      .bind(projectId, projectId),
    db.prepare(`SELECT stage_id, quarter, saves FROM manual_saves WHERE stage_id IN (${PIPELINE_STAGES})`).bind(projectId),
    db.prepare(`SELECT ${list(FINGERPRINT_COLUMNS, "f")} FROM image_fingerprints f WHERE f.pdf_sha256 = ?`).bind(project.pdf_sha256),
  ]);
  const stageIds = new Set(stages.results.map((s) => s.id as string));
  const outputIds = new Set(outputs.results.map((o) => o.id as string));
  // A call served to an output from another stage belongs, in the export, to the stage of the first output naming it:
  // imported where nothing matches it, it is that stage's call, as a run here would have made it.
  const servedTo = new Map<string, string>();
  for (const o of outputs.results) if (o.call_id && !servedTo.has(o.call_id as string)) servedTo.set(o.call_id as string, o.stage_id as string);
  for (const c of calls.results) {
    const problem = placeProblem(c);
    if (problem) return { problem };
  }
  const exportedCalls = calls.results.map((c) => (stageIds.has(c.stage_id as string) ? c : { ...c, stage_id: servedTo.get(c.id as string) ?? null }));
  const configIds = new Set<string>();
  for (const s of stages.results) if (s.model_config_id) configIds.add(s.model_config_id as string);
  for (const c of exportedCalls) configIds.add(c.model_config_id as string);
  const configs = configIds.size === 0 ? [] : await rowsByIds(db, `SELECT ${list(CONFIG_COLUMNS, "m")} FROM model_configs m WHERE m.id IN`, [...configIds]);
  const content = new Set<string>();
  // (Ingest's output is the PDF, stored under pdfs/, not content/: the file holds it apart.)
  for (const o of outputs.results) if (o.content_sha256 && o.content_sha256 !== project.pdf_sha256) content.add(o.content_sha256 as string);
  for (const c of exportedCalls) {
    if (c.request_sha256) content.add(c.request_sha256 as string);
    if (c.response_sha256) content.add(c.response_sha256 as string);
  }
  return {
    format: EXPORT_FORMAT,
    project,
    pipeline: pipeline.results,
    // Links to stages outside the pipeline are cut: an edited manual stage's link to the stage it replaced.
    stages: stages.results.map((s) => (s.replaces_stage_id && !stageIds.has(s.replaces_stage_id as string) ? { ...s, replaces_stage_id: null } : s)),
    outputs: outputs.results.map((o) => (o.parent_output_id && !outputIds.has(o.parent_output_id as string) ? { ...o, parent_output_id: null } : o)),
    output_inputs: outputInputs.results,
    stage_inputs: stageInputs.results,
    llm_calls: exportedCalls,
    model_configs: configs,
    manual_saves: saves.results,
    image_fingerprints: fingerprints.results,
    content: [...content].sort(),
  };
}

// Rows whose id is among `ids`, in chunks (D1 takes at most 100 parameters per statement).
async function rowsByIds(db: D1Database, sqlBeforeList: string, ids: string[]): Promise<Row[]> {
  const rows: Row[] = [];
  for (let i = 0; i < ids.length; i += 90) {
    const chunk = ids.slice(i, i + 90);
    const { results } = await db.prepare(`${sqlBeforeList} (${chunk.map(() => "?").join(", ")})`).bind(...chunk).all<Row>();
    rows.push(...results);
  }
  return rows;
}

// Why an import's head can't be imported, or null. Checks the shape the import relies on, not every value: the
// database's own constraints check the rest, and refuse the request.
export function headProblem(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return "The file holds no project.";
  const d = data as Partial<ImportHead>;
  // (The browser reads the format from the file's manifest first, and says so in its own words, `formatProblem`.)
  if (d.format !== EXPORT_FORMAT) {
    return typeof d.format === "number" && d.format > EXPORT_FORMAT
      ? `The file was exported by a newer version of score3ly (export format ${d.format}); update the app to import it.`
      : `The file's export format (${String(d.format)}) isn't one this version of score3ly reads.`;
  }
  if (!isSha256Hex(d.key)) return "The import names no file: no 'key'.";
  for (const key of ["pipeline", "stages", "model_configs"] as const) if (!Array.isArray(d[key]) || !d[key].every(isRow)) return `The file is incomplete: no ${key}.`;
  const p = d.project as Row | undefined;
  if (!p || typeof p.name !== "string" || !isSha256Hex(p.pdf_sha256) || typeof p.pdf_filename !== "string") return "The file is incomplete: no project.";
  const stageIds = new Set((d.stages as Row[]).map((s) => s.id));
  if (!(d.pipeline as Row[]).every((e) => stageIds.has(e.stage_id) && Number.isInteger(e.position))) return "The file's pipeline names stages it doesn't hold.";
  return null;
}

const isRow = (value: unknown): value is Row => typeof value === "object" && value !== null && !Array.isArray(value);

// An id map of an import in progress (`import_ids`): an exported row's id → the row here, and whether the import made it.
type Mapped = { id: string; made: boolean };
type IdMap = Map<string, Mapped>;
type IdKind = "config" | "stage" | "output" | "call";
type NewId = { old_id: string; new_id: string; made: number; was_deleted_at?: string | null; was_imported_at?: string | null };

// The map of a kind, for these exported ids only, or all of them.
async function idsOf(db: D1Database, projectId: string, kind: IdKind, oldIds?: unknown[]): Promise<IdMap> {
  const statement =
    oldIds === undefined
      ? db.prepare("SELECT old_id, new_id, made FROM import_ids WHERE project_id = ? AND kind = ?").bind(projectId, kind)
      : db.prepare("SELECT old_id, new_id, made FROM import_ids WHERE project_id = ? AND kind = ? AND old_id IN (SELECT value FROM json_each(?))").bind(projectId, kind, JSON.stringify([...new Set(oldIds)]));
  const { results } = await statement.all<{ old_id: string; new_id: string; made: number }>();
  return new Map(results.map((r) => [r.old_id, { id: r.new_id, made: r.made === 1 }]));
}

function recordIds(db: D1Database, projectId: string, kind: IdKind, ids: NewId[]): D1PreparedStatement[] {
  if (ids.length === 0) return [];
  return [
    insertRows(
      db,
      "import_ids",
      ["project_id", "kind", "old_id", "new_id", "made", "was_deleted_at", "was_imported_at"],
      ids.map((i) => ({ project_id: projectId, kind, ...i })),
    ),
  ];
}

// Rows into a table in one statement, however many (D1 takes at most 100 bound parameters and so many statements per
// request): the rows as one JSON value, each column read from it.
function insertRows(db: D1Database, table: string, columns: readonly string[], rows: Row[], verb = "INSERT"): D1PreparedStatement {
  return db
    .prepare(`${verb} INTO ${table} (${columns.join(", ")}) SELECT ${columns.map((c) => `json_extract(value, '$.${c}')`).join(", ")} FROM json_each(?)`)
    .bind(JSON.stringify(rows.map((row) => pick(row, columns))));
}

// The head of an import (`ImportHead`, core): first removes an unfinished import of the same file (`importing` holds
// its key), which also frees its name; then maps the model configs and stages, and makes the project, marked
// `importing`, with its copied stages and pipeline. The PDF must be stored already. Returns the new project's id and
// name, or what is missing.
//
// Model configs: one with the same values among those not deleted is used; else one is created (deleted if it was
// deleted where it came from), numbered if its name is taken. Stages: a done stage with the key of a live done stage
// here is that stage; the others are copied. Original times are kept.
export async function beginImport(env: Env, data: ImportHead, now = new Date()): Promise<Imported | { missing: string }> {
  const db = env.DB;
  const iso = now.toISOString();
  await removeUnfinishedImports(env, data.key, now);
  const pdfSha = data.project.pdf_sha256;
  if (!(await env.STORE.head(pdfKey(pdfSha)))) return { missing: "the PDF" };
  const projectId = crypto.randomUUID();

  // One look for every done stage's key.
  const keys = [...new Set(data.stages.filter((s) => s.status === "done" && typeof s.stage_key === "string").map((s) => s.stage_key as string))];
  const { results: matches } =
    keys.length === 0
      ? { results: [] }
      : await db
          .prepare(
            `SELECT j.value AS stage_key, (SELECT s.id FROM stages s WHERE s.stage_key = j.value AND s.status = 'done' AND s.deleted_at IS NULL AND ${notImportingProject("s.created_in")} LIMIT 1) AS id FROM json_each(?) j`,
          )
          .bind(JSON.stringify(keys))
          .all<{ stage_key: string; id: string | null }>();
  const here = new Map(matches.filter((m) => m.id).map((m) => [m.stage_key, m.id as string]));
  const stageIds: NewId[] = data.stages.map((s) => {
    const found = s.status === "done" && typeof s.stage_key === "string" ? here.get(s.stage_key) : undefined;
    return found ? { old_id: String(s.id), new_id: found, made: 0 } : { old_id: String(s.id), new_id: crypto.randomUUID(), made: 1 };
  });
  const stageMap = new Map(stageIds.map((s) => [s.old_id, s.new_id]));
  // The stages copied, given how the configs are mapped.
  const copiedWith = (configMap: Map<string, string>) =>
    data.stages
      .filter((_, i) => stageIds[i].made === 1)
      .map((s) => {
        const modelConfigId = s.model_config_id ? (configMap.get(s.model_config_id as string) ?? null) : null;
        return {
          ...s,
          id: stageMap.get(s.id as string)!,
          created_in: projectId,
          model_config_id: modelConfigId,
          // The config names its model config too (what the browser runs the stage with): the same one as the column.
          config_json: modelConfigId ? withModelConfig(s.config_json as string | null, modelConfigId) : s.config_json,
          replaces_stage_id: s.replaces_stage_id ? (stageMap.get(s.replaces_stage_id as string) ?? null) : null,
          imported_at: iso,
        };
      });
  const pipeline = data.pipeline.map((e) => ({ project_id: projectId, position: e.position, stage_id: stageMap.get(e.stage_id as string)!, carried: e.carried ? 1 : 0 }));

  // The project, under its exported name (numbered if taken, `insertProject`), marked `importing`, with its configs,
  // stages and pipeline. A config's name taken meanwhile fails the batch like a project's: the configs are mapped again.
  const p = data.project;
  const name = await insertProject(db, nameBase(String(data.project.name)), async (name) => {
    const { configIds, newConfigs } = await mappedConfigs(db, data.model_configs);
    const copied = copiedWith(new Map(configIds.map((c) => [c.old_id, c.new_id])));
    return [
      db
        .prepare(
          "INSERT INTO projects (id, name, pdf_sha256, pdf_filename, page_count, run_mode, next_issue_number, created_at, last_modified_at, last_opened_at, imported_at, importing) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(projectId, name, pdfSha, p.pdf_filename, Number.isInteger(p.page_count) && (p.page_count as number) > 0 ? p.page_count : null, p.run_mode === "manual" ? "manual" : "auto", Number(p.next_issue_number) || 1, p.created_at ?? iso, p.last_modified_at ?? iso, iso, iso, data.key),
      ...(newConfigs.length > 0 ? [insertRows(db, "model_configs", CONFIG_COLUMNS, newConfigs)] : []),
      ...(copied.length > 0 ? [insertRows(db, "stages", [...STAGE_COLUMNS, "created_in", "imported_at"], copied)] : []),
      ...(pipeline.length > 0 ? [insertRows(db, "pipeline_entries", ["project_id", "position", "stage_id", "carried"], pipeline)] : []),
      ...recordIds(db, projectId, "config", configIds),
      ...recordIds(db, projectId, "stage", stageIds),
    ];
  });
  return { id: projectId, name };
}

// The file's model configs mapped to those here: one with the same values among those not deleted is used; else one
// is created (deleted if it was deleted where it came from), numbered if its name is taken, its secrets as a create
// stores them (`storedConfigProblem` checked that they can be read).
async function mappedConfigs(db: D1Database, configs: Row[]): Promise<{ configIds: NewId[]; newConfigs: Row[] }> {
  const configIds: NewId[] = [];
  const newConfigs: Row[] = [];
  const { results: liveConfigs } = await db.prepare(`SELECT ${CONFIG_COLUMNS.join(", ")} FROM model_configs WHERE deleted_at IS NULL`).all<Row>();
  const takenConfigNames = liveConfigs.map((c) => c.name as string);
  for (const config of configs) {
    const match = liveConfigs.find((c) => sameConfigValues(c, config));
    if (match) {
      configIds.push({ old_id: String(config.id), new_id: match.id as string, made: 0 });
      continue;
    }
    const id = crypto.randomUUID();
    const deleted = config.deleted_at ?? null;
    const name = deleted ? String(config.name) : firstFreeName(String(config.name).trim(), takenConfigNames);
    if (!deleted) takenConfigNames.push(name);
    configIds.push({ old_id: String(config.id), new_id: id, made: 1 });
    newConfigs.push({ ...config, id, name, deleted_at: deleted, secrets_json: canonicalJson(secretsOf({ secrets_json: String(config.secrets_json) })) });
  }
  return { configIds, newConfigs };
}

// The project of an import in progress, or null.
async function importing(db: D1Database, projectId: string): Promise<{ name: string } | null> {
  return db.prepare("SELECT name FROM projects WHERE id = ? AND importing IS NOT NULL AND deleted_at IS NULL").bind(projectId).first<{ name: string }>();
}

// A chunk of an import's rows (`ImportChunk`, core), after its head: mapped to the rows here, and written in a few
// statements. Rows of stages the head found here (reused) aren't copied: their outputs are only looked up, by what they
// are about, for what refers to them.
export async function importChunk(db: D1Database, projectId: string, chunk: ImportChunk, now = new Date()): Promise<void> {
  const iso = now.toISOString();
  const { table, rows } = chunk;
  const stages = table === "image_fingerprints" ? new Map() : await idsOf(db, projectId, "stage");
  const copiedStage = (id: unknown) => stages.get(id as string)?.made === true;
  const reusedStage = (id: unknown) => stages.get(id as string)?.made === false;
  const statements: D1PreparedStatement[] = [];

  if (table === "llm_calls") {
    // A live call with the same request key is used; else a deleted one is brought back to life (its cost stays where
    // it was paid); else a new row, which counts like any call. Calls that didn't succeed are never served from the
    // cache: always new rows, as in a run. (A reused stage's calls are only looked up, for the copied outputs that may
    // name them; they are never copied.)
    const configs = await idsOf(db, projectId, "config");
    const ok = rows.filter((c) => c.status === "ok" && c.response_sha256);
    const { results: found } =
      ok.length === 0
        ? { results: [] }
        : await db
            .prepare(
              `SELECT j.key AS i, c.id, c.deleted_at, c.imported_at FROM json_each(?) j JOIN llm_calls c ON c.id = (SELECT id FROM llm_calls WHERE request_key = j.value AND status = 'ok' AND ${notImportingStage("stage_id")} ORDER BY deleted_at IS NOT NULL, started_at LIMIT 1)`,
            )
            .bind(JSON.stringify(ok.map((c) => c.request_key)))
            .all<{ i: number; id: string; deleted_at: string | null; imported_at: string | null }>();
    const ids: NewId[] = [];
    const revived: Row[] = [];
    for (const f of found) {
      const c = ok[f.i];
      if (f.deleted_at && reusedStage(c.stage_id)) continue;
      ids.push({ old_id: String(c.id), new_id: f.id, made: 0, was_deleted_at: f.deleted_at, was_imported_at: f.imported_at });
      // A file that knows the call's place gives it to a row that may not have it yet (made before migration 0004).
      if (f.deleted_at) revived.push({ id: f.id, request_sha256: c.request_sha256 ?? null, response_sha256: c.response_sha256, item: c.item !== undefined && c.round !== undefined ? c.item : null, round: c.item !== undefined && c.round !== undefined ? c.round : null });
    }
    const mapped = new Set(ids.map((i) => i.old_id));
    const added: Row[] = [];
    for (const c of rows) {
      if (mapped.has(String(c.id)) || !copiedStage(c.stage_id)) continue;
      const id = crypto.randomUUID();
      ids.push({ old_id: String(c.id), new_id: id, made: 1 });
      added.push({
        ...c,
        id,
        stage_id: stages.get(c.stage_id as string)!.id,
        model_config_id: configs.get(c.model_config_id as string)?.id ?? c.model_config_id,
        // Files exported before VAT was recorded (docs/llm.md, "VAT") have no rate: their calls had none.
        vat_percent: c.vat_percent ?? 0,
        // Files exported before calls had a place (docs/overview.md §12) have none: the placeholders, as for this
        // instance's own older calls.
        item: c.item ?? PLACEHOLDER_ITEM,
        round: c.round ?? 0,
        imported_at: iso,
      });
    }
    if (revived.length > 0) {
      statements.push(
        db
          .prepare(
            `UPDATE llm_calls SET deleted_at = NULL, imported_at = ?, request_sha256 = j.request_sha256, response_sha256 = j.response_sha256, item = COALESCE(j.item, llm_calls.item), round = COALESCE(j.round, llm_calls.round)
             FROM (SELECT json_extract(value, '$.id') AS id, json_extract(value, '$.request_sha256') AS request_sha256, json_extract(value, '$.response_sha256') AS response_sha256, json_extract(value, '$.item') AS item, json_extract(value, '$.round') AS round FROM json_each(?)) AS j
             WHERE llm_calls.id = j.id`,
          )
          .bind(iso, JSON.stringify(revived)),
      );
    }
    if (added.length > 0) statements.push(insertRows(db, "llm_calls", [...CALL_COLUMNS, "imported_at"], added));
    statements.push(...recordIds(db, projectId, "call", ids));
  } else if (table === "outputs") {
    const calls = await idsOf(db, projectId, "call", rows.filter((o) => o.call_id).map((o) => o.call_id));
    const outputs = await idsOf(db, projectId, "output", rows.filter((o) => o.parent_output_id).map((o) => o.parent_output_id));
    const ids: NewId[] = [];
    // A reused stage's outputs, by what they are about, stand for the exported ones (the same key: the same outputs).
    const reused = rows.filter((o) => reusedStage(o.stage_id));
    if (reused.length > 0) {
      const { results } = await db
        .prepare(
          "SELECT json_extract(j.value, '$.id') AS old_id, o.id AS new_id FROM json_each(?) j JOIN outputs o ON o.stage_id = json_extract(j.value, '$.stage') AND o.item = json_extract(j.value, '$.item') AND o.type = json_extract(j.value, '$.type')",
        )
        .bind(JSON.stringify(reused.map((o) => ({ id: o.id, stage: stages.get(o.stage_id as string)!.id, item: o.item, type: o.type }))))
        .all<{ old_id: string; new_id: string }>();
      for (const r of results) ids.push({ old_id: r.old_id, new_id: r.new_id, made: 0 });
    }
    const copied = rows.filter((o) => copiedStage(o.stage_id));
    for (const o of copied) ids.push({ old_id: String(o.id), new_id: crypto.randomUUID(), made: 1 });
    for (const i of ids) outputs.set(i.old_id, { id: i.new_id, made: i.made === 1 });
    const added = copied.map((o) => ({
      ...o,
      id: outputs.get(o.id as string)!.id,
      stage_id: stages.get(o.stage_id as string)!.id,
      call_id: o.call_id ? (calls.get(o.call_id as string)?.id ?? null) : null,
      parent_output_id: o.parent_output_id ? (outputs.get(o.parent_output_id as string)?.id ?? null) : null,
    }));
    if (added.length > 0) statements.push(insertRows(db, "outputs", OUTPUT_COLUMNS, added));
    statements.push(...recordIds(db, projectId, "output", ids));
  } else if (table === "output_inputs") {
    const outputs = await idsOf(db, projectId, "output", rows.flatMap((oi) => [oi.output_id, oi.input_id]));
    const links = rows
      .filter((oi) => outputs.get(oi.output_id as string)?.made && outputs.has(oi.input_id as string))
      .map((oi) => ({ output_id: outputs.get(oi.output_id as string)!.id, input_id: outputs.get(oi.input_id as string)!.id }));
    if (links.length > 0) statements.push(insertRows(db, "output_inputs", ["output_id", "input_id"], links, "INSERT OR IGNORE"));
  } else if (table === "stage_inputs") {
    const outputs = await idsOf(db, projectId, "output", rows.map((si) => si.output_id));
    const links = rows
      .filter((si) => copiedStage(si.stage_id) && outputs.has(si.output_id as string))
      .map((si) => ({ stage_id: stages.get(si.stage_id as string)!.id, output_id: outputs.get(si.output_id as string)!.id }));
    if (links.length > 0) statements.push(insertRows(db, "stage_inputs", ["stage_id", "output_id"], links, "INSERT OR IGNORE"));
  } else if (table === "manual_saves") {
    const saves = rows.filter((save) => copiedStage(save.stage_id)).map((save) => ({ ...save, stage_id: stages.get(save.stage_id as string)!.id }));
    if (saves.length > 0) statements.push(insertRows(db, "manual_saves", ["stage_id", "quarter", "saves"], saves));
  } else {
    statements.push(insertRows(db, "image_fingerprints", FINGERPRINT_COLUMNS, rows, "INSERT OR IGNORE"));
  }
  if (statements.length > 0) await db.batch(statements);
}

// The last request of an import: the project is unmarked, and shows; its id map goes.
export async function finishImport(db: D1Database, projectId: string): Promise<Imported | null> {
  const project = await importing(db, projectId);
  if (!project) return null;
  await db.batch([
    db.prepare("UPDATE projects SET importing = NULL WHERE id = ?").bind(projectId),
    db.prepare("DELETE FROM import_ids WHERE project_id = ?").bind(projectId),
  ]);
  return { id: projectId, name: project.name };
}

function chunkProblem(data: unknown): string | null {
  const d = data as Partial<ImportChunk> | null;
  if (!d || !(IMPORT_TABLES as readonly unknown[]).includes(d.table)) return `expected a 'table' of ${IMPORT_TABLES.join(", ")}`;
  if (!Array.isArray(d.rows) || !d.rows.every(isRow) || d.rows.length > IMPORT_CHUNK_ROWS) return `expected 'rows', at most ${IMPORT_CHUNK_ROWS}`;
  return null;
}

const IMPORT_GONE = "The import can't go on: the project it was making isn't there any more (the file was imported again meanwhile, maybe in another tab). Import the file again.";

function pick(row: Row, columns: readonly string[]): Row {
  return Object.fromEntries(columns.map((c) => [c, row[c] ?? null]));
}

export function projectFileRoutes(app: Hono<{ Bindings: Env }>) {
  // The rows of the project's current pipeline, for the browser to make the file with.
  app.get("/api/projects/:id/export", async (c) => {
    const data = await exportProject(c.env.DB, c.req.param("id"));
    if (data === null) return refuse(c, 404, NO_PROJECT);
    if (data === "running") return refuse(c, 409, "The project can't be exported while one of its stages is running. Stop it, or let it finish, then try again.", "running");
    if ("problem" in data) return refuse(c, 409, `The project can't be exported yet: some of its LLM calls were recorded before calls had a place. Details: ${data.problem}`, "unplaced_calls");
    return c.json<ProjectExport>(data);
  });

  // An import's head (the PDF uploaded first): an unfinished import of the same file removed, then the project made,
  // hidden until its import finishes. Its content and rows follow (`ImportHead`, core).
  app.post("/api/projects/import", async (c) => {
    const data = await c.req.json().catch(() => null);
    const problem = headProblem(data);
    if (problem) return refuse(c, 400, problemText(problem));
    // A config this version can't store or read (the code review's E7): refused before anything is made or removed.
    for (const config of (data as ImportHead).model_configs) {
      const wrong = storedConfigProblem(config);
      if (wrong) return refuse(c, 409, `The file can't be imported: its model config "${String(config.name)}" can't be stored here. Details: ${wrong}.`);
    }
    const result = await beginImport(c.env, data as ImportHead);
    if ("missing" in result) return refuse(c, 409, `The project can't be imported yet: some of what it needs isn't on the server. Try again. Details: upload ${result.missing} first.`, "missing");
    return c.json<Imported>(result);
  });

  // A chunk of an import's rows, after its head and its content.
  app.post("/api/projects/:id/import/rows", lock("none"), async (c) => {
    const data = await c.req.json().catch(() => null);
    const problem = chunkProblem(data);
    if (problem) return badRequest(c, problem);
    const projectId = c.req.param("id");
    if (!(await importing(c.env.DB, projectId))) return refuse(c, 409, IMPORT_GONE, "missing");
    await importChunk(c.env.DB, projectId, data as ImportChunk);
    return c.body(null, 204);
  });

  // The end of an import: the project shows.
  app.post("/api/projects/:id/import/finish", lock("none"), async (c) => {
    const result = await finishImport(c.env.DB, c.req.param("id"));
    if (!result) return refuse(c, 409, IMPORT_GONE, "missing");
    return c.json<Imported>(result, 201);
  });
}
