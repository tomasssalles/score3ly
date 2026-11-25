// The Usage tab's failed calls (docs/statistics.md, "Failed calls"): every LLM call the Worker made, counted per model
// config, quarter of an hour and reason ("ok" for one that succeeded), so the browser can count them in any time range
// and for any config without another request. Answers served from the record aren't calls: their rows (`served_from`)
// come as "cached", which the browser shows apart and leaves out of the counts (the owner's dec. 16); the configs
// offered are those of calls that were sent. The fake provider that
// ships with the app is left out: some of its model names fail on purpose. A call still running is counted only once
// it is older than the longest call timeout plus a margin: it will never answer then ("interrupted", callRecords.ts).

import { notImportingStage } from "./importing.ts";
import type { FailureData, Outcome } from "@score3ly/core";
import type { Hono } from "hono";
import { CALL_QUARTER, endedOrDead, OUTCOME, SENT } from "./callRecords.ts";
import { CONFIG_COLUMNS, configSummary, type ConfigColumns } from "./statsSql.ts";


export function failureRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/api/failures", async (c) => {
    const db = c.env.DB;
    const [points, configs] = await db.batch([
      db
        .prepare(
          `SELECT c.model_config_id AS config,
             ${CALL_QUARTER} AS t,
             ${OUTCOME} AS reason,
             COUNT(*) AS n
           FROM llm_calls c JOIN model_configs m ON m.id = c.model_config_id
           WHERE c.stage_id IS NOT NULL AND m.provider <> 'fake' AND ${endedOrDead()} AND ${notImportingStage("c.stage_id")}
           GROUP BY config, t, reason
           ORDER BY t`,
        ),
      db.prepare(
        `SELECT ${CONFIG_COLUMNS} FROM model_configs WHERE provider <> 'fake' AND id IN (SELECT DISTINCT model_config_id FROM llm_calls c WHERE c.stage_id IS NOT NULL AND ${SENT} AND ${notImportingStage("c.stage_id")}) ORDER BY created_at`,
      ),
    ]);
    type Point = { config: string; t: number; reason: Outcome; n: number };
    return c.json<FailureData>({
      // [config, start of the quarter of an hour in ms, reason, number of calls]
      points: (points.results as Point[]).map((p) => [p.config, p.t * 1000, p.reason, p.n]),
      configs: (configs.results as ConfigColumns[]).map(configSummary),
    });
  });
}
