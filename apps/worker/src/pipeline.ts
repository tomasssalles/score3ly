// A project's pipeline and its stages (docs/database.md): reading them, and the requests the browser makes while it
// runs a stage (start, outputs, heartbeat, finish, stop) or changes one's config. The browser does the work; the
// Worker only records it.

import type { Hono } from "hono";

export type Pipeline = { stages: Stage[]; dropped: Dropped[] };

// A manual stage dropped at its turn because its inputs changed (docs/overview.md §5.5): a card where it was, after the
// stage with `afterStageId`, until dismissed. Several after the same stage are in the order they were dropped.
export type Dropped = { id: number; afterStageId: string; step: string };

export type StageStatus = "planned" | "running" | "failed" | "done" | "wip" | "stopped";

export type Stage = {
  id: string;
  step: string; // the step's id; its kind and title are declared in code
  stepVersion: number | null; // set when the stage starts
  status: StageStatus;
  config: unknown; // the step's config: null while planned with the defaults
  pageCount: number | null; // the pages its inputs cover, set when it starts
  error: string | null;
  note: string | null;
  startedAt: string | null;
  heartbeatAt: string | null; // written once a minute while running
  finishedAt: string | null;
  // LLM stages: the model config used, for the card (its name, else its model string), and what its calls cost.
  modelConfig: { name: string | null; model: string } | null;
  costUsd: number | null;
  // A manual stage carried through a re-run, waiting for its turn to be kept or dropped (docs/overview.md §5.5).
  carried: boolean;
  outputs: Output[];
};

export type Output = {
  id: string;
  item: string; // '' for the whole score, 'p3' for a page, 'p3/s2' for a system on it
  type: string; // e.g. 'pdf', 'page_image'
  contentSha256: string | null; // stored content, in R2
  recipeKey: string | null; // computed images: the hash of the recipe
  recipe: unknown; // computed images: the recipe
};

// The planned stages, in order (docs/overview.md §6). New projects get all of them; Ingest is done from the start.
export const RECIPE = ["ingest", "rasterize", "skew_analysis", "layout", "analyze", "extract", "engrave"] as const;

// The version of the Ingest step that new projects get.
const INGEST_VERSION = 1;

// The manual steps (docs/overview.md §5.4). A step's kind is declared in the web app; the Worker needs to know these to
// add, edit and drop them, and to carry them when the stages after a change are replaced (§5.5).
export const MANUAL_STEPS = ["fix_skew", "fix_layout", "fix_metadata", "fix_observations", "fix_mei"] as const;

function isManual(step: string): boolean {
  return (MANUAL_STEPS as readonly string[]).includes(step);
}

// A running stage whose heartbeat is older than this was interrupted (the tab was closed): it can run again.
export const STALE_MS = 3 * 60 * 1000;

type StageRow = {
  id: string;
  step: string;
  step_version: number | null;
  status: StageStatus;
  config_json: string | null;
  page_count: number | null;
  error: string | null;
  note: string | null;
  started_at: string | null;
  heartbeat_at: string | null;
  finished_at: string | null;
  mc_name?: string | null;
  mc_model?: string | null;
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
export function newPipeline(db: D1Database, projectId: string, pdfSha256: string, now: string): D1PreparedStatement[] {
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
  RECIPE.slice(1).forEach((step, i) => statements.push(...plannedStage(db, projectId, i + 2, step, null, true, now)));
  return statements;
}

// A new planned stage at `position` of the project's pipeline (replacing what was there). `inRecipe`: whether it is
// the recipe's or one the user added (docs/database.md); a stage that replaces another takes its mark.
function plannedStage(
  db: D1Database,
  projectId: string,
  position: number,
  step: string,
  configJson: string | null,
  inRecipe: boolean,
  now: string,
): D1PreparedStatement[] {
  const id = crypto.randomUUID();
  return [
    db
      .prepare("INSERT INTO stages (id, created_in, step, status, config_json, in_recipe, created_at) VALUES (?, ?, ?, 'planned', ?, ?, ?)")
      .bind(id, projectId, step, configJson, inRecipe ? 1 : 0, now),
    db
      .prepare("INSERT OR REPLACE INTO pipeline_entries (project_id, position, stage_id) VALUES (?, ?, ?)")
      .bind(projectId, position, id),
  ];
}

// The statements that rewrite a pipeline from `position` on: the entries before it stay, `head` (stage ids) comes
// at `position`, and then the stages that were after `after`, replaced (docs/overview.md §5.5): a planned one keeps its
// row, one that ran gets a planned copy with its config, and a manual one, WIP or done, is carried: it stays, waiting
// for its turn, when it is kept if what it reads is the same as what it read (`resolve`).
async function rewriteFrom(
  db: D1Database,
  projectId: string,
  position: number,
  head: string[],
  after: number,
  now: string,
): Promise<D1PreparedStatement[]> {
  const { results: later } = await db
    .prepare(
      "SELECT s.id, s.step, s.status, s.config_json, s.in_recipe FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id WHERE e.project_id = ? AND e.position > ? ORDER BY e.position",
    )
    .bind(projectId, after)
    .all<{ id: string; step: string; status: StageStatus; config_json: string | null; in_recipe: number }>();
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
    if (isManual(row.step)) statements.push(point(row.id, true));
    else if (row.status === "planned") statements.push(point(row.id));
    else statements.push(...plannedStage(db, projectId, next++, row.step, row.config_json, row.in_recipe === 1, now));
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

async function readPipeline(db: D1Database, projectId: string): Promise<Pipeline> {
  const [stages, outputs, dropped] = await db.batch([
    db
      .prepare(
        "SELECT s.*, e.carried, m.name AS mc_name, m.model AS mc_model, (SELECT SUM(c.cost_usd) FROM llm_calls c WHERE c.stage_id = s.id) AS cost_usd FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id LEFT JOIN model_configs m ON m.id = s.model_config_id WHERE e.project_id = ? ORDER BY e.position",
      )
      .bind(projectId),
    db
      .prepare(
        "SELECT o.* FROM pipeline_entries e JOIN outputs o ON o.stage_id = e.stage_id WHERE e.project_id = ? ORDER BY o.created_at, o.item",
      )
      .bind(projectId),
    db.prepare("SELECT id, after_stage_id, step FROM dropped_stages WHERE project_id = ? ORDER BY id").bind(projectId),
  ]);
  const byStage = new Map<string, OutputRow[]>();
  for (const row of outputs.results as OutputRow[]) {
    byStage.set(row.stage_id, [...(byStage.get(row.stage_id) ?? []), row]);
  }
  return {
    stages: (stages.results as StageRow[]).map((row) => ({
      id: row.id,
      step: row.step,
      stepVersion: row.step_version,
      status: row.status,
      config: row.config_json === null ? null : JSON.parse(row.config_json),
      pageCount: row.page_count,
      error: row.error,
      note: row.note,
      startedAt: row.started_at,
      heartbeatAt: row.heartbeat_at,
      finishedAt: row.finished_at,
      modelConfig: row.mc_model ? { name: row.mc_name ?? null, model: row.mc_model } : null,
      costUsd: row.cost_usd ?? null,
      carried: row.carried === 1,
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

// The stage at a position of a live project's pipeline, if it is there.
async function entry(
  db: D1Database,
  projectId: string,
  stageId: string,
): Promise<{ position: number; stage: StageRow; carried: boolean } | null> {
  const row = await db
    .prepare(
      "SELECT e.position, e.carried, s.* FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id JOIN projects p ON p.id = e.project_id WHERE e.project_id = ? AND e.stage_id = ? AND p.deleted_at IS NULL",
    )
    .bind(projectId, stageId)
    .first<StageRow & { position: number }>();
  return row && { position: row.position, stage: row, carried: row.carried === 1 };
}

function isStale(stage: StageRow, now: number): boolean {
  return stage.status === "running" && (stage.heartbeat_at === null || now - Date.parse(stage.heartbeat_at) > STALE_MS);
}

function touchProject(db: D1Database, projectId: string, now: string): D1PreparedStatement {
  return db.prepare("UPDATE projects SET last_modified_at = ? WHERE id = ?").bind(now, projectId);
}

function isKey(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

export function pipelineRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/api/projects/:id/pipeline", async (c) => {
    const db = c.env.DB;
    const id = c.req.param("id");
    const project = await db.prepare("SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL").bind(id).first();
    if (!project) return c.json({ error: "no such project" }, 404);
    return c.json(await readPipeline(db, id));
  });

  // Sets the config of a stage (null: the defaults). A planned stage simply gets it. A stage that has run is
  // replaced by a new planned one with that config, and every stage after it by a new planned copy of itself
  // (docs/overview.md §5.5): the replaced stages stay, for the stage key to find them. Returns the pipeline.
  app.put("/api/projects/:pid/stages/:sid/config", async (c) => {
    const db = c.env.DB;
    const { pid, sid } = c.req.param();
    const body = await c.req.json().catch(() => null);
    if (body === null || !("config" in body) || (body.config !== null && typeof body.config !== "object")) {
      return c.json({ error: "expected a 'config' object or null" }, 400);
    }
    const found = await entry(db, pid, sid);
    if (!found) return c.json({ error: "no such stage in this project's pipeline" }, 404);
    const now = new Date().toISOString();
    const configJson = body.config === null ? null : JSON.stringify(body.config);
    const { stage, position } = found;
    if (stage.status === "running" && !isStale(stage, Date.now())) {
      return c.json({ error: "the stage is running" }, 409);
    }
    if (stage.step === "ingest") return c.json({ error: "Ingest has no config" }, 409);
    if (isManual(stage.step)) return c.json({ error: "a manual stage has no config" }, 409);
    const statements: D1PreparedStatement[] = [touchProject(db, pid, now)];
    if (stage.status === "planned") {
      statements.push(db.prepare("UPDATE stages SET config_json = ? WHERE id = ?").bind(configJson, sid));
    } else {
      const id = crypto.randomUUID();
      statements.push(
        db
          .prepare(
            "INSERT INTO stages (id, created_in, step, status, config_json, in_recipe, created_at) VALUES (?, ?, ?, 'planned', ?, ?, ?)",
          )
          .bind(id, pid, stage.step, configJson, stage.in_recipe, now),
        ...(await rewriteFrom(db, pid, position, [id], position, now)),
      );
    }
    await db.batch(statements);
    return c.json(await readPipeline(db, pid));
  });

  // Starts a stage (or runs a failed or interrupted one again). The browser sends what it resolved: the step's
  // version, the config, the model config (LLM stages), the stage key, the page count and the outputs it reads. If a finished stage that isn't
  // deleted has the same key, the pipeline points to it instead and nothing runs ({ reused: true }).
  app.post("/api/projects/:pid/stages/:sid/start", async (c) => {
    const db = c.env.DB;
    const { pid, sid } = c.req.param();
    const body = await c.req.json().catch(() => null);
    const { stepVersion, config, stageKey, pageCount, inputIds, modelConfigId = null } = body ?? {};
    if (
      !Number.isInteger(stepVersion) ||
      typeof config !== "object" ||
      config === null ||
      !isKey(stageKey) ||
      !(pageCount === null || Number.isInteger(pageCount)) ||
      !isStringArray(inputIds) ||
      !(modelConfigId === null || typeof modelConfigId === "string")
    ) {
      return c.json({ error: "expected 'stepVersion', 'config', 'stageKey', 'pageCount' and 'inputIds'" }, 400);
    }
    const found = await entry(db, pid, sid);
    if (!found) return c.json({ error: "no such stage in this project's pipeline" }, 404);
    const { stage, position } = found;
    const now = new Date();
    if (!(stage.status === "planned" || stage.status === "failed" || isStale(stage, now.getTime()))) {
      return c.json({ error: `the stage can't start: it is ${stage.status}` }, 409);
    }
    const iso = now.toISOString();
    if (modelConfigId !== null) {
      const exists = await db.prepare("SELECT id FROM model_configs WHERE id = ?").bind(modelConfigId).first();
      if (!exists) return c.json({ error: "no such model config" }, 404);
    }
    const reusable = await db
      .prepare("SELECT id FROM stages WHERE stage_key = ? AND status = 'done' AND deleted_at IS NULL AND id != ? LIMIT 1")
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
      return c.json({ reused: true, stageId: reusable.id });
    }
    await db.batch([
      db
        .prepare(
          "UPDATE stages SET status = 'running', step_version = ?, config_json = ?, model_config_id = ?, stage_key = ?, page_count = ?, error = NULL, started_at = COALESCE(started_at, ?), heartbeat_at = ?, finished_at = NULL WHERE id = ?",
        )
        .bind(stepVersion, JSON.stringify(config), modelConfigId, stageKey, pageCount, iso, iso, sid),
      ...inputIds.map((outputId: string) =>
        db.prepare("INSERT OR IGNORE INTO stage_inputs (stage_id, output_id) VALUES (?, ?)").bind(sid, outputId),
      ),
      touchProject(db, pid, iso),
    ]);
    return c.json({ reused: false, stageId: sid });
  });

  // Records outputs of a running stage, as soon as each is done (docs/overview.md §5.2), or of a WIP manual stage, as the
  // user works. A running stage's item already recorded is left as it is; a WIP stage's is overwritten. Returns the
  // outputs' ids, in the order sent.
  app.post("/api/projects/:pid/stages/:sid/outputs", async (c) => {
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
          (o.contentSha256 === undefined || isKey(o.contentSha256)) &&
          (o.recipeKey === undefined || isKey(o.recipeKey)) &&
          (o.contentSha256 !== undefined || o.recipeKey !== undefined) &&
          (o.inputIds === undefined || isStringArray(o.inputIds)) &&
          (o.callId === undefined || typeof o.callId === "string") &&
          (o.parentOutputId === undefined || typeof o.parentOutputId === "string") &&
          (o.timing === undefined || isTiming(o.timing)),
      );
    if (!valid) return c.json({ error: "expected 'outputs' with an item, a type, and a content hash or a recipe key" }, 400);
    const found = await entry(db, pid, sid);
    if (!found) return c.json({ error: "no such stage in this project's pipeline" }, 404);
    const wip = found.stage.status === "wip";
    if (found.stage.status !== "running" && !wip) return c.json({ error: "the stage isn't running" }, 409);
    if (found.carried) return c.json({ error: "the stage waits for its turn" }, 409);
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
        ...((o.inputIds as string[] | undefined) ?? []).map((inputId) =>
          db
            .prepare(
              "INSERT OR IGNORE INTO output_inputs (output_id, input_id) SELECT id, ? FROM outputs WHERE stage_id = ? AND item = ? AND type = ?",
            )
            .bind(inputId, sid, o.item, o.type),
        ),
      );
    });
    statements.push(
      wip
        ? touchProject(db, pid, now)
        : db.prepare("UPDATE stages SET heartbeat_at = ? WHERE id = ?").bind(now, sid),
    );
    await db.batch(statements);
    const { results } = await db
      .prepare("SELECT id, item, type FROM outputs WHERE stage_id = ?")
      .bind(sid)
      .all<{ id: string; item: string; type: string }>();
    const byKey = new Map(results.map((r) => [`${r.type}\u0000${r.item}`, r.id]));
    return c.json({ ids: outputs.map((o: { item: string; type: string }) => byKey.get(`${o.type}\u0000${o.item}`)) });
  });

  // Tells the Worker a running stage is still being worked on: once a minute, no more (docs/database.md).
  app.post("/api/projects/:pid/stages/:sid/heartbeat", async (c) => {
    const db = c.env.DB;
    const { pid, sid } = c.req.param();
    const found = await entry(db, pid, sid);
    if (!found) return c.json({ error: "no such stage in this project's pipeline" }, 404);
    if (found.stage.status !== "running") return c.json({ error: "the stage isn't running" }, 409);
    await db.prepare("UPDATE stages SET heartbeat_at = ? WHERE id = ?").bind(new Date().toISOString(), sid).run();
    return c.body(null, 204);
  });

  // Ends a running stage: done, with a short result, or failed, with the error. A WIP manual stage is finished the
  // same way (done only): the user clicked Finish.
  app.post("/api/projects/:pid/stages/:sid/finish", async (c) => {
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
      return c.json({ error: "expected 'status' 'done' (with an optional 'note') or 'failed' with an 'error'" }, 400);
    }
    const found = await entry(db, pid, sid);
    if (!found) return c.json({ error: "no such stage in this project's pipeline" }, 404);
    const { stage } = found;
    if (stage.status !== "running" && !(stage.status === "wip" && status === "done")) {
      return c.json({ error: "the stage isn't running" }, 409);
    }
    if (found.carried) return c.json({ error: "the stage waits for its turn" }, 409);
    const now = new Date().toISOString();
    await db.batch([
      db
        .prepare("UPDATE stages SET status = ?, note = ?, error = ?, finished_at = ?, heartbeat_at = NULL WHERE id = ?")
        .bind(status, note, error, now, sid),
      touchProject(db, pid, now),
    ]);
    return c.body(null, 204);
  });

  // Stops a running stage: it is marked stopped and leaves the pipeline, its outputs are thrown away, and a new
  // planned stage with the same config takes its place (docs/database.md). Its LLM calls would stay.
  app.post("/api/projects/:pid/stages/:sid/stop", async (c) => {
    const db = c.env.DB;
    const { pid, sid } = c.req.param();
    const found = await entry(db, pid, sid);
    if (!found) return c.json({ error: "no such stage in this project's pipeline" }, 404);
    const { stage, position } = found;
    if (stage.status !== "running") return c.json({ error: "the stage isn't running" }, 409);
    const now = new Date().toISOString();
    await db.batch([
      db
        .prepare("UPDATE stages SET status = 'stopped', finished_at = ?, heartbeat_at = NULL WHERE id = ?")
        .bind(now, sid),
      db
        .prepare("DELETE FROM output_inputs WHERE output_id IN (SELECT id FROM outputs WHERE stage_id = ?)")
        .bind(sid),
      db.prepare("DELETE FROM outputs WHERE stage_id = ?").bind(sid),
      ...plannedStage(db, pid, position, stage.step, stage.config_json, stage.in_recipe === 1, now),
      touchProject(db, pid, now),
    ]);
    return c.json(await readPipeline(db, pid));
  });

  // Adds a manual stage, WIP, after a done stage (docs/project-view.md): body { step, stepVersion, pageCount, inputIds }.
  // It goes after the manual stages that already follow the stage (e.g. `fix_observations` after `fix_metadata`,
  // both after `analyze`, §6), WIP or finished, which stay; the stages after those are replaced. Returns the
  // pipeline and the new stage's id.
  app.post("/api/projects/:pid/stages/:sid/fix", async (c) => {
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
      return c.json({ error: "expected a manual 'step', 'stepVersion', 'pageCount' and 'inputIds'" }, 400);
    }
    const found = await entry(db, pid, sid);
    if (!found) return c.json({ error: "no such stage in this project's pipeline" }, 404);
    const { stage, position } = found;
    if (stage.status !== "done") return c.json({ error: "a fix can only follow a done stage" }, 409);
    const { results: following } = await db
      .prepare("SELECT e.position, s.step FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id WHERE e.project_id = ? AND e.position > ? ORDER BY e.position")
      .bind(pid, position)
      .all<{ position: number; step: string }>();
    const end = following.findIndex((s) => !isManual(s.step));
    const run = end < 0 ? following : following.slice(0, end);
    if (run.some((s) => s.step === step)) return c.json({ error: "this fix already follows that stage" }, 409);
    const last = run.at(-1)?.position ?? position;
    const now = new Date();
    if (await anyRunning(db, pid, now.getTime())) return c.json({ error: "a stage is running" }, 409);
    const iso = now.toISOString();
    const id = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          "INSERT INTO stages (id, created_in, step, step_version, status, config_json, page_count, in_recipe, created_at, started_at) VALUES (?, ?, ?, ?, 'wip', '{}', ?, 0, ?, ?)",
        )
        .bind(id, pid, step, stepVersion, pageCount, iso, iso),
      ...inputIds.map((outputId: string) =>
        db.prepare("INSERT OR IGNORE INTO stage_inputs (stage_id, output_id) VALUES (?, ?)").bind(id, outputId),
      ),
      // A stage of the same step added again where one was dropped: its card goes (docs/overview.md §5.5).
      db
        .prepare(
          "DELETE FROM dropped_stages WHERE project_id = ? AND step = ? AND after_stage_id IN (SELECT stage_id FROM pipeline_entries WHERE project_id = ? AND position BETWEEN ? AND ?)",
        )
        .bind(pid, step, pid, position, last),
      ...(await rewriteFrom(db, pid, last + 1, [id], last, iso)),
      touchProject(db, pid, iso),
    ]);
    return c.json({ stageId: id, pipeline: await readPipeline(db, pid) });
  });

  // Edits a finished manual stage (docs/overview.md §5.4): a new WIP stage, with the same outputs and inputs, takes its
  // place and records which one it replaces; the old one stays as it was. The stages after it are replaced.
  app.post("/api/projects/:pid/stages/:sid/edit", async (c) => {
    const db = c.env.DB;
    const { pid, sid } = c.req.param();
    const found = await entry(db, pid, sid);
    if (!found) return c.json({ error: "no such stage in this project's pipeline" }, 404);
    const { stage, position } = found;
    if (!isManual(stage.step) || stage.status !== "done") {
      return c.json({ error: "only a finished manual stage can be edited" }, 409);
    }
    if (found.carried) return c.json({ error: "the stage waits for its turn" }, 409);
    const now = new Date();
    if (await anyRunning(db, pid, now.getTime())) return c.json({ error: "a stage is running" }, 409);
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
    return c.json({ stageId: id, pipeline: await readPipeline(db, pid) });
  });

  // A carried manual stage whose turn has come (every stage before it is done): the browser sends the outputs the
  // stage would read now ({ inputIds }, as when it was added). If they hold the same content as what it read (the same
  // items and types, each with the same content hash or recipe key), it is kept, as it is, WIP or done; otherwise it
  // is dropped, and the stages after it move up, with a card where it was (docs/overview.md §5.5). Returns whether it was
  // kept, and the pipeline.
  app.post("/api/projects/:pid/stages/:sid/resolve", async (c) => {
    const db = c.env.DB;
    const { pid, sid } = c.req.param();
    const body = await c.req.json().catch(() => null);
    if (!isStringArray(body?.inputIds)) return c.json({ error: "expected 'inputIds'" }, 400);
    const found = await entry(db, pid, sid);
    if (!found) return c.json({ error: "no such stage in this project's pipeline" }, 404);
    if (!found.carried) return c.json({ error: "the stage isn't waiting to be kept or dropped" }, 409);
    const before = await db
      .prepare("SELECT COUNT(*) AS n FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id WHERE e.project_id = ? AND e.position < ? AND (s.status != 'done' OR e.carried = 1)")
      .bind(pid, found.position)
      .first<{ n: number }>();
    if ((before?.n ?? 0) > 0) return c.json({ error: "the stages before it aren't all done" }, 409);
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
    const now = await contentOf(
      `SELECT item, type, COALESCE(content_sha256, recipe_key) AS k FROM outputs WHERE id IN (${ids.map(() => "?").join(", ") || "NULL"})`,
      ids,
    );
    const kept = read === now;
    const iso = new Date().toISOString();
    await db.batch(
      kept
        ? [db.prepare("UPDATE pipeline_entries SET carried = 0 WHERE project_id = ? AND position = ?").bind(pid, found.position)]
        : [
            ...(await rewriteFrom(db, pid, found.position, [], found.position, iso)),
            db
              .prepare(
                "INSERT INTO dropped_stages (project_id, after_stage_id, stage_id, step, dropped_at) SELECT ?, stage_id, ?, ?, ? FROM pipeline_entries WHERE project_id = ? AND position = ?",
              )
              .bind(pid, sid, found.stage.step, iso, pid, found.position - 1),
            touchProject(db, pid, iso),
          ],
    );
    return c.json({ kept, pipeline: await readPipeline(db, pid) });
  });

  // Drops a manual stage, WIP or finished (docs/overview.md §5.5): its entry goes, and the stages after it move up and are
  // replaced. The stage's row and outputs stay, like a replaced stage's.
  app.post("/api/projects/:pid/stages/:sid/drop", async (c) => {
    const db = c.env.DB;
    const { pid, sid } = c.req.param();
    const found = await entry(db, pid, sid);
    if (!found) return c.json({ error: "no such stage in this project's pipeline" }, 404);
    const { stage, position } = found;
    if (!isManual(stage.step)) return c.json({ error: "only stages outside the recipe can be dropped" }, 409);
    const now = new Date();
    if (await anyRunning(db, pid, now.getTime())) return c.json({ error: "a stage is running" }, 409);
    const iso = now.toISOString();
    await db.batch([...(await rewriteFrom(db, pid, position, [], position, iso)), touchProject(db, pid, iso)]);
    return c.json(await readPipeline(db, pid));
  });

  // Dismisses the card of a dropped stage (docs/overview.md §5.5).
  app.delete("/api/projects/:pid/dropped/:id", async (c) => {
    const db = c.env.DB;
    const { pid, id } = c.req.param();
    const result = await db
      .prepare("DELETE FROM dropped_stages WHERE id = ? AND project_id = ? AND project_id IN (SELECT id FROM projects WHERE deleted_at IS NULL)")
      .bind(Number(id), pid)
      .run();
    if (!result.meta.changes) return c.json({ error: "no such card in this project" }, 404);
    return c.json(await readPipeline(db, pid));
  });
}

// How long an item took and what it found in the caches (migration 0021), as the browser measures it.
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
