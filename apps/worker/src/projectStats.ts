// The Usage tab's projects (docs/statistics.md, "Projects"): every project, deleted ones included, with when it was
// created, whether it is deleted, and whether its pipeline is finished now (its last stage, always engrave, done); and
// the pages processed: the distinct pages of every `rasterize` stage that is done, replaced ones and those of deleted
// projects included, each page of a PDF once, however many projects are on it. The browser counts the projects
// created in a time range, so a change of range needs no request.

import type { ProjectStats } from "@score3ly/core";
import type { Hono } from "hono";
import { FINISHED, rasterizedPages } from "./statsSql.ts";

export function projectStatsRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/api/project-stats", async (c) => {
    const db = c.env.DB;
    const [projects, rasterized] = await db.batch([
      db.prepare(
        `SELECT p.id, p.created_at, p.deleted_at,
           ${FINISHED} AS finished
         FROM projects p WHERE p.importing IS NULL ORDER BY p.created_at`,
      ),
      db.prepare("SELECT p.pdf_sha256, s.config_json FROM stages s JOIN projects p ON p.id = s.created_in WHERE s.step = 'rasterize' AND s.status = 'done' AND s.config_json IS NOT NULL AND p.importing IS NULL"),
    ]);
    const pages = new Set<string>(); // `${pdf}/${page}`
    for (const row of rasterized.results as { pdf_sha256: string; config_json: string }[]) {
      for (const page of rasterizedPages(row.config_json)) pages.add(`${row.pdf_sha256}/${page}`);
    }
    type ProjectRow = { id: string; created_at: string; deleted_at: string | null; finished: number | null };
    return c.json<ProjectStats>({
      projects: (projects.results as ProjectRow[]).map((p) => ({ id: p.id, createdAt: p.created_at, deleted: p.deleted_at !== null, finished: p.finished === 1 })),
      pagesProcessed: pages.size,
    });
  });
}
