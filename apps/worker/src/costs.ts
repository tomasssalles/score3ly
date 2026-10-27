// The costs view's data (docs/llm.md, "The costs view"): everything that was paid for, as small sums per stage, model
// config and quarter of an hour, with the stages, projects and configs they refer to. The browser filters, groups and
// sums them into the viewer's own days, weeks and months, so a change of view needs no request. Quarters of an hour,
// because every time zone's midnight falls on one (Nepal is UTC+5:45). Free-tier calls are left out: the view is
// about money. The spending cap's last 24 hours come along, for the top of the page.
//
// And for the average cost per page, every project, deleted ones included: what it cost in all (its replaced and
// stopped stages too, free calls at $0), whether its pipeline ran to its end, and the pages its `rasterize` stages
// selected, each once. The browser merges the projects of a PDF and averages, so a change of selection needs no
// request either.

import type { Hono } from "hono";
import { parsePages } from "@score3ly/core";
import { readSettings, spentInLastDay } from "./llmRoutes.ts";

export const BUCKET_SECONDS = 15 * 60;

export function costRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/api/costs", async (c) => {
    const db = c.env.DB;
    const [points, stages, projects, configs, projectCosts, rasterized] = await db.batch([
      db
        .prepare(
          `SELECT c.stage_id AS stage, c.model_config_id AS config,
             (CAST(strftime('%s', c.started_at) AS INTEGER) / ${BUCKET_SECONDS}) * ${BUCKET_SECONDS} AS t,
             SUM(c.cost_usd) AS usd
           FROM llm_calls c JOIN model_configs m ON m.id = c.model_config_id
           WHERE m.free_tier = 0 AND c.cost_usd > 0
           GROUP BY c.stage_id, c.model_config_id, t
           ORDER BY t`,
        ),
      // Kept: the stage is in a pipeline (its project's, deleted or not); else replaced or stopped.
      db.prepare(
        `SELECT s.id, s.step, s.created_in AS project, s.in_recipe,
           EXISTS (SELECT 1 FROM pipeline_entries e WHERE e.stage_id = s.id) AS kept
         FROM stages s WHERE s.id IN (SELECT DISTINCT stage_id FROM llm_calls WHERE cost_usd > 0)`,
      ),
      // Finished: the last stage of the pipeline (always engrave) is done.
      db.prepare(
        `SELECT p.id, p.name, p.pdf_sha256, p.pdf_filename, p.created_at, p.deleted_at,
           (SELECT s.status FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id WHERE e.project_id = p.id ORDER BY e.position DESC LIMIT 1) = 'done' AS finished
         FROM projects p ORDER BY p.created_at`,
      ),
      db.prepare(
        "SELECT id, name, provider, model, effort, created_at, deleted_at FROM model_configs WHERE free_tier = 0 AND id IN (SELECT DISTINCT model_config_id FROM llm_calls WHERE cost_usd > 0)",
      ),
      db.prepare("SELECT s.created_in AS project, SUM(c.cost_usd) AS usd FROM llm_calls c JOIN stages s ON s.id = c.stage_id GROUP BY s.created_in"),
      // The pages a `rasterize` stage ran on are written out in its config ("1-12, 15").
      db.prepare("SELECT created_in AS project, config_json FROM stages WHERE step = 'rasterize' AND started_at IS NOT NULL AND config_json IS NOT NULL"),
    ]);
    const costOf = new Map((projectCosts.results as { project: string; usd: number | null }[]).map((r) => [r.project, r.usd ?? 0]));
    const pagesOf = new Map<string, Set<number>>();
    for (const row of rasterized.results as { project: string; config_json: string }[]) {
      const selection = (JSON.parse(row.config_json) as { pages?: unknown }).pages;
      const parsed = typeof selection === "string" ? parsePages(selection) : null;
      if (!parsed || "error" in parsed) continue;
      const pages = pagesOf.get(row.project) ?? new Set<number>();
      for (const page of parsed.pages) pages.add(page);
      pagesOf.set(row.project, pages);
    }
    const [{ spendingCapUsd }, spent] = await Promise.all([readSettings(db), spentInLastDay(db)]);
    type Point = { stage: string; config: string; t: number; usd: number };
    type Stage = { id: string; step: string; project: string; in_recipe: number; kept: number };
    type ProjectRow = { id: string; name: string; pdf_sha256: string; pdf_filename: string; created_at: string; deleted_at: string | null; finished: number | null };
    type ConfigRow = { id: string; name: string | null; provider: string; model: string; effort: string | null; created_at: string; deleted_at: string | null };
    return c.json({
      capUsd: spendingCapUsd,
      spentLastDayUsd: spent,
      // [stage, config, start of the quarter of an hour in ms, US dollars]
      points: (points.results as Point[]).map((p) => [p.stage, p.config, p.t * 1000, p.usd]),
      stages: (stages.results as Stage[]).map((s) => ({ id: s.id, step: s.step, projectId: s.project, inRecipe: s.in_recipe === 1, kept: s.kept === 1 })),
      projects: (projects.results as ProjectRow[]).map((p) => ({
        id: p.id,
        name: p.name,
        pdfSha256: p.pdf_sha256,
        pdfFilename: p.pdf_filename,
        createdAt: p.created_at,
        deletedAt: p.deleted_at,
        finished: p.finished === 1,
        costUsd: costOf.get(p.id) ?? 0,
        pages: [...(pagesOf.get(p.id) ?? [])].sort((a, b) => a - b),
      })),
      configs: (configs.results as ConfigRow[]).map((m) => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        model: m.model,
        effort: m.effort,
        createdAt: m.created_at,
        deletedAt: m.deleted_at,
      })),
    });
  });
}
