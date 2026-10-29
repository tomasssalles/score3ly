// The Statistics page's Run times (docs/tasks.md, "Other statistics"): the finished projects (their pipeline's last
// stage, always engrave, done), deleted ones included, with their creation, their last finish and their pages; the
// automatic stages created in them, with their step, model config, page count and how many items of each kind they
// have (for the items per page: a page, a system, the whole score); and every item that was timed (migration 0021),
// with what it found in the caches. Unfinished projects are left out: their times would look shorter than they will
// be. The browser filters by project and averages, so a change of selection needs no request.

import type { Hono } from "hono";
import { parsePages } from "@score3ly/core";

const MANUAL = ["ingest", "fix_skew", "fix_layout", "fix_metadata", "fix_observations", "human_review", "fix_mei"];

export function runTimeRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/api/run-times", async (c) => {
    const db = c.env.DB;
    const last = (column: string) =>
      `(SELECT s.${column} FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id WHERE e.project_id = p.id ORDER BY e.position DESC LIMIT 1)`;
    const finished = `SELECT p.id FROM projects p WHERE ${last("status")} = 'done'`;
    const manual = MANUAL.map((s) => `'${s}'`).join(", ");
    const [projects, stages, items, configs] = await db.batch([
      db.prepare(
        `SELECT p.id, p.name, p.created_at, p.deleted_at, ${last("finished_at")} AS finished_at,
           (SELECT s.config_json FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id WHERE e.project_id = p.id AND s.step = 'rasterize') AS rasterize_config
         FROM projects p WHERE p.id IN (${finished}) ORDER BY p.created_at`,
      ),
      db.prepare(
        `SELECT s.id, s.step, s.created_in AS project, s.model_config_id AS config, s.status, s.page_count,
           (SELECT COUNT(*) FROM outputs o WHERE o.stage_id = s.id AND o.item = '') AS whole,
           (SELECT COUNT(*) FROM outputs o WHERE o.stage_id = s.id AND o.item <> '' AND o.item NOT LIKE '%/%') AS pages,
           (SELECT COUNT(*) FROM outputs o WHERE o.stage_id = s.id AND o.item LIKE '%/%') AS systems
         FROM stages s WHERE s.created_in IN (${finished}) AND s.step NOT IN (${manual})`,
      ),
      db.prepare(
        `SELECT o.stage_id, o.item, o.duration_ms, o.calls, o.calls_cached, o.images, o.images_cached
         FROM outputs o JOIN stages s ON s.id = o.stage_id
         WHERE o.duration_ms IS NOT NULL AND s.created_in IN (${finished}) AND s.step NOT IN (${manual})`,
      ),
      db.prepare("SELECT id, name, model, created_at, deleted_at FROM model_configs ORDER BY created_at"),
    ]);
    type ProjectRow = { id: string; name: string; created_at: string; deleted_at: string | null; finished_at: string; rasterize_config: string | null };
    type StageRow = { id: string; step: string; project: string; config: string | null; status: string; page_count: number | null; whole: number; pages: number; systems: number };
    type ItemRow = { stage_id: string; item: string; duration_ms: number; calls: number; calls_cached: number; images: number; images_cached: number };
    type ConfigRow = { id: string; name: string | null; model: string; created_at: string; deleted_at: string | null };
    const usedConfigs = new Set((stages.results as StageRow[]).map((s) => s.config));
    return c.json({
      projects: (projects.results as ProjectRow[]).map((p) => ({
        id: p.id,
        name: p.name,
        createdAt: p.created_at,
        deletedAt: p.deleted_at,
        finishedAt: p.finished_at,
        pages: pagesOf(p.rasterize_config),
      })),
      stages: (stages.results as StageRow[]).map((s) => ({
        id: s.id,
        step: s.step,
        projectId: s.project,
        configId: s.config,
        done: s.status === "done",
        pageCount: s.page_count ?? 0,
        items: { whole: s.whole, page: s.pages, system: s.systems },
      })),
      // [stage, item, duration in ms, answers asked, of them from the record, images looked up, of them found]
      items: (items.results as ItemRow[]).map((i) => [i.stage_id, i.item, i.duration_ms, i.calls, i.calls_cached, i.images, i.images_cached]),
      configs: (configs.results as ConfigRow[])
        .filter((m) => usedConfigs.has(m.id))
        .map((m) => ({ id: m.id, name: m.name, model: m.model, createdAt: m.created_at, deletedAt: m.deleted_at })),
    });
  });
}

// The pages a `rasterize` config selects ("1-12, 15"), or none if it can't be read.
function pagesOf(configJson: string | null): number[] {
  if (!configJson) return [];
  const selection = (JSON.parse(configJson) as { pages?: unknown }).pages;
  const parsed = typeof selection === "string" ? parsePages(selection) : null;
  return parsed && !("error" in parsed) ? parsed.pages : [];
}
