// The Usage tab's projects (docs/tasks.md, "Other statistics"): every project, deleted ones included, with when it was
// created, whether it is deleted, and whether its pipeline is finished now (its last stage, always engrave, done); and
// the pages processed: the distinct pages of every `rasterize` stage that is done, replaced ones and those of deleted
// projects included, each page of a PDF once, however many projects are on it. The browser counts the projects
// created in a time range, so a change of range needs no request.

import type { Hono } from "hono";
import { parsePages } from "@score3ly/core";

export function projectStatsRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/api/project-stats", async (c) => {
    const db = c.env.DB;
    const [projects, rasterized] = await db.batch([
      db.prepare(
        `SELECT p.id, p.created_at, p.deleted_at,
           (SELECT s.status FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id WHERE e.project_id = p.id ORDER BY e.position DESC LIMIT 1) = 'done' AS finished
         FROM projects p ORDER BY p.created_at`,
      ),
      db.prepare("SELECT p.pdf_sha256, s.config_json FROM stages s JOIN projects p ON p.id = s.created_in WHERE s.step = 'rasterize' AND s.status = 'done' AND s.config_json IS NOT NULL"),
    ]);
    const pages = new Set<string>(); // `${pdf}/${page}`
    for (const row of rasterized.results as { pdf_sha256: string; config_json: string }[]) {
      const selection = (JSON.parse(row.config_json) as { pages?: unknown }).pages;
      const parsed = typeof selection === "string" ? parsePages(selection) : null;
      if (!parsed || "error" in parsed) continue;
      for (const page of parsed.pages) pages.add(`${row.pdf_sha256}/${page}`);
    }
    type ProjectRow = { id: string; created_at: string; deleted_at: string | null; finished: number | null };
    return c.json({
      projects: (projects.results as ProjectRow[]).map((p) => ({ id: p.id, createdAt: p.created_at, deleted: p.deleted_at !== null, finished: p.finished === 1 })),
      pagesProcessed: pages.size,
    });
  });
}
