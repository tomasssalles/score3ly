// A project's pipeline and its rules (docs/overview.md §5.5, docs/database.md): the stages' kinds as the Worker needs
// them, a new project's pipeline, rewriting a pipeline after a change, reading it, and a stage's entry in it. The routes
// that change a pipeline (pipeline.ts) apply these.

import type { Context, Hono } from "hono";
import { COST_WITH_VAT, SENT } from "./callRecords.ts";
import { NO_STAGE, refuse } from "./refusals.ts";
import { logFields } from "./requestLog.ts";
import { groupBy, isFurtherReview as furtherReview, RECIPE, stepsOfKind, type Pipeline, type StageModelConfig, type StageStatus } from "@score3ly/core";
import { readSettings } from "./settings.ts";
import { resolvedModel } from "./llm/models.ts";
import { unsupportedOf, type ModelConfigRow } from "./modelConfigs.ts";

// The pipeline as the API sends it (`Pipeline`, `Stage`, `Output`, `Dropped`) is in `@score3ly/core`.

// A stage's status as stored: a stopped stage has left the pipeline, so the API's `StageStatus` (a pipeline's) lacks it.
export type StoredStatus = StageStatus | "stopped";

// The version of the Ingest step that new projects get.
const INGEST_VERSION = 1;

// The manual steps (docs/overview.md §5.4), by their kind in core: the Worker needs to know these to add, edit and drop
// them, and to carry them when the stages after a change are replaced (§5.5). `human_review` is one too, though it is
// added with an `apply_review` of its own (docs/stages/music.md, `human_review`).
export const MANUAL_STEPS = stepsOfKind("manual");

export function isManual(step: string): boolean {
  return (MANUAL_STEPS as readonly string[]).includes(step);
}

// A further review (core's `isFurtherReview`), from a stage's row.
export function isFurtherReview(row: { step: string; in_recipe: number }): boolean {
  return furtherReview({ step: row.step, inRecipe: row.in_recipe === 1 });
}

// Whether a stage is carried through a re-run (docs/overview.md §5.5): a manual one, and a further review that has run.
export function isCarried(row: { step: string; in_recipe: number; status: StoredStatus }): boolean {
  return isManual(row.step) || (isFurtherReview(row) && row.status !== "planned");
}

// The LLM steps (docs/overview.md §7), by their kind in core: every stage of one names its model config from the moment
// it is created (docs/llm.md, "Which config a stage uses").
export const LLM_STEPS = stepsOfKind("llm");

export function isLlm(step: string): boolean {
  return (LLM_STEPS as readonly string[]).includes(step);
}

// A stage's config with another model config, everything else in it as it was.
export function withModelConfig(configJson: string | null, modelConfigId: string): string {
  return JSON.stringify({ ...(configJson === null ? {} : (JSON.parse(configJson) as Record<string, unknown>)), modelConfigId });
}

// The default model config for the LLM stages created now: the setting, if it names a config that exists (configs are
// only marked deleted, so it does unless the database was changed by hand).
export async function defaultForNewStages(db: D1Database): Promise<string | null> {
  const { defaultModelConfigId } = await readSettings(db);
  if (defaultModelConfigId === null) return null;
  return (await db.prepare("SELECT id FROM model_configs WHERE id = ?").bind(defaultModelConfigId).first()) ? defaultModelConfigId : null;
}

// A new stage's config as stored, and its model config: an LLM stage's config names the model config it uses (its
// `modelConfigId`), the default when it is created unless it names one already (a copy keeps the one of the stage it
// replaces). Any other stage's config is as given, without a model config.
export function newStageConfig(
  step: string,
  configJson: string | null,
  defaultModelConfigId: string | null,
): { configJson: string | null; modelConfigId: string | null } {
  if (!isLlm(step)) return { configJson, modelConfigId: null };
  const config = configJson === null ? {} : (JSON.parse(configJson) as Record<string, unknown>);
  const named = typeof config.modelConfigId === "string" ? config.modelConfigId : defaultModelConfigId;
  if (named === null) return { configJson, modelConfigId: null };
  return { configJson: JSON.stringify({ ...config, modelConfigId: named }), modelConfigId: named };
}

// Where a pipeline is: its first stage that isn't done, a carried one included (it waits for its turn, even when it is
// done; docs/overview.md §5.5). The condition for a stage `s` and its pipeline entry `e`, as SQL. The web follows the
// same rule (`firstNotDone` in apps/web/src/pipeline.ts).
export const notDone = (s: string, e: string) => `(${s}.status <> 'done' OR ${e}.carried = 1)`;

// A running stage whose heartbeat is older than this was interrupted (the tab was closed): it can run again.
export const STALE_MS = 3 * 60 * 1000;

export type StageRow = {
  id: string;
  step: string;
  step_version: number | null;
  status: StoredStatus;
  config_json: string | null;
  model_config_id: string | null;
  page_count: number | null;
  error: string | null;
  note: string | null;
  stage_key: string | null;
  started_at: string | null;
  heartbeat_at: string | null;
  finished_at: string | null;
  run_id: string | null; // the current or last run's (docs/database.md, "An interrupted run")
  run_started_at: string | null;
  run_ms: number | null;
  cost_usd?: number | null;
  carried?: number;
  in_recipe: number;
};

type OutputRow = {
  id: string;
  stage_id: string;
  item: string;
  type: string;
  content_sha256: string | null;
  recipe_key: string | null;
  recipe_json: string | null;
};

// The statements that give a new project its pipeline: Ingest, done, with the PDF as its output, and the other
// stages of the recipe, planned. Run in the same batch as the project's own insert.
export function newPipeline(
  db: D1Database,
  projectId: string,
  pdfSha256: string,
  defaultModelConfigId: string | null,
  now: string,
): D1PreparedStatement[] {
  const ingestId = crypto.randomUUID();
  // Ingest never runs and nothing looks it up, so it has no stage key.
  const statements = [
    db
      .prepare(
        "INSERT INTO stages (id, created_in, step, step_version, status, config_json, in_recipe, created_at, started_at, finished_at) VALUES (?, ?, 'ingest', ?, 'done', '{}', 1, ?, ?, ?)",
      )
      .bind(ingestId, projectId, INGEST_VERSION, now, now, now),
    db
      .prepare("INSERT INTO pipeline_entries (project_id, position, stage_id) VALUES (?, 1, ?)")
      .bind(projectId, ingestId),
    db
      .prepare("INSERT INTO outputs (id, stage_id, item, type, content_sha256, created_at) VALUES (?, ?, '', 'pdf', ?, ?)")
      .bind(crypto.randomUUID(), ingestId, pdfSha256, now),
  ];
  RECIPE.slice(1).forEach((step, i) =>
    statements.push(...plannedStage(db, projectId, i + 2, step, null, true, defaultModelConfigId, now)),
  );
  return statements;
}

// A new planned stage at `position` of the project's pipeline (replacing what was there). `inRecipe`: whether it is
// the recipe's or one the user added (docs/database.md); a stage that replaces another takes its mark. An LLM stage
// gets its model config now (`newStageConfig`).
export function plannedStage(
  db: D1Database,
  projectId: string,
  position: number,
  step: string,
  configJson: string | null,
  inRecipe: boolean,
  defaultModelConfigId: string | null,
  now: string,
): D1PreparedStatement[] {
  const id = crypto.randomUUID();
  const config = newStageConfig(step, configJson, defaultModelConfigId);
  return [
    db
      .prepare(
        "INSERT INTO stages (id, created_in, step, status, config_json, model_config_id, in_recipe, created_at) VALUES (?, ?, ?, 'planned', ?, ?, ?, ?)",
      )
      .bind(id, projectId, step, config.configJson, config.modelConfigId, inRecipe ? 1 : 0, now),
    db
      .prepare("INSERT OR REPLACE INTO pipeline_entries (project_id, position, stage_id) VALUES (?, ?, ?)")
      .bind(projectId, position, id),
  ];
}

// The statements that rewrite a pipeline from `position` on: the entries before it stay, `head` (stage ids) comes
// at `position`, and then the stages that were after `after`, replaced (docs/overview.md §5.5): a planned one keeps its
// row, one that ran gets a planned copy with its config, and a manual one, WIP or done, is carried: it stays, waiting
// for its turn, when it is kept if what it reads is the same as what it read (`resolve`).
// `modelConfig`: given, the LLM stages after `after` get that model config, and nothing else in their configs changes
// ("Apply to the remaining stages planned in this pipeline", docs/llm.md): a planned one in place, a copy as it is made,
// further reviews that ran included, which then aren't carried.
export async function rewriteFrom(
  db: D1Database,
  projectId: string,
  position: number,
  head: string[],
  after: number,
  now: string,
  modelConfig: string | null = null,
): Promise<D1PreparedStatement[]> {
  const { results: later } = await db
    .prepare(
      "SELECT s.id, s.step, s.status, s.config_json, s.in_recipe FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id WHERE e.project_id = ? AND e.position > ? ORDER BY e.position",
    )
    .bind(projectId, after)
    .all<{ id: string; step: string; status: StageStatus; config_json: string | null; in_recipe: number }>();
  const defaultModelConfigId = await defaultForNewStages(db);
  const statements = [
    // The cards of dropped stages in the part rewritten go (docs/overview.md §5.5).
    db
      .prepare(
        "DELETE FROM dropped_stages WHERE project_id = ? AND after_stage_id IN (SELECT stage_id FROM pipeline_entries WHERE project_id = ? AND position >= ?)",
      )
      .bind(projectId, projectId, position),
    db.prepare("DELETE FROM pipeline_entries WHERE project_id = ? AND position >= ?").bind(projectId, position),
  ];
  let next = position;
  const point = (stageId: string, carried = false) =>
    db
      .prepare("INSERT INTO pipeline_entries (project_id, position, stage_id, carried) VALUES (?, ?, ?, ?)")
      .bind(projectId, next++, stageId, carried ? 1 : 0);
  for (const id of head) statements.push(point(id));
  for (const row of later) {
    const changed = modelConfig !== null && isLlm(row.step);
    // A further review that ran is carried, unless the change gives the stages after it a model config: then it runs
    // again with it, as a planned copy (decided 2026-11-09, docs/overview.md §5.5), and so does its Apply review.
    if (isCarried(row) && !(changed && isFurtherReview(row))) statements.push(point(row.id, true));
    else if (row.status === "planned") {
      statements.push(point(row.id));
      if (changed) {
        statements.push(
          db.prepare("UPDATE stages SET config_json = ?, model_config_id = ? WHERE id = ?").bind(withModelConfig(row.config_json, modelConfig), modelConfig, row.id),
        );
      }
    } else {
      const config = changed ? withModelConfig(row.config_json, modelConfig) : row.config_json;
      statements.push(...plannedStage(db, projectId, next++, row.step, config, row.in_recipe === 1, defaultModelConfigId, now));
    }
  }
  return statements;
}

// Whether a stage of the project's pipeline is running (an interrupted one doesn't count).
export async function anyRunning(db: D1Database, projectId: string, now: number): Promise<boolean> {
  const { results } = await db
    .prepare(
      "SELECT s.* FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id WHERE e.project_id = ? AND s.status = 'running'",
    )
    .bind(projectId)
    .all<StageRow>();
  return results.some((stage) => !isStale(stage, now));
}

// `dev`: whether the Worker offers the providers for development (`devProviders`), for the configs' `unsupported`.
export async function readPipeline(db: D1Database, projectId: string, dev: boolean, now = Date.now()): Promise<Pipeline> {
  const [stages, outputs, dropped, configs] = await db.batch([
    db
      .prepare(
        `SELECT s.*, e.carried, (SELECT SUM(${COST_WITH_VAT}) FROM llm_calls c WHERE c.stage_id = s.id AND ${SENT}) AS cost_usd FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id WHERE e.project_id = ? ORDER BY e.position`,
      )
      .bind(projectId),
    db
      .prepare(
        "SELECT o.* FROM pipeline_entries e JOIN outputs o ON o.stage_id = e.stage_id WHERE e.project_id = ? ORDER BY o.created_at, o.item",
      )
      .bind(projectId),
    db.prepare("SELECT id, after_stage_id, step FROM dropped_stages WHERE project_id = ? ORDER BY id").bind(projectId),
    // The stages' model configs, as stored (`ModelConfigRow`), deleted ones included: the cards show them.
    db
      .prepare("SELECT m.* FROM model_configs m WHERE m.id IN (SELECT s.model_config_id FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id WHERE e.project_id = ?)")
      .bind(projectId),
  ]);
  const configById = new Map((configs.results as ModelConfigRow[]).map((row) => [row.id, row]));
  const byStage = groupBy(outputs.results as OutputRow[], (row) => row.stage_id);
  return {
    stages: (stages.results as StageRow[]).map((row) => ({
      id: row.id,
      step: row.step,
      stepVersion: row.step_version,
      status: row.status as StageStatus, // a stage in a pipeline is never stopped (`StoredStatus`)
      config: row.config_json === null ? null : JSON.parse(row.config_json),
      pageCount: row.page_count,
      error: row.error,
      note: row.note,
      startedAt: row.started_at,
      heartbeatAt: row.heartbeat_at,
      finishedAt: row.finished_at,
      interrupted: wasInterrupted(row, now),
      runMs: row.run_ms,
      modelConfig: row.model_config_id && configById.has(row.model_config_id) ? stageModelConfig(configById.get(row.model_config_id)!, dev) : null,
      costUsd: row.cost_usd ?? null,
      carried: row.carried === 1,
      inRecipe: row.in_recipe === 1,
      outputs: (byStage.get(row.id) ?? []).map((o) => ({
        id: o.id,
        item: o.item,
        type: o.type,
        contentSha256: o.content_sha256,
        recipeKey: o.recipe_key,
        recipe: o.recipe_json === null ? null : JSON.parse(o.recipe_json),
      })),
    })),
    dropped: (dropped.results as { id: number; after_stage_id: string; step: string }[]).map((row) => ({
      id: row.id,
      afterStageId: row.after_stage_id,
      step: row.step,
    })),
  };
}

// A stage's entry in a live project's pipeline: where it is, the stage, and whether it is carried (waiting for its turn).
export type Entry = { position: number; stage: StageRow; carried: boolean };

declare module "hono" {
  interface ContextVariableMap {
    entry: Entry;
  }
}

// The stage at a position of a live project's pipeline, if it is there.
async function entry(db: D1Database, projectId: string, stageId: string, request: Request): Promise<Entry | null> {
  const row = await db
    .prepare(
      "SELECT e.position, e.carried, s.* FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id JOIN projects p ON p.id = e.project_id WHERE e.project_id = ? AND e.stage_id = ? AND p.deleted_at IS NULL",
    )
    .bind(projectId, stageId)
    .first<StageRow & { position: number }>();
  // The stage's step, for the request's log line.
  if (row) logFields(request, { step: row.step });
  return row && { position: row.position, stage: row, carried: row.carried === 1 };
}

// Every request about a stage (`/api/projects/:pid/stages/:sid/…`) is about one in the project's pipeline: its entry is
// read once, here, before anything else (a stage that isn't there is refused), and the route takes it from the context
// (`stageEntry`). Registered before every route under that path.
export function stageEntries(app: Hono<{ Bindings: Env }>) {
  app.use("/api/projects/:pid/stages/:sid/*", async (c, next) => {
    const found = await entry(c.env.DB, c.req.param("pid"), c.req.param("sid"), c.req.raw);
    if (!found) return refuse(c, 404, NO_STAGE);
    c.set("entry", found);
    await next();
  });
}

// The entry `stageEntries` read for this request.
export function stageEntry(c: Context): Entry {
  const found = c.get("entry");
  if (!found) throw new Error("No stage entry: the route isn't under /api/projects/:pid/stages/:sid/.");
  return found;
}

// The LLM calls of a stage still marked running, once its run is over (stopped, or interrupted and started again):
// recorded as errors of kind `aborted`, without tokens, so the costs count them as calls of unknown cost (docs/llm.md,
// "Stopped calls"). The Worker that made one may still record its real end afterwards, which then replaces this.
export const STOPPED_CALL = "Stopped: the stage was stopped while this call ran. Whether the provider billed it is unknown.";
export const INTERRUPTED_CALL = "Interrupted: the stage's run ended while this call ran. Whether the provider billed it is unknown.";

export function closeRunningCalls(db: D1Database, stageId: string, now: string, message: string): D1PreparedStatement {
  return db
    .prepare("UPDATE llm_calls SET status = 'error', error = ?, error_kind = 'aborted', finished_at = ? WHERE stage_id = ? AND status = 'running'")
    .bind(message, now, stageId);
}

// Whether a stage was interrupted: running, with its heartbeat older than `STALE_MS` by the Worker's clock (or none).
// The Worker alone decides it, and sends it with the pipeline (`Stage.interrupted`, `PipelinePosition.interrupted`), so
// that a device whose clock is off shows what the Worker would do.
export function isStale(stage: { status: string; heartbeat_at: string | null }, now: number): boolean {
  return stage.status === "running" && (stage.heartbeat_at === null || now - Date.parse(stage.heartbeat_at) > STALE_MS);
}

// The error of a stage released when its run was given up (the user left the project mid-run, `POST release`).
export const RELEASED = "Interrupted: the project was left while this stage ran.";

// Whether a stage was interrupted, as the pipeline and the project list say it: running with its heartbeat stopped
// (`isStale`), or released when its run was given up. Either can run again at once.
export function wasInterrupted(stage: { status: string; heartbeat_at: string | null; error: string | null }, now: number): boolean {
  return isStale(stage, now) || (stage.status === "failed" && stage.error === RELEASED);
}

// A stage's run time (decided 2026-11-17, dec. 41): the summed time of its runs, each from its start to its end, or to
// its last heartbeat for one interrupted (docs/database.md, "An interrupted run"). Its value once the current run ends
// at `end`, an ISO time.
export function runMsUntil(stage: { run_ms: number | null; run_started_at: string | null }, end: string | null): number | null {
  if (stage.run_started_at === null || end === null) return stage.run_ms;
  return (stage.run_ms ?? 0) + Math.max(0, Date.parse(end) - Date.parse(stage.run_started_at));
}

// The same rule as SQL, for a stage `s` (one parameter: `staleBefore(now)`), so that a statement can act only on a stage
// that may start: `start`'s conditional update.
export const startable = (s: string) => `(${s}.status IN ('planned', 'failed') OR (${s}.status = 'running' AND (${s}.heartbeat_at IS NULL OR ${s}.heartbeat_at < ?)))`;
export const staleBefore = (now: number) => new Date(now - STALE_MS).toISOString();

// The last position that goes when the stage at `position` is dropped: a review's or a human review's `apply_review`
// goes with it (docs/overview.md §5.5, "An `apply_review` goes with its review").
export async function withItsApply(db: D1Database, projectId: string, position: number): Promise<number> {
  const next = await db
    .prepare("SELECT s.step FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id WHERE e.project_id = ? AND e.position = ?")
    .bind(projectId, position + 1)
    .first<{ step: string }>();
  const stage = await db
    .prepare("SELECT s.step FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id WHERE e.project_id = ? AND e.position = ?")
    .bind(projectId, position)
    .first<{ step: string }>();
  return (stage?.step === "review" || stage?.step === "human_review") && next?.step === "apply_review" ? position + 1 : position;
}

export function touchProject(db: D1Database, projectId: string, now: string): D1PreparedStatement {
  return db.prepare("UPDATE projects SET last_modified_at = ? WHERE id = ?").bind(now, projectId);
}

// What a stage's card shows of its model config (`StageModelConfig`).
export function stageModelConfig(config: ModelConfigRow, dev: boolean): StageModelConfig {
  const { model } = resolvedModel(config);
  return { name: config.name, model, deleted: config.deleted_at !== null, unsupported: unsupportedOf(config, dev) !== null };
}
