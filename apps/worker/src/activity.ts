// When the app was in use (docs/tasks.md, "Other statistics": the Usage tab): the quarters of an hour in which something
// happened, per project, from what is recorded anyway. Something happened when an LLM call was running (from its start
// to its end), or a stage started, ended or sent its last heartbeat, or an output was saved, or a project was created,
// or a manual stage was saved (and between two of its saves a quarter apart: activeTime.ts). A stage's start and end
// are events, not a span: a retried stage keeps its first start, and a manual stage left open for days isn't days of
// work. The browser counts the quarters (they fit every time zone). Deleted projects count too: their rows are kept
// (docs/database.md).

import type { Hono } from "hono";
import { manualQuarters, QUARTER_MS } from "./activeTime.ts";

export function activityRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/api/activity", async (c) => {
    const db = c.env.DB;
    const [calls, stages, outputs, projects, saves] = await db.batch([
      db.prepare("SELECT s.created_in AS project, c.started_at AS start, c.finished_at AS end FROM llm_calls c JOIN stages s ON s.id = c.stage_id"),
      db.prepare(
        "SELECT created_in AS project, started_at, finished_at, heartbeat_at FROM stages WHERE started_at IS NOT NULL",
      ),
      db.prepare("SELECT s.created_in AS project, o.created_at AS at FROM outputs o JOIN stages s ON s.id = o.stage_id"),
      db.prepare("SELECT id, name, created_at, deleted_at FROM projects ORDER BY created_at"),
      db.prepare("SELECT m.stage_id, m.quarter, s.created_in AS project FROM manual_saves m JOIN stages s ON s.id = m.stage_id"),
    ]);
    const quarters = new Set<string>(); // `${project}\u0000${quarter start in ms}`
    const mark = (project: string, iso: string | null) => {
      if (!iso) return;
      const t = Date.parse(iso);
      if (Number.isFinite(t)) quarters.add(`${project}\u0000${Math.floor(t / QUARTER_MS) * QUARTER_MS}`);
    };
    for (const call of calls.results as { project: string; start: string; end: string | null }[]) {
      const start = Date.parse(call.start);
      // A call that never ended (the tab was closed while it waited) counts only where it started.
      const end = call.end ? Date.parse(call.end) : start;
      for (let q = Math.floor(start / QUARTER_MS) * QUARTER_MS; q <= end; q += QUARTER_MS) quarters.add(`${call.project}\u0000${q}`);
    }
    for (const s of stages.results as { project: string; started_at: string; finished_at: string | null; heartbeat_at: string | null }[]) {
      mark(s.project, s.started_at);
      mark(s.project, s.finished_at);
      mark(s.project, s.heartbeat_at);
    }
    for (const o of outputs.results as { project: string; at: string }[]) mark(o.project, o.at);
    const saveRows = saves.results as { stage_id: string; quarter: number; project: string }[];
    const projectOf = new Map(saveRows.map((r) => [r.stage_id, r.project]));
    for (const [stage, list] of manualQuarters(saveRows)) for (const q of list) quarters.add(`${projectOf.get(stage)}\u0000${q}`);
    type ProjectRow = { id: string; name: string; created_at: string; deleted_at: string | null };
    for (const p of projects.results as ProjectRow[]) mark(p.id, p.created_at);
    return c.json({
      // [project, start of the quarter of an hour in ms], by time
      quarters: [...quarters]
        .map((key) => {
          const [project, t] = key.split("\u0000");
          return [project, Number(t)] as [string, number];
        })
        .sort((a, b) => a[1] - b[1]),
      projects: (projects.results as ProjectRow[]).map((p) => ({ id: p.id, name: p.name, createdAt: p.created_at, deletedAt: p.deleted_at })),
    });
  });
}
