// What the app has produced (docs/tasks.md, "Other statistics": the Usage tab's pages transcribed): every project,
// deleted ones included, with the PDF it is on, when it was created, when it was first finished, and the pages its
// pipeline's `rasterize` selected. The browser counts each page of a PDF once, on the day the first project with it
// was finished, so a change of range needs no request.
//
// A project is finished when the last stage of its pipeline (always engrave) is done. It was first finished when the
// first `engrave` created in it was done (a re-run that finishes again doesn't move the date). A pipeline whose
// `engrave` came from another project's stage, found by its key, has none of its own: then the time that stage was
// done, or the project's creation if that is later.

import type { Hono } from "hono";
import { parsePages } from "@score3ly/core";

export function transcribedRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/api/transcribed", async (c) => {
    const db = c.env.DB;
    const { results } = await db
      .prepare(
        `SELECT p.id, p.pdf_sha256, p.created_at,
           (SELECT s.status FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id WHERE e.project_id = p.id ORDER BY e.position DESC LIMIT 1) AS last_status,
           (SELECT s.finished_at FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id WHERE e.project_id = p.id ORDER BY e.position DESC LIMIT 1) AS last_finished_at,
           (SELECT MIN(s.finished_at) FROM stages s WHERE s.created_in = p.id AND s.step = 'engrave' AND s.status = 'done') AS first_engraved_at,
           (SELECT s.config_json FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id WHERE e.project_id = p.id AND s.step = 'rasterize') AS rasterize_config
         FROM projects p ORDER BY p.created_at`,
      )
      .all<{
        id: string;
        pdf_sha256: string;
        created_at: string;
        last_status: string | null;
        last_finished_at: string | null;
        first_engraved_at: string | null;
        rasterize_config: string | null;
      }>();
    return c.json({
      projects: results.map((p) => {
        const finished = p.last_status === "done";
        const borrowed = p.last_finished_at && p.last_finished_at > p.created_at ? p.last_finished_at : p.created_at;
        return {
          id: p.id,
          pdfSha256: p.pdf_sha256,
          createdAt: p.created_at,
          finishedAt: finished ? (p.first_engraved_at ?? borrowed) : null,
          pages: finished ? pagesOf(p.rasterize_config) : [],
        };
      }),
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
