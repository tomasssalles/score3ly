// The requests that read and change a project's pipeline (docs/database.md): the browser's while it runs a stage (start,
// outputs, heartbeat, finish, stop) or changes one's config, and a person's changes (a fix, an edit, a further or human
// review, a drop). The browser does the work; the Worker only records it, by the pipeline's rules (pipelineRules.ts).

import { notImportingProject } from "./importing.ts";
import { logFields } from "./requestLog.ts";
import { BAD_REQUEST, badRequest, NO_PROJECT, notRunning, PICK_ANOTHER, refuse, RELOAD, RUN_OVER, STAGE_RUNNING, WAITS_FOR_TURN } from "./refusals.ts";
import { isDroppable, isSha256Hex, quarterOf, type AddedStage, type OutputsAnswer, type Pipeline, type Resolved, type StartAnswer } from "@score3ly/core";
import type { Context, Hono } from "hono";
import { lock } from "./versions.ts";
import { deletedConfigMessage, devProviders, unsupportedConfigMessage, unsupportedOf, type ModelConfigRow } from "./modelConfigs.ts";
import {
  anyRunning,
  closeRunningCalls,
  defaultForNewStages,
  INTERRUPTED_CALL,
  isManual,
  isStale,
  notDone,
  newStageConfig,
  plannedStage,
  readPipeline,
  RELEASED,
  rewriteFrom,
  runMsUntil,
  stageEntry,
  type StageRow,
  startable,
  staleBefore,
  STOPPED_CALL,
  touchProject,
  withItsApply,
} from "./pipelineRules.ts";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

// A running stage's requests (outputs, heartbeat, finish) come from its current run, which sends the id `start` gave it
// (docs/database.md, "An interrupted run"): a run that is over (interrupted, then started again elsewhere) can't write.
// Null when the request may go on.
// What a stage read, in one statement however many outputs (D1 takes at most 100 bound parameters and so many
// statements per request; the code review, A3): the ids as one JSON parameter.
function stageInputsOf(db: D1Database, stageId: string, outputIds: string[]): D1PreparedStatement {
  return db.prepare("INSERT OR IGNORE INTO stage_inputs (stage_id, output_id) SELECT ?, value FROM json_each(?)").bind(stageId, JSON.stringify(outputIds));
}

// What a stage's outputs were made from, each by its item and type, in one statement.
function outputInputsOf(db: D1Database, stageId: string, links: { item: unknown; type: unknown; input: string }[]): D1PreparedStatement {
  return db
    .prepare(
      "INSERT OR IGNORE INTO output_inputs (output_id, input_id) SELECT o.id, json_extract(j.value, '$.input') FROM json_each(?) j JOIN outputs o ON o.stage_id = ? AND o.item = json_extract(j.value, '$.item') AND o.type = json_extract(j.value, '$.type')",
    )
    .bind(JSON.stringify(links), stageId);
}

function refusedRun(c: Context, stage: StageRow, runId: unknown): Response | null {
  if (typeof runId !== "string") return badRequest(c, "expected the run's 'runId'");
  return runId === stage.run_id ? null : refuse(c, 409, RUN_OVER);
}

export function pipelineRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/api/projects/:id/pipeline", async (c) => {
    const db = c.env.DB;
    const id = c.req.param("id");
    const project = await db.prepare("SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL").bind(id).first();
    if (!project) return refuse(c, 404, NO_PROJECT);
    return c.json<Pipeline>(await readPipeline(db, id, devProviders(c.env)));
  });

  // Sets the config of a stage (null: the defaults). A planned stage simply gets it. A stage that has run is
  // replaced by a new planned one with that config, and every stage after it by a new planned copy of itself
  // (docs/overview.md §5.5): the replaced stages stay, for the stage key to find them. Returns the pipeline.
  app.put("/api/projects/:pid/stages/:sid/config", lock("checked"), async (c) => {
    const db = c.env.DB;
    const { pid, sid } = c.req.param();
    const body = await c.req.json().catch(() => null);
    if (body === null || !("config" in body) || (body.config !== null && typeof body.config !== "object")) {
      return badRequest(c, "expected a 'config' object or null");
    }
    // "Apply to the remaining stages planned in this pipeline": the LLM stages after this one get its model config too.
    if (body.applyModelConfigToLater !== undefined && typeof body.applyModelConfigToLater !== "boolean") {
      return badRequest(c, "'applyModelConfigToLater' must be true or false");
    }
    const found = stageEntry(c);
    const now = new Date().toISOString();
    const { stage, position } = found;
    // An LLM stage's config names its model config: the one given, else the default now (docs/llm.md).
    const { configJson, modelConfigId } = newStageConfig(
      stage.step,
      body.config === null ? null : JSON.stringify(body.config),
      await defaultForNewStages(db),
    );
    if (modelConfigId !== null) {
      const picked = await db.prepare("SELECT * FROM model_configs WHERE id = ?").bind(modelConfigId).first<ModelConfigRow>();
      if (!picked) return refuse(c, 400, "That model config doesn't exist any more: it may have been deleted on another device. Pick another.");
      // A stage that names a deleted or unsupported config keeps it until another is picked; such a one can't be picked anew.
      const before = stage.config_json === null ? null : (JSON.parse(stage.config_json) as { modelConfigId?: string }).modelConfigId;
      if (picked.deleted_at && before !== modelConfigId) return refuse(c, 400, `The model config "${picked.name}" was deleted. Pick another.`);
      const unsupported = before !== modelConfigId ? unsupportedOf(picked, devProviders(c.env)) : null;
      if (unsupported) return refuse(c, 400, `The model config "${picked.name}" ${unsupported}. Pick another.`);
    }
    const toLater = body.applyModelConfigToLater === true && modelConfigId !== null ? modelConfigId : null;
    if (stage.status === "running" && !isStale(stage, Date.now())) {
      return refuse(c, 409, "The config can't be changed while the stage is running. Stop it, or let it finish, then try again.", "running");
    }
    if (stage.step === "ingest") return refuse(c, 409, "Ingest has no config to change.");
    if (isManual(stage.step)) return refuse(c, 409, "A manual stage has no config to change.");
    // Another stage running: a change here would replace it (if it comes later) under the run (found 2026-11-17, the
    // code review); one rule for every change of the pipeline while a stage runs.
    if (await anyRunning(db, pid, Date.now())) return refuse(c, 409, STAGE_RUNNING, "running");
    const statements: D1PreparedStatement[] = [touchProject(db, pid, now)];
    if (stage.status === "planned") {
      statements.push(db.prepare("UPDATE stages SET config_json = ?, model_config_id = ? WHERE id = ?").bind(configJson, modelConfigId, sid));
      if (toLater !== null) statements.push(...(await rewriteFrom(db, pid, position + 1, [], position, now, toLater)));
    } else {
      const id = crypto.randomUUID();
      statements.push(
        db
          .prepare(
            "INSERT INTO stages (id, created_in, step, status, config_json, model_config_id, in_recipe, created_at) VALUES (?, ?, ?, 'planned', ?, ?, ?, ?)",
          )
          .bind(id, pid, stage.step, configJson, modelConfigId, stage.in_recipe, now),
        ...(await rewriteFrom(db, pid, position, [id], position, now, toLater)),
      );
    }
    await db.batch(statements);
    return c.json<Pipeline>(await readPipeline(db, pid, devProviders(c.env)));
  });

  // Starts a stage (or runs a failed or interrupted one again). The browser sends what it resolved: the step's
  // version, the config, the model config (LLM stages), the stage key, the page count and the outputs it reads. If a finished stage that isn't
  // deleted has the same key, the pipeline points to it instead and nothing runs ({ reused: true }).
  app.post("/api/projects/:pid/stages/:sid/start", lock("raised"), async (c) => {
    const db = c.env.DB;
    const { pid, sid } = c.req.param();
    const body = await c.req.json().catch(() => null);
    const { stepVersion, config, stageKey, pageCount, inputIds, modelConfigId = null } = body ?? {};
    if (
      !Number.isInteger(stepVersion) ||
      typeof config !== "object" ||
      config === null ||
      !isSha256Hex(stageKey) ||
      !(pageCount === null || Number.isInteger(pageCount)) ||
      !isStringArray(inputIds) ||
      !(modelConfigId === null || typeof modelConfigId === "string")
    ) {
      return badRequest(c, "expected 'stepVersion', 'config', 'stageKey', 'pageCount' and 'inputIds'");
    }
    const found = stageEntry(c);
    const { stage, position } = found;
    const now = new Date();
    const cantStart = (status: string) => refuse(c, 409, `The stage can't start now. ${RELOAD} Details: its status is "${status}".`);
    if (!(stage.status === "planned" || stage.status === "failed" || isStale(stage, now.getTime()))) return cantStart(stage.status);
    const iso = now.toISOString();
    if (modelConfigId !== null) {
      const config = await db.prepare("SELECT * FROM model_configs WHERE id = ?").bind(modelConfigId).first<ModelConfigRow>();
      if (!config) return refuse(c, 404, `The stage can't start: its model config doesn't exist. ${PICK_ANOTHER}`);
      // A deleted config is never used again (docs/llm.md, "Managing model configs"), nor one the app no longer
      // supports ("No longer supported"): the run stops here, failed.
      if (config.deleted_at) return refuse(c, 409, `The stage can't start: ${deletedConfigMessage(config.name)} ${PICK_ANOTHER}`, "deleted_model_config");
      const unsupported = unsupportedOf(config, devProviders(c.env));
      if (unsupported) return refuse(c, 409, `The stage can't start: ${unsupportedConfigMessage(config.name, unsupported)} ${PICK_ANOTHER}`, "unsupported_model_config");
    }
    const reusable = await db
      .prepare(`SELECT id FROM stages WHERE stage_key = ? AND status = 'done' AND deleted_at IS NULL AND id != ? AND ${notImportingProject("created_in")} LIMIT 1`)
      .bind(stageKey, sid)
      .first<{ id: string }>();
    if (reusable) {
      const statements = [
        db
          .prepare("UPDATE pipeline_entries SET stage_id = ? WHERE project_id = ? AND position = ?")
          .bind(reusable.id, pid, position),
        touchProject(db, pid, iso),
      ];
      // A planned stage that never ran leaves nothing behind.
      if (stage.status === "planned") statements.push(db.prepare("DELETE FROM stages WHERE id = ?").bind(sid));
      await db.batch(statements);
      return c.json<StartAnswer>({ reused: true, stageId: reusable.id });
    }
    // The run starts only if the stage may still start (a start from another tab may have come first): checked and
    // changed in one statement, so that of two starts at once, one runs.
    const runId = crypto.randomUUID();
    const claimed = await db
      .prepare(
        `UPDATE stages SET status = 'running', step_version = ?, config_json = ?, model_config_id = ?, stage_key = ?, page_count = ?, error = NULL, started_at = COALESCE(started_at, ?), heartbeat_at = ?, finished_at = NULL, run_id = ?, run_started_at = ?, run_ms = ? WHERE id = ? AND ${startable("stages")}`,
      )
      // An interrupted run's time counts up to its last heartbeat.
      .bind(stepVersion, JSON.stringify(config), modelConfigId, stageKey, pageCount, iso, iso, runId, iso, stage.status === "running" ? runMsUntil(stage, stage.heartbeat_at) : stage.run_ms, sid, staleBefore(now.getTime()))
      .run();
    if (claimed.meta.changes !== 1) return cantStart("running");
    // An earlier run's outputs (it failed or was interrupted) are kept for this one to resume from, unless that run had
    // another key (the app was updated meanwhile: another step version or prompt): then its items, made by other code,
    // are dropped, with what it read, and every item is made again (found 2026-11-17, the code review, 06 #9).
    const keptOutputs = stage.stage_key === null || stage.stage_key === stageKey;
    await db.batch([
      ...(keptOutputs
        ? []
        : [
            db.prepare("DELETE FROM output_inputs WHERE output_id IN (SELECT id FROM outputs WHERE stage_id = ?)").bind(sid),
            db.prepare("DELETE FROM outputs WHERE stage_id = ?").bind(sid),
            db.prepare("DELETE FROM stage_inputs WHERE stage_id = ?").bind(sid),
          ]),
      // A call of an earlier run of the stage still marked running (a closed tab) is over (docs/llm.md, "Stopped calls").
      closeRunningCalls(db, sid, iso, INTERRUPTED_CALL),
      stageInputsOf(db, sid, inputIds),
      touchProject(db, pid, iso),
    ]);
    return c.json<StartAnswer>({ reused: false, stageId: sid, runId, keptOutputs });
  });

  // Records outputs of a running stage, as soon as each is done (docs/overview.md §5.2), or of a WIP manual stage, as the
  // user works. A running stage's item already recorded is left as it is; a WIP stage's is overwritten. Returns the
  // outputs' ids, in the order sent.
  app.post("/api/projects/:pid/stages/:sid/outputs", lock({ wip: "checked", otherwise: null }), async (c) => {
    const db = c.env.DB;
    const { pid, sid } = c.req.param();
    const body = await c.req.json().catch(() => null);
    const outputs = body?.outputs;
    const valid =
      Array.isArray(outputs) &&
      outputs.every(
        (o) =>
          typeof o?.item === "string" &&
          typeof o?.type === "string" &&
          (o.contentSha256 === undefined || isSha256Hex(o.contentSha256)) &&
          (o.recipeKey === undefined || isSha256Hex(o.recipeKey)) &&
          (o.contentSha256 !== undefined || o.recipeKey !== undefined) &&
          (o.inputIds === undefined || isStringArray(o.inputIds)) &&
          (o.callId === undefined || typeof o.callId === "string") &&
          (o.parentOutputId === undefined || typeof o.parentOutputId === "string") &&
          (o.timing === undefined || isTiming(o.timing)),
      );
    if (!valid) return badRequest(c, "expected 'outputs' with an item, a type, and a content hash or a recipe key");
    logFields(c.req.raw, { outputs: outputs.length, items: outputs.map((o: { item: string }) => o.item).join(" ").slice(0, 200) });
    const found = stageEntry(c);
    const wip = found.stage.status === "wip";
    if (found.stage.status !== "running" && !wip) return refuse(c, 409, notRunning(found.stage.status));
    if (found.carried) return refuse(c, 409, WAITS_FOR_TURN);
    if (!wip) {
      const refused = refusedRun(c, found.stage, body.runId);
      if (refused) return refused;
    }
    const now = new Date().toISOString();
    const ids = outputs.map(() => crypto.randomUUID());
    // A WIP stage's item saved again: the new content replaces the old, in the same row.
    const columns = "id, stage_id, item, type, content_sha256, recipe_key, recipe_json, call_id, parent_output_id, created_at, duration_ms, calls, calls_cached, images, images_cached";
    const values = "?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?";
    const insert = wip
      ? `INSERT INTO outputs (${columns}) VALUES (${values}) ON CONFLICT (stage_id, item, type) DO UPDATE SET content_sha256 = excluded.content_sha256, recipe_key = excluded.recipe_key, recipe_json = excluded.recipe_json, parent_output_id = excluded.parent_output_id`
      : `INSERT OR IGNORE INTO outputs (${columns}) VALUES (${values})`;
    const statements: D1PreparedStatement[] = [];
    outputs.forEach((o: Record<string, unknown>, i: number) => {
      statements.push(
        db
          .prepare(insert)
          .bind(
            ids[i],
            sid,
            o.item,
            o.type,
            o.contentSha256 ?? null,
            o.recipeKey ?? null,
            o.recipe === undefined ? null : JSON.stringify(o.recipe),
            o.callId ?? null,
            o.parentOutputId ?? null,
            now,
            ...timingValues(o.timing as Timing | undefined),
          ),
      );
    });
    // What each output was made from, in one statement however many there are (D1's limits, the code review's A3).
    const links = outputs.flatMap((o: Record<string, unknown>) => ((o.inputIds as string[] | undefined) ?? []).map((input) => ({ item: o.item, type: o.type, input })));
    if (links.length > 0) statements.push(outputInputsOf(db, sid, links));
    statements.push(
      wip
        ? touchProject(db, pid, now)
        : db.prepare("UPDATE stages SET heartbeat_at = ? WHERE id = ?").bind(now, sid),
    );
    // A manual stage's save, counted in its quarter of an hour: its active time, for the statistics .
    if (wip) {
      const quarter = quarterOf(Date.parse(now));
      statements.push(
        db
          .prepare("INSERT INTO manual_saves (stage_id, quarter, saves) VALUES (?, ?, 1) ON CONFLICT (stage_id, quarter) DO UPDATE SET saves = saves + 1")
          .bind(sid, quarter),
      );
    }
    await db.batch(statements);
    const { results } = await db
      .prepare("SELECT id, item, type FROM outputs WHERE stage_id = ?")
      .bind(sid)
      .all<{ id: string; item: string; type: string }>();
    const byKey = new Map(results.map((r) => [`${r.type}\u0000${r.item}`, r.id]));
    // Every output sent is in the table now: inserted, or there already (`INSERT OR IGNORE`).
    return c.json<OutputsAnswer>({ ids: outputs.map((o: { item: string; type: string }) => byKey.get(`${o.type}\u0000${o.item}`)!) });
  });

  // Tells the Worker a running stage is still being worked on: once a minute, no more (docs/database.md).
  app.post("/api/projects/:pid/stages/:sid/heartbeat", lock("none"), async (c) => {
    const db = c.env.DB;
    const { pid, sid } = c.req.param();
    const found = stageEntry(c);
    if (found.stage.status !== "running") return refuse(c, 409, notRunning(found.stage.status));
    const refused = refusedRun(c, found.stage, (await c.req.json().catch(() => null))?.runId);
    if (refused) return refused;
    await db.prepare("UPDATE stages SET heartbeat_at = ? WHERE id = ?").bind(new Date().toISOString(), sid).run();
    return c.body(null, 204);
  });

  // Ends a running stage: done, with a short result, or failed, with the error. A WIP manual stage is finished the
  // same way (done only): the user clicked Finish.
  app.post("/api/projects/:pid/stages/:sid/finish", lock({ wip: "checked", otherwise: "raised" }), async (c) => {
    const db = c.env.DB;
    const { pid, sid } = c.req.param();
    const body = await c.req.json().catch(() => null);
    const status = body?.status;
    const note = body?.note ?? null;
    const error = body?.error ?? null;
    if (
      (status !== "done" && status !== "failed") ||
      (note !== null && typeof note !== "string") ||
      (error !== null && typeof error !== "string") ||
      (status === "failed") !== (error !== null)
    ) {
      return badRequest(c, "expected 'status' 'done' (with an optional 'note') or 'failed' with an 'error'");
    }
    const found = stageEntry(c);
    const { stage } = found;
    if (stage.status !== "running" && !(stage.status === "wip" && status === "done")) {
      return refuse(c, 409, notRunning(stage.status));
    }
    if (found.carried) return refuse(c, 409, WAITS_FOR_TURN);
    if (stage.status === "running") {
      const refused = refusedRun(c, stage, body.runId);
      if (refused) return refused;
    }
    const now = new Date().toISOString();
    await db.batch([
      db
        .prepare("UPDATE stages SET status = ?, note = ?, error = ?, finished_at = ?, heartbeat_at = NULL, run_ms = ? WHERE id = ?")
        .bind(status, note, error, now, stage.status === "running" ? runMsUntil(stage, now) : stage.run_ms, sid),
      touchProject(db, pid, now),
    ]);
    return c.body(null, 204);
  });

  // Records that a stage failed before its run could start (docs/database.md, "An interrupted run"): the browser
  // couldn't get ready to run it (its inputs couldn't be loaded, say), for a reason other than one the user has to fix
  // first. Body: { error }. Only a stage that could start can fail so (planned, failed, interrupted), checked and changed
  // in one statement, as `start` does.
  app.post("/api/projects/:pid/stages/:sid/fail", lock("raised"), async (c) => {
    const db = c.env.DB;
    const { pid, sid } = c.req.param();
    const error = (await c.req.json().catch(() => null))?.error;
    if (typeof error !== "string" || error === "") return badRequest(c, "expected an 'error'");
    const found = stageEntry(c);
    if (found.carried) return refuse(c, 409, WAITS_FOR_TURN);
    const now = new Date();
    const iso = now.toISOString();
    const failed = await db
      .prepare(`UPDATE stages SET status = 'failed', error = ?, finished_at = ?, heartbeat_at = NULL WHERE id = ? AND ${startable("stages")}`)
      .bind(error, iso, sid, staleBefore(now.getTime()))
      .run();
    if (failed.meta.changes !== 1) return refuse(c, 409, `The stage's failure wasn't recorded. ${RELOAD} Details: its status is "${found.stage.status}".`);
    await db.batch([closeRunningCalls(db, sid, iso, INTERRUPTED_CALL), touchProject(db, pid, iso)]);
    return c.body(null, 204);
  });

  // Releases a running stage whose run this device gave up (the user left the project): it ends failed, interrupted,
  // with its outputs kept, so that it can run again at once, here or elsewhere, instead of looking like it runs until
  // its heartbeat is old (docs/database.md, "An interrupted run"). Only its own run can release it.
  app.post("/api/projects/:pid/stages/:sid/release", lock("raised"), async (c) => {
    const db = c.env.DB;
    const { pid, sid } = c.req.param();
    const { stage } = stageEntry(c);
    if (stage.status !== "running") return refuse(c, 409, notRunning(stage.status));
    const refused = refusedRun(c, stage, (await c.req.json().catch(() => null))?.runId);
    if (refused) return refused;
    const now = new Date().toISOString();
    await db.batch([
      db
        .prepare("UPDATE stages SET status = 'failed', error = ?, finished_at = ?, heartbeat_at = NULL, run_ms = ? WHERE id = ?")
        .bind(RELEASED, now, runMsUntil(stage, now), sid),
      closeRunningCalls(db, sid, now, INTERRUPTED_CALL),
      touchProject(db, pid, now),
    ]);
    return c.body(null, 204);
  });

  // Stops a running stage: it is marked stopped and leaves the pipeline, its outputs are thrown away, and a new
  // planned stage with the same config takes its place (docs/database.md). Its LLM calls stay; one still running is
  // recorded as stopped, of unknown cost (docs/llm.md, "Stopped calls").
  app.post("/api/projects/:pid/stages/:sid/stop", lock("checked"), async (c) => {
    const db = c.env.DB;
    const { pid, sid } = c.req.param();
    const found = stageEntry(c);
    const { stage, position } = found;
    if (stage.status !== "running") return refuse(c, 409, notRunning(stage.status));
    const now = new Date().toISOString();
    const defaultModelConfigId = await defaultForNewStages(db);
    await db.batch([
      db
        .prepare("UPDATE stages SET status = 'stopped', finished_at = ?, heartbeat_at = NULL WHERE id = ?")
        .bind(now, sid),
      closeRunningCalls(db, sid, now, STOPPED_CALL),
      db
        .prepare("DELETE FROM output_inputs WHERE output_id IN (SELECT id FROM outputs WHERE stage_id = ?)")
        .bind(sid),
      db.prepare("DELETE FROM outputs WHERE stage_id = ?").bind(sid),
      ...plannedStage(db, pid, position, stage.step, stage.config_json, stage.in_recipe === 1, defaultModelConfigId, now),
      touchProject(db, pid, now),
    ]);
    return c.json<Pipeline>(await readPipeline(db, pid, devProviders(c.env)));
  });

  // Adds a manual stage, WIP, after a done stage (docs/project-view.md): body { step, stepVersion, pageCount, inputIds }.
  // It goes after the manual stages that already follow the stage (e.g. `fix_observations` after `fix_metadata`,
  // both after `analyze`, §6), WIP or finished, which stay; the stages after those are replaced. Returns the
  // pipeline and the new stage's id.
  app.post("/api/projects/:pid/stages/:sid/fix", lock("checked"), async (c) => {
    const db = c.env.DB;
    const { pid, sid } = c.req.param();
    const body = await c.req.json().catch(() => null);
    const { step, stepVersion, pageCount, inputIds } = body ?? {};
    if (
      typeof step !== "string" ||
      !isManual(step) ||
      !Number.isInteger(stepVersion) ||
      !(pageCount === null || Number.isInteger(pageCount)) ||
      !isStringArray(inputIds)
    ) {
      return badRequest(c, "expected a manual 'step', 'stepVersion', 'pageCount' and 'inputIds'");
    }
    if (step === "human_review") return refuse(c, 409, `${BAD_REQUEST} Details: a Human review is added with its Apply review (POST …/human-review), not as a fix.`);
    const found = stageEntry(c);
    const { stage, position } = found;
    if (stage.status !== "done") return refuse(c, 409, `A fix can only follow a stage that is done. ${RELOAD}`);
    const { results: following } = await db
      .prepare("SELECT e.position, s.step FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id WHERE e.project_id = ? AND e.position > ? ORDER BY e.position")
      .bind(pid, position)
      .all<{ position: number; step: string }>();
    const end = following.findIndex((s) => !isManual(s.step));
    const run = end < 0 ? following : following.slice(0, end);
    if (run.some((s) => s.step === step)) return refuse(c, 409, `This fix already follows that stage. ${RELOAD}`);
    const last = run.at(-1)?.position ?? position;
    const now = new Date();
    if (await anyRunning(db, pid, now.getTime())) return refuse(c, 409, STAGE_RUNNING, "running");
    const iso = now.toISOString();
    const id = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          "INSERT INTO stages (id, created_in, step, step_version, status, config_json, page_count, in_recipe, created_at, started_at) VALUES (?, ?, ?, ?, 'wip', '{}', ?, 0, ?, ?)",
        )
        .bind(id, pid, step, stepVersion, pageCount, iso, iso),
      stageInputsOf(db, id, inputIds),
      // A stage of the same step added again where one was dropped: its card goes (docs/overview.md §5.5).
      db
        .prepare(
          "DELETE FROM dropped_stages WHERE project_id = ? AND step = ? AND after_stage_id IN (SELECT stage_id FROM pipeline_entries WHERE project_id = ? AND position BETWEEN ? AND ?)",
        )
        .bind(pid, step, pid, position, last),
      ...(await rewriteFrom(db, pid, last + 1, [id], last, iso)),
      touchProject(db, pid, iso),
    ]);
    return c.json<AddedStage>({ stageId: id, pipeline: await readPipeline(db, pid, devProviders(c.env)) });
  });

  // Edits a finished manual stage (docs/overview.md §5.4): a new WIP stage, with the same outputs and inputs, takes its
  // place and records which one it replaces; the old one stays as it was. The stages after it are replaced.
  app.post("/api/projects/:pid/stages/:sid/edit", lock("checked"), async (c) => {
    const db = c.env.DB;
    const { pid, sid } = c.req.param();
    const found = stageEntry(c);
    const { stage, position } = found;
    if (!isManual(stage.step) || stage.status !== "done") {
      return refuse(c, 409, `Only a finished manual stage can be edited. ${RELOAD}`);
    }
    if (found.carried) return refuse(c, 409, WAITS_FOR_TURN);
    const now = new Date();
    if (await anyRunning(db, pid, now.getTime())) return refuse(c, 409, STAGE_RUNNING, "running");
    const iso = now.toISOString();
    const id = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          "INSERT INTO stages (id, created_in, step, step_version, status, config_json, page_count, in_recipe, replaces_stage_id, created_at, started_at) SELECT ?, ?, step, step_version, 'wip', config_json, page_count, in_recipe, id, ?, ? FROM stages WHERE id = ?",
        )
        .bind(id, pid, iso, iso, sid),
      db
        .prepare("INSERT INTO stage_inputs (stage_id, output_id) SELECT ?, output_id FROM stage_inputs WHERE stage_id = ?")
        .bind(id, sid),
      db
        .prepare(
          "INSERT INTO outputs (id, stage_id, item, type, content_sha256, recipe_key, recipe_json, parent_output_id, created_at) SELECT lower(hex(randomblob(16))), ?, item, type, content_sha256, recipe_key, recipe_json, parent_output_id, ? FROM outputs WHERE stage_id = ?",
        )
        .bind(id, iso, sid),
      db
        .prepare(
          "INSERT INTO output_inputs (output_id, input_id) SELECT n.id, i.input_id FROM outputs o JOIN output_inputs i ON i.output_id = o.id JOIN outputs n ON n.stage_id = ? AND n.item = o.item AND n.type = o.type WHERE o.stage_id = ?",
        )
        .bind(id, sid),
      ...(await rewriteFrom(db, pid, position, [id], position, iso)),
      touchProject(db, pid, iso),
    ]);
    return c.json<AddedStage>({ stageId: id, pipeline: await readPipeline(db, pid, devProviders(c.env)) });
  });

  // A carried manual stage whose turn has come (every stage before it is done): the browser sends the outputs the
  // stage would read now ({ inputIds }, as when it was added). If they hold the same content as what it read (the same
  // items and types, each with the same content hash or recipe key), it is kept, as it is, WIP or done; otherwise it
  // is dropped, and the stages after it move up, with a card where it was (docs/overview.md §5.5). Returns whether it was
  // kept, and the pipeline.
  app.post("/api/projects/:pid/stages/:sid/resolve", lock("raised"), async (c) => {
    const db = c.env.DB;
    const { pid, sid } = c.req.param();
    const body = await c.req.json().catch(() => null);
    if (!isStringArray(body?.inputIds)) return badRequest(c, "expected 'inputIds'");
    const found = stageEntry(c);
    if (!found.carried) return refuse(c, 409, `The stage isn't waiting to be kept or dropped any more. ${RELOAD}`);
    const before = await db
      .prepare(`SELECT COUNT(*) AS n FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id WHERE e.project_id = ? AND e.position < ? AND ${notDone("s", "e")}`)
      .bind(pid, found.position)
      .first<{ n: number }>();
    if ((before?.n ?? 0) > 0) return refuse(c, 409, "The stage can't be kept or dropped yet: the stages before it aren't all done.");
    const contentOf = async (sql: string, binds: unknown[]) =>
      (
        await db
          .prepare(sql)
          .bind(...binds)
          .all<{ item: string; type: string; k: string | null }>()
      ).results
        .map((r) => `${r.type}\u0000${r.item}\u0000${r.k}`)
        .sort()
        .join("\n");
    const read = await contentOf(
      "SELECT o.item, o.type, COALESCE(o.content_sha256, o.recipe_key) AS k FROM stage_inputs i JOIN outputs o ON o.id = i.output_id WHERE i.stage_id = ?",
      [sid],
    );
    const ids = [...new Set(body.inputIds as string[])];
    // The ids as one JSON parameter: a 100-system score has more than D1's 100 bound parameters (the code review, A3).
    const now = await contentOf("SELECT item, type, COALESCE(content_sha256, recipe_key) AS k FROM outputs WHERE id IN (SELECT value FROM json_each(?))", [JSON.stringify(ids)]);
    const kept = read === now;
    const iso = new Date().toISOString();
    await db.batch(
      kept
        ? [db.prepare("UPDATE pipeline_entries SET carried = 0 WHERE project_id = ? AND position = ?").bind(pid, found.position)]
        : [
            ...(await rewriteFrom(db, pid, found.position, [], await withItsApply(db, pid, found.position), iso)),
            db
              .prepare(
                "INSERT INTO dropped_stages (project_id, after_stage_id, stage_id, step, dropped_at) SELECT ?, stage_id, ?, ?, ? FROM pipeline_entries WHERE project_id = ? AND position = ?",
              )
              .bind(pid, sid, found.stage.step, iso, pid, found.position - 1),
            touchProject(db, pid, iso),
          ],
    );
    return c.json<Resolved>({ kept, pipeline: await readPipeline(db, pid, devProviders(c.env)) });
  });

  // Adds a further review after an `apply_review` (docs/stages/music.md, `apply_review`: from any of them, right after
  // it), with an `apply_review` of its own, both planned and with the default model config. The stages after them are
  // replaced, as after any change in the middle (docs/overview.md §5.5). Returns the pipeline and the review's id.
  app.post("/api/projects/:pid/stages/:sid/review", lock("checked"), async (c) => {
    const db = c.env.DB;
    const { pid, sid } = c.req.param();
    const found = stageEntry(c);
    const { stage, position } = found;
    if (stage.step !== "apply_review") return refuse(c, 409, "A Review can only be added after an Apply review.");
    if (found.carried) return refuse(c, 409, WAITS_FOR_TURN);
    const now = new Date();
    if (await anyRunning(db, pid, now.getTime())) return refuse(c, 409, STAGE_RUNNING, "running");
    const iso = now.toISOString();
    const defaultModelConfigId = await defaultForNewStages(db);
    const ids = [crypto.randomUUID(), crypto.randomUUID()];
    const statements = ["review", "apply_review"].map((step, i) => {
      const config = newStageConfig(step, null, defaultModelConfigId);
      return db
        .prepare(
          "INSERT INTO stages (id, created_in, step, status, config_json, model_config_id, in_recipe, created_at) VALUES (?, ?, ?, 'planned', ?, ?, 0, ?)",
        )
        .bind(ids[i], pid, step, config.configJson, config.modelConfigId, iso);
    });
    await db.batch([...statements, ...(await rewriteFrom(db, pid, position + 1, ids, position, iso)), touchProject(db, pid, iso)]);
    return c.json<AddedStage>({ stageId: ids[0], pipeline: await readPipeline(db, pid, devProviders(c.env)) });
  });

  // Adds a human review after a done `apply_review` (docs/stages/music.md, `human_review`): WIP, right after it, with a
  // planned `apply_review` of its own (the default model config), as a further review is added. Body as for a fix:
  // { stepVersion, pageCount, inputIds }. The stages after them are replaced. Returns the pipeline and its id.
  app.post("/api/projects/:pid/stages/:sid/human-review", lock("checked"), async (c) => {
    const db = c.env.DB;
    const { pid, sid } = c.req.param();
    const body = await c.req.json().catch(() => null);
    const { stepVersion, pageCount, inputIds } = body ?? {};
    if (!Number.isInteger(stepVersion) || !(pageCount === null || Number.isInteger(pageCount)) || !isStringArray(inputIds)) {
      return badRequest(c, "expected 'stepVersion', 'pageCount' and 'inputIds'");
    }
    const found = stageEntry(c);
    const { stage, position } = found;
    if (stage.step !== "apply_review") return refuse(c, 409, "A Human review can only be added after an Apply review.");
    if (stage.status !== "done") return refuse(c, 409, `A Human review can only follow an Apply review that is done. ${RELOAD}`);
    if (found.carried) return refuse(c, 409, WAITS_FOR_TURN);
    const now = new Date();
    if (await anyRunning(db, pid, now.getTime())) return refuse(c, 409, STAGE_RUNNING, "running");
    const iso = now.toISOString();
    const ids = [crypto.randomUUID(), crypto.randomUUID()];
    const apply = newStageConfig("apply_review", null, await defaultForNewStages(db));
    await db.batch([
      db
        .prepare(
          "INSERT INTO stages (id, created_in, step, step_version, status, config_json, page_count, in_recipe, created_at, started_at) VALUES (?, ?, 'human_review', ?, 'wip', '{}', ?, 0, ?, ?)",
        )
        .bind(ids[0], pid, stepVersion, pageCount, iso, iso),
      stageInputsOf(db, ids[0], inputIds),
      db
        .prepare(
          "INSERT INTO stages (id, created_in, step, status, config_json, model_config_id, in_recipe, created_at) VALUES (?, ?, 'apply_review', 'planned', ?, ?, 0, ?)",
        )
        .bind(ids[1], pid, apply.configJson, apply.modelConfigId, iso),
      // A human review added again where one was dropped: its card goes (docs/overview.md §5.5).
      db
        .prepare("DELETE FROM dropped_stages WHERE project_id = ? AND step = 'human_review' AND after_stage_id = ?")
        .bind(pid, sid),
      ...(await rewriteFrom(db, pid, position + 1, ids, position, iso)),
      touchProject(db, pid, iso),
    ]);
    return c.json<AddedStage>({ stageId: ids[0], pipeline: await readPipeline(db, pid, devProviders(c.env)) });
  });

  // Drops a manual stage, WIP or finished (docs/overview.md §5.5): its entry goes, and the stages after it move up and are
  // replaced. The stage's row and outputs stay, like a replaced stage's.
  app.post("/api/projects/:pid/stages/:sid/drop", lock("checked"), async (c) => {
    const db = c.env.DB;
    const { pid, sid } = c.req.param();
    const found = stageEntry(c);
    const { stage, position } = found;
    if (!isDroppable({ step: stage.step, inRecipe: stage.in_recipe === 1 })) return refuse(c, 409, "Only stages outside the recipe can be dropped.");
    const now = new Date();
    if (await anyRunning(db, pid, now.getTime())) return refuse(c, 409, STAGE_RUNNING, "running");
    const iso = now.toISOString();
    const last = await withItsApply(db, pid, position);
    await db.batch([...(await rewriteFrom(db, pid, position, [], last, iso)), touchProject(db, pid, iso)]);
    return c.json<Pipeline>(await readPipeline(db, pid, devProviders(c.env)));
  });

  // Dismisses the card of a dropped stage (docs/overview.md §5.5).
  app.delete("/api/projects/:pid/dropped/:id", lock("checked"), async (c) => {
    const db = c.env.DB;
    const { pid, id } = c.req.param();
    const result = await db
      .prepare("DELETE FROM dropped_stages WHERE id = ? AND project_id = ? AND project_id IN (SELECT id FROM projects WHERE deleted_at IS NULL)")
      .bind(Number(id), pid)
      .run();
    if (!result.meta.changes) return refuse(c, 404, `This card isn't in the project any more. ${RELOAD}`);
    return c.json<Pipeline>(await readPipeline(db, pid, devProviders(c.env)));
  });
}

// How long an item took and what it found in the caches , as the browser measures it.
type Timing = { durationMs: number; calls: number; callsCached: number; images: number; imagesCached: number };

function isTiming(t: unknown): t is Timing {
  const x = t as Record<string, unknown> | null;
  const count = (v: unknown) => Number.isInteger(v) && (v as number) >= 0;
  return (
    !!x &&
    typeof x === "object" &&
    count(x.durationMs) &&
    count(x.calls) &&
    count(x.callsCached) &&
    count(x.images) &&
    count(x.imagesCached) &&
    (x.callsCached as number) <= (x.calls as number) &&
    (x.imagesCached as number) <= (x.images as number)
  );
}

function timingValues(t: Timing | undefined): (number | null)[] {
  return t ? [t.durationMs, t.calls, t.callsCached, t.images, t.imagesCached] : [null, null, null, null, null];
}
