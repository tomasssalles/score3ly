// The Usage tab's failed calls (docs/tasks.md, "Other statistics"): every LLM call the Worker made, counted per model
// config, quarter of an hour and reason ("ok" for one that succeeded), so the browser can count them in any time range
// and for any config without another request. Answers served from the record aren't calls. The fake provider that
// ships with the app is left out: some of its model names fail on purpose. A call still running is counted only once
// it is 15 minutes old: it will never answer then ("interrupted").

import type { Hono } from "hono";
import { BUCKET_SECONDS } from "./costs.ts";

const ZOMBIE_MS = 15 * 60 * 1000;

export function failureRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/api/failures", async (c) => {
    const db = c.env.DB;
    const zombie = new Date(Date.now() - ZOMBIE_MS).toISOString();
    const [points, configs] = await db.batch([
      db
        .prepare(
          `SELECT c.model_config_id AS config,
             (CAST(strftime('%s', c.started_at) AS INTEGER) / ${BUCKET_SECONDS}) * ${BUCKET_SECONDS} AS t,
             CASE
               WHEN c.status = 'running' THEN 'interrupted'
               WHEN c.status IN ('ok', 'cut_off', 'refused', 'unparseable') THEN c.status
               WHEN c.error_kind IS NULL THEN 'unexpected_stop'
               ELSE c.error_kind
             END AS reason,
             COUNT(*) AS n
           FROM llm_calls c JOIN model_configs m ON m.id = c.model_config_id
           WHERE m.provider <> 'fake' AND (c.status <> 'running' OR c.started_at < ?)
           GROUP BY config, t, reason
           ORDER BY t`,
        )
        .bind(zombie),
      db.prepare(
        "SELECT id, name, model, created_at, deleted_at FROM model_configs WHERE provider <> 'fake' AND id IN (SELECT DISTINCT model_config_id FROM llm_calls) ORDER BY created_at",
      ),
    ]);
    type Point = { config: string; t: number; reason: string; n: number };
    type ConfigRow = { id: string; name: string | null; model: string; created_at: string; deleted_at: string | null };
    return c.json({
      // [config, start of the quarter of an hour in ms, reason, number of calls]
      points: (points.results as Point[]).map((p) => [p.config, p.t * 1000, p.reason, p.n]),
      configs: (configs.results as ConfigRow[]).map((m) => ({ id: m.id, name: m.name, model: m.model, createdAt: m.created_at, deletedAt: m.deleted_at })),
    });
  });
}
