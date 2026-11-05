import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getPlatformProxy } from "wrangler";
import app from "./index.ts";
import { costOf } from "./llm/prices.ts";
import { listedPrice } from "./llm/models.ts";
import { MODEL_LIST } from "./llm/modelList.ts";

// The LLM endpoints against Wrangler's local R2 and D1, kept in memory, with the fake provider (llm/fake.ts).
const workerDir = join(import.meta.dirname, "..");
let platform: Awaited<ReturnType<typeof getPlatformProxy<Env>>>;
let env: Env;
// The names migration 0024 gave the configs that had none.
let migratedNames: Record<string, unknown>[];

before(async () => {
  platform = await getPlatformProxy<Env>({ configPath: join(workerDir, "wrangler.jsonc"), persist: false });
  env = platform.env;
  const migrationsDir = join(workerDir, "migrations");
  for (const file of readdirSync(migrationsDir).sort()) {
    if (file.startsWith("0024_")) {
      // Configs from before names were required: two alike without a name, one without an effort, one deleted.
      await env.DB.exec(
        withoutComments(`
          INSERT INTO model_configs (id, name, provider, model, effort, params_json, secrets_json, free_tier, created_at) VALUES ('m1', NULL, 'fake-dev', 'fake-model', 'high', '{}', '{}', 0, '2026-10-01T00:00:00.000Z');
          INSERT INTO model_configs (id, name, provider, model, effort, params_json, secrets_json, free_tier, created_at) VALUES ('m2', ' ', 'fake-dev', 'fake-model', 'high', '{}', '{}', 0, '2026-10-02T00:00:00.000Z');
          INSERT INTO model_configs (id, name, provider, model, effort, params_json, secrets_json, free_tier, created_at) VALUES ('m3', NULL, 'fake-dev', 'fake-model', NULL, '{}', '{}', 0, '2026-10-03T00:00:00.000Z');
          INSERT INTO model_configs (id, name, provider, model, effort, params_json, secrets_json, free_tier, created_at, deleted_at) VALUES ('m4', NULL, 'fake-dev', 'fake-model', 'high', '{}', '{}', 0, '2026-09-01T00:00:00.000Z', '2026-09-02T00:00:00.000Z');
        `),
      );
    }
    await env.DB.exec(withoutComments(readFileSync(join(migrationsDir, file), "utf8")));
  }
  migratedNames = (
    await env.DB.prepare("SELECT id, name, provider, model_id, model_string, family, pricing_kind FROM model_configs WHERE id LIKE 'm%' ORDER BY id").all()
  ).results;
});

beforeEach(async () => {
  await env.DB.exec(
    "DELETE FROM dropped_stages; DELETE FROM llm_calls; DELETE FROM output_inputs; DELETE FROM stage_inputs; DELETE FROM outputs; DELETE FROM pipeline_entries; DELETE FROM stages; DELETE FROM projects; DELETE FROM settings; DELETE FROM model_configs;",
  );
});

after(async () => {
  await platform.dispose();
});

function withoutComments(sql: string): string {
  return sql.replace(/--.*$/gm, "").replace(/\s+/g, " ").replace(/; /g, ";\n");
}

function send(path: string, body?: unknown, method = "POST") {
  return app.request(
    path,
    { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) },
    env,
  );
}

async function json<T = Record<string, unknown>>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

// The fake provider for development by default: "fake-model", a model added by hand priced as the listed fake model,
// whose prices on "fake-dev" are made up, so costs and the cap can be tested. `model` is a model string added by hand,
// `freeTier` the pricing "free".
function configBody(fields: Record<string, unknown> = {}): Record<string, unknown> {
  const { model, freeTier, ...rest } = fields;
  const body: Record<string, unknown> = {
    provider: "fake-dev",
    modelString: model ?? "fake-model",
    family: "fake",
    effort: "high",
    pricing: freeTier ? { kind: "free" } : { kind: "list", reference: "fake" },
    ...rest,
  };
  if (body.modelId) delete body.modelString, delete body.family;
  return body;
}

async function modelConfig(fields: Record<string, unknown> = {}): Promise<Record<string, any>> {
  const response = await send("/api/model-configs", configBody(fields));
  assert.equal(response.status, 201, await response.clone().text());
  return json(response);
}

// A project whose rasterize stage is running with the given model config, ready to make calls.
async function runningStage(modelConfigId: string | null): Promise<{ projectId: string; stageId: string }> {
  const form = new FormData();
  const pdf = new TextEncoder().encode(`pdf ${Math.random()}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", pdf));
  const sha256 = [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
  form.append("pdf", new File([pdf], "score.pdf"));
  form.append("sha256", sha256);
  const project = await json<{ id: string }>(await app.request("/api/projects", { method: "POST", body: form }, env));
  const { stages } = await json<{ stages: { id: string }[] }>(await app.request(`/api/projects/${project.id}/pipeline`, {}, env));
  const stageId = stages[1].id;
  const started = await send(`/api/projects/${project.id}/stages/${stageId}/start`, {
    stepVersion: 1,
    config: {},
    stageKey: crypto.randomUUID().replace(/-/g, "").repeat(2),
    pageCount: 1,
    inputIds: [],
    modelConfigId,
  });
  assert.equal(started.status, 200, await started.clone().text());
  return { projectId: project.id, stageId };
}

const PNG = btoa("not really a png");
const RECIPE_KEY = "ab".repeat(32);

function request(question = "How many systems?", image: { recipeKey: string; base64?: string } = { recipeKey: RECIPE_KEY, base64: PNG }) {
  return {
    system: "You find systems.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            recipeKey: image.recipeKey,
            ...(image.base64 === undefined ? {} : { image: { mediaType: "image/png", base64: image.base64 } }),
          },
          { type: "text", text: question },
        ],
      },
    ],
    jsonSchema: {
      type: "object",
      properties: { systems: { type: "array", items: { type: "object" } }, flagged: { type: "boolean" } },
      required: ["systems", "flagged"],
    },
  };
}

function call(stage: { projectId: string; stageId: string }, body: unknown = request()) {
  return send(`/api/projects/${stage.projectId}/stages/${stage.stageId}/llm`, { request: body });
}

async function calls() {
  return (await env.DB.prepare("SELECT * FROM llm_calls ORDER BY started_at").all<Record<string, unknown>>()).results;
}

test("prices come from the list; a cost is tokens times prices", () => {
  const price = listedPrice(MODEL_LIST, "claude-opus-5-5", "anthropic", { region: "", routing: null })!;
  assert.deepEqual(price, { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 });
  // 10,000 in, 2,000 out, 1,000 cache reads, 1,000 cache writes.
  assert.equal(costOf({ inputTokens: 10_000, outputTokens: 2_000, cacheReadTokens: 1_000, cacheWriteTokens: 1_000 }, price), 0.0852);
});

test("model configs: a listed model or one added by hand, at a place of its provider, priced; never edited, deleted by marking", async () => {
  const refused = async (body: Record<string, unknown>, pattern: RegExp) => {
    const response = await send("/api/model-configs", body);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.match((await json<{ error: string }>(response)).error, pattern);
  };
  const opus = { provider: "anthropic", modelId: "claude-opus-5-5", pricing: { kind: "list" }, secrets: { apiKey: "ANTHROPIC_KEY" } };
  await refused({ ...opus, secrets: undefined }, /'secrets' must name apiKey/);
  await refused({ ...opus, modelString: "claude-opus-5-5", family: "claude" }, /not both/);
  await refused({ ...opus, modelId: "claude-opus-9" }, /a model of the list/);
  await refused({ ...opus, provider: "ai-studio" }, /isn't offered on AI Studio/);
  await refused({ ...opus, region: "eu-central-1" }, /no region eu-central-1/);
  await refused({ ...opus, pricing: { kind: "list", reference: "claude-sonnet-5-5" } }, /priced as itself/);
  await refused({ ...opus, pricing: { kind: "cheap" } }, /'pricing'/);
  await refused({ ...opus, project: "p" }, /Vertex AI only/);
  await refused({ ...opus, effort: "extreme" }, /'effort'/);
  // Bedrock: a region and a routing the list has, and a price there.
  const bedrock = { provider: "bedrock", modelId: "claude-opus-5-5", pricing: { kind: "list" }, secrets: { apiKey: "BEDROCK_KEY" } };
  await refused(bedrock, /no region ""/);
  await refused({ ...bedrock, region: "eu-central-1", routing: "in-region" }, /no region eu-central-1 with in-region routing/);
  await refused({ ...bedrock, modelId: "claude-fable-5-1", region: "eu-central-1", routing: "geographic" }, /no price for this model there/);
  // A model added by hand: a family the app supports on the provider, priced as a listed model of that family.
  const added = { provider: "bedrock", modelString: "anthropic.claude-opus-6", family: "claude", region: "eu-central-1", routing: "global", secrets: { apiKey: "K" } };
  await refused({ ...added, family: "gemini", pricing: { kind: "unpriced" } }, /one the app supports on Bedrock: Claude/);
  await refused({ ...added, pricing: { kind: "list" } }, /'reference' must be one/);
  await refused({ ...added, pricing: { kind: "list", reference: "gemini-3-1-pro" } }, /a Claude model/);
  await refused({ ...added, pricing: { kind: "unpriced", reference: "claude-opus-5-5" } }, /only a config priced from the list/);

  const eu = await modelConfig({ ...bedrock, region: "eu-central-1", routing: "geographic", secrets: { accessKeyId: "AWS_KEY_ID", secretAccessKey: "AWS_SECRET" } });
  assert.deepEqual(
    { model: eu.model, family: eu.family, modelName: eu.modelName, region: eu.region, routing: eu.routing, pricing: eu.pricing, name: eu.name },
    {
      model: "anthropic.claude-opus-5-5",
      family: "claude",
      modelName: "Claude Opus 5.5",
      region: "eu-central-1",
      routing: "geographic",
      pricing: { kind: "list", reference: null },
      name: "Claude Opus 5.5 (Bedrock) · high",
    },
  );
  assert.deepEqual(eu.secrets, { accessKeyId: "AWS_KEY_ID", secretAccessKey: "AWS_SECRET" });
  const opus6 = await modelConfig({ ...added, pricing: { kind: "list", reference: "claude-opus-5-5" }, effort: null });
  assert.deepEqual([opus6.modelId, opus6.modelString, opus6.family, opus6.name], [null, "anthropic.claude-opus-6", "claude", "anthropic.claude-opus-6 (Bedrock)"]);
  assert.equal((await modelConfig({ ...added, pricing: { kind: "unpriced" }, name: "Unpriced" })).pricing.kind, "unpriced");
  // No editing (docs/llm.md, "Managing model configs").
  assert.equal((await send(`/api/model-configs/${eu.id}`, configBody(), "PUT")).status, 404);
  for (const id of [opus6.id, (await json<{ id: string; name: string }[]>(await app.request("/api/model-configs", {}, env))).find((c) => c.name === "Unpriced")!.id]) {
    assert.equal((await send(`/api/model-configs/${id}`, undefined, "DELETE")).status, 204);
  }
  assert.equal((await send(`/api/model-configs/${eu.id}`, undefined, "DELETE")).status, 204);
  assert.equal((await send(`/api/model-configs/${eu.id}`, undefined, "DELETE")).status, 404);
  assert.deepEqual(await json(await app.request("/api/model-configs", {}, env)), []);
  // A deleted config can still be read: stages and calls refer to it.
  assert.equal((await app.request(`/api/model-configs/${eu.id}`, {}, env)).status, 200);
});

test("model configs are named: the name given, else the model, its provider and effort, numbered when taken; a name taken is refused", async () => {
  assert.equal((await modelConfig()).name, "fake-model (Fake (dev)) · high");
  assert.equal((await modelConfig()).name, "fake-model (Fake (dev)) · high (1)");
  assert.equal((await modelConfig({ effort: null })).name, "fake-model (Fake (dev))");
  assert.equal((await modelConfig({ modelId: "fake", pricing: { kind: "list" } })).name, "Fake model (Fake (dev)) · high");
  assert.equal((await modelConfig({ name: "  Opus 5.5  " })).name, "Opus 5.5");
  const taken = await send("/api/model-configs", configBody({ name: "opus 5.5" }));
  assert.equal(taken.status, 409);
  assert.match((await json<{ error: string }>(taken)).error, /already exists/);
  assert.equal((await send("/api/model-configs", configBody({ name: "x".repeat(201) }))).status, 400);
  // A deleted config's name is free again.
  const opus = (await json<{ id: string; name: string }[]>(await app.request("/api/model-configs", {}, env))).find((c) => c.name === "Opus 5.5")!;
  assert.equal((await send(`/api/model-configs/${opus.id}`, undefined, "DELETE")).status, 204);
  assert.equal((await modelConfig({ name: "Opus 5.5" })).name, "Opus 5.5");
});

test("migration 0024 names the configs that had none, numbering repeats among those not deleted; 0027 converts them", () => {
  // 0027: an old model string is kept as a model added by hand, with its family; the free-tier mark is the pricing.
  const converted = { provider: "fake-dev", model_id: null, model_string: "fake-model", family: "fake", pricing_kind: "unpriced" };
  assert.deepEqual(migratedNames, [
    { id: "m1", name: "fake-model · high", ...converted },
    { id: "m2", name: "fake-model · high (1)", ...converted },
    { id: "m3", name: "fake-model", ...converted },
    { id: "m4", name: "fake-model · high", ...converted },
  ]);
});

test("settings: checked, with defaults", async () => {
  assert.deepEqual(await json(await app.request("/api/settings", {}, env)), { defaultModelConfigId: null, spendingCapUsd: 1, newProjectRunMode: "auto" });
  // There is always a cap.
  assert.equal((await send("/api/settings/spendingCapUsd", { value: null }, "PUT")).status, 400);
  assert.equal((await send("/api/settings/spendingCapUsd", { value: -1 }, "PUT")).status, 400);
  assert.equal((await send("/api/settings/nothing", { value: 1 }, "PUT")).status, 400);
  assert.equal((await send("/api/settings/defaultModelConfigId", { value: "missing" }, "PUT")).status, 404);
  const settings = await json(await send("/api/settings/spendingCapUsd", { value: 1.5 }, "PUT"));
  assert.equal(settings.spendingCapUsd, 1.5);
});

test("a call is made, recorded with its tokens and cost, and an identical one is served from the record", async () => {
  await send("/api/settings/spendingCapUsd", { value: 1 }, "PUT");
  const config = await modelConfig();
  const stage = await runningStage(config.id);

  const first = await json(await call(stage));
  assert.equal(first.status, "ok");
  assert.equal(first.cached, false);
  assert.deepEqual(first.json, { systems: [], flagged: false });
  assert.ok((first.costUsd as number) > 0);
  let rows = await calls();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "ok");
  assert.equal(rows[0].cost_usd, first.costUsd);
  assert.equal(rows[0].response_model, "fake-model");
  // The prices it was billed at, borrowed from the listed fake model.
  assert.deepEqual(JSON.parse(rows[0].price_json as string), { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25, asOf: MODEL_LIST.asOf, borrowedFrom: "fake" });
  // The request is recorded without the image, which is replaced by its recipe key and hash.
  const recorded = await (await app.request(`/api/content/${rows[0].request_sha256}`, {}, env)).text();
  assert.ok(!recorded.includes(PNG) && recorded.includes('"sha256"') && recorded.includes(RECIPE_KEY));

  // The stage shows its model config and what its calls cost.
  const { stages } = await json<{ stages: Record<string, unknown>[] }>(
    await app.request(`/api/projects/${stage.projectId}/pipeline`, {}, env),
  );
  assert.deepEqual(stages[1].modelConfig, { name: "fake-model (Fake (dev)) · high", model: "fake-model", deleted: false });
  assert.equal(stages[1].costUsd, first.costUsd);

  // The same request again, from another stage with another config of the same model: served, nothing paid.
  const other = await runningStage((await modelConfig({ name: "Same model, other config" })).id);
  const second = await json(await call(other));
  assert.equal(second.cached, true);
  assert.equal(second.callId, first.callId);
  assert.equal(second.costUsd, 0);
  assert.deepEqual(second.json, first.json);
  rows = await calls();
  assert.equal(rows.length, 1);

  // Another effort is another request.
  const effort = await runningStage((await modelConfig({ effort: "low" })).id);
  assert.equal((await json(await call(effort))).cached, false);
});

test("the fake provider that ships with the app costs nothing, free tier or not", async () => {
  await send("/api/settings/spendingCapUsd", { value: 1 }, "PUT");
  const stage = await runningStage((await modelConfig({ provider: "fake" })).id);
  const answer = await json(await call(stage));
  assert.equal(answer.status, "ok");
  assert.equal(answer.costUsd, 0);
  const [row] = await calls();
  assert.ok((row.input_tokens as number) > 0);
  assert.equal(row.cost_usd, 0);
});

test("failed answers are recorded but never served from the record", async () => {
  await send("/api/settings/spendingCapUsd", { value: 1 }, "PUT");
  for (const [model, status] of [
    ["fake-error", "error"],
    ["fake-refusal", "refused"],
    ["fake-cut-off", "cut_off"],
    ["fake-unparseable", "unparseable"],
    ["fake-other-model", "error"],
  ]) {
    const stage = await runningStage((await modelConfig({ model })).id);
    const first = await json(await call(stage));
    assert.equal(first.status, status, model);
    assert.ok(first.error, model);
    const again = await json(await call(stage));
    assert.equal(again.cached, false, model);
    assert.notEqual(again.callId, first.callId, model);
  }
  const rows = await calls();
  assert.equal(rows.length, 10);
  assert.ok(rows.every((r) => r.status !== "ok"));
  // An answer that isn't JSON, or from another model, was billed: its tokens and cost are recorded. A thrown error has
  // none, but its kind and HTTP status.
  const billed = rows.filter((r) => r.status === "unparseable" || r.error_kind === "unexpected_model");
  assert.equal(billed.length, 4);
  assert.ok(billed.every((r) => (r.cost_usd as number) > 0 && (r.output_tokens as number) > 0 && r.http_status === null));
  const thrown = rows.filter((r) => r.status === "error" && r.error_kind !== "unexpected_model");
  assert.ok(thrown.length === 2 && thrown.every((r) => r.cost_usd === null && r.error_kind === "server" && r.http_status === 500));
  assert.ok(rows.filter((r) => r.status !== "error").every((r) => r.error_kind === null && r.http_status === null));
});

test("an answer the stage can't use is marked so, and isn't served again", async () => {
  await send("/api/settings/spendingCapUsd", { value: 1 }, "PUT");
  const stage = await runningStage((await modelConfig()).id);
  const first = await json(await call(stage));
  const mark = (reason: unknown) =>
    send(`/api/projects/${stage.projectId}/stages/${stage.stageId}/llm-calls/${first.callId}/unusable`, { reason });
  assert.equal((await mark("")).status, 400);
  assert.equal((await mark("Line 3: unknown note name")).status, 204);
  assert.equal((await mark("again")).status, 404);
  const [row] = await calls();
  assert.equal(row.status, "unparseable");
  assert.equal(row.error, "Line 3: unknown note name");
  assert.ok((row.cost_usd as number) > 0);
  const again = await json(await call(stage));
  assert.equal(again.cached, false);
});

test("the spending cap stops new calls, but not answers already paid for; free-tier calls neither count nor stop", async () => {
  const config = await modelConfig();
  const stage = await runningStage(config.id);
  await send("/api/settings/spendingCapUsd", { value: 0.0001 }, "PUT");
  assert.equal((await json(await call(stage))).status, "ok"); // under the cap when it started; overshoots it
  const capped = await call(stage, request("Another question"));
  assert.equal(capped.status, 429);
  assert.equal((await json(capped)).code, "spending_cap");
  // The first request again: served from the record although the cap is reached.
  assert.equal((await json(await call(stage))).cached, true);

  const free = await runningStage((await modelConfig({ freeTier: true, model: "fake-free" })).id);
  const answer = await json(await call(free, request("Free question")));
  assert.equal(answer.status, "ok");
  assert.equal(answer.costUsd, 0);
});

test("free-tier configs are always allowed: without a spending cap, and without a known price", async () => {
  const free = await runningStage((await modelConfig({ freeTier: true })).id);
  assert.equal((await json(await call(free))).status, "ok");
  const unpriced = await runningStage(
    (await modelConfig({ freeTier: true, provider: "ai-studio", model: "gemini-x", family: "gemini", secrets: { apiKey: "NO_SUCH_SECRET" } })).id,
  );
  // It gets as far as the secrets: nothing about money stops it.
  assert.equal((await json(await call(unpriced))).code, "missing_secret");
  const [row] = await calls();
  assert.equal(row.cost_usd, 0);
  assert.equal(row.price_json, null);
});

test("a call needs a running stage with a model config, a price, and the config's secrets", async () => {
  await send("/api/settings/spendingCapUsd", { value: 1 }, "PUT");
  const without = await runningStage(null);
  assert.equal((await json(await call(without))).code, "no_model_config");
  // A listed model at a place the list (no longer) has a price for.
  await env.DB.prepare(
    "INSERT INTO model_configs (id, name, provider, model_id, region, routing, secrets_json, pricing_kind, created_at) VALUES ('no-price', 'Fable EU', 'bedrock', 'claude-fable-5-1', 'eu-central-1', 'geographic', '{\"apiKey\":\"K\"}', 'list', '2026-10-01')",
  ).run();
  const noPrice = await json(await call(await runningStage("no-price")));
  assert.equal(noPrice.code, "no_price");
  assert.match(noPrice.error as string, /no price for "Fable EU" there/);
  // A listed model the list doesn't have at all.
  await env.DB.prepare(
    "INSERT INTO model_configs (id, name, provider, model_id, secrets_json, pricing_kind, created_at) VALUES ('gone', 'Gone', 'anthropic', 'claude-gone', '{\"apiKey\":\"K\"}', 'list', '2026-10-01')",
  ).run();
  assert.equal((await json(await call(await runningStage("gone")))).code, "unknown_model");
  const unset = await runningStage(
    (await modelConfig({ provider: "anthropic", modelId: "claude-opus-5-5", pricing: { kind: "list" }, secrets: { apiKey: "NO_SUCH_SECRET" } })).id,
  );
  const missing = await json(await call(unset));
  assert.equal(missing.code, "missing_secret");
  // Said so that the user knows what to do: which config, which secret, where secrets are set.
  assert.equal(
    missing.error,
    'The model config "Claude Opus 5.5 (Anthropic) · high" needs the secret NO_SUCH_SECRET, which isn\'t set. Set it where the app\'s secrets are kept (Settings, "Secrets"), then retry.',
  );
  assert.equal((await calls()).length, 0);
  assert.equal((await call(without, { messages: [] })).status, 400);
});

test("unpriced calls are made and recorded with their tokens but no cost, and the spending cap doesn't stop them", async () => {
  await send("/api/settings/spendingCapUsd", { value: 0.0001 }, "PUT");
  await call(await runningStage((await modelConfig()).id)); // reaches the cap
  const unpriced = await runningStage((await modelConfig({ name: "Unpriced", pricing: { kind: "unpriced" } })).id);
  const answer = await json(await call(unpriced, request("Unpriced question")));
  assert.equal(answer.status, "ok");
  assert.equal(answer.costUsd, null);
  const row = (await calls()).find((r) => r.id === answer.callId)!;
  assert.ok((row.input_tokens as number) > 0);
  assert.equal(row.cost_usd, null);
  assert.equal(row.price_json, null);
});

test("a stage whose model config was deleted can't start, says why, and its card can show it", async () => {
  const config = await modelConfig({ name: "Opus EU" });
  await send("/api/settings/defaultModelConfigId", { value: config.id }, "PUT");
  const form = new FormData();
  const pdf = new TextEncoder().encode(`pdf ${Math.random()}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", pdf));
  form.append("pdf", new File([pdf], "deleted.pdf"));
  form.append("sha256", [...digest].map((b) => b.toString(16).padStart(2, "0")).join(""));
  const project = await json<{ id: string }>(await app.request("/api/projects", { method: "POST", body: form }, env));
  await send("/api/settings/defaultModelConfigId", { value: null }, "PUT");
  assert.equal((await send(`/api/model-configs/${config.id}`, undefined, "DELETE")).status, 204);
  const { stages } = await json<{ stages: { id: string; modelConfig: unknown }[] }>(await app.request(`/api/projects/${project.id}/pipeline`, {}, env));
  // The pipeline says so for every stage that names it, so that the card shows it.
  assert.deepEqual(stages[3].modelConfig, { name: "Opus EU", model: "fake-model", deleted: true });
  const refused = await send(`/api/projects/${project.id}/stages/${stages[3].id}/start`, {
    stepVersion: 1,
    config: { modelConfigId: config.id },
    stageKey: "e".repeat(64),
    pageCount: 1,
    inputIds: [],
    modelConfigId: config.id,
  });
  assert.equal(refused.status, 409);
  assert.deepEqual(await json(refused), { error: 'its model config, "Opus EU", was deleted.', code: "deleted_model_config" });
});


test("a model config deleted while its stage runs: the next request is refused, the cache included", async () => {
  const config = await modelConfig({ name: "Opus EU" });
  const stage = await runningStage(config.id);
  assert.equal((await json(await call(stage))).cached, false);
  assert.equal((await send(`/api/model-configs/${config.id}`, undefined, "DELETE")).status, 204);
  const refused = await call(stage);
  assert.equal(refused.status, 409);
  assert.deepEqual(await json(refused), {
    error: 'The model config "Opus EU" was deleted while the stage ran. Pick another with "Change config" in the stage\'s ⋮, then retry.',
    code: "deleted_model_config",
  });
  assert.equal((await calls()).length, 1);
});

test("the default model config can't be deleted until another is the default", async () => {
  const first = await modelConfig({ name: "First" });
  const second = await modelConfig({ name: "Second" });
  await send("/api/settings/defaultModelConfigId", { value: first.id }, "PUT");
  const refused = await send(`/api/model-configs/${first.id}`, undefined, "DELETE");
  assert.equal(refused.status, 409);
  assert.deepEqual(await json(refused), {
    error: '"First" is the default model config: make another config the default first.',
    code: "default_model_config",
  });
  assert.equal((await json(await app.request(`/api/model-configs/${first.id}`, {}, env))).deletedAt, null);
  await send("/api/settings/defaultModelConfigId", { value: second.id }, "PUT");
  assert.equal((await send(`/api/model-configs/${first.id}`, undefined, "DELETE")).status, 204);
});

test("cache marks aren't part of the request key, and are limited to 4", async () => {
  const config = await modelConfig();
  const stage = await runningStage(config.id);
  const first = await json(await call(stage));
  assert.equal(first.cached, false);

  // The same request with marks: served from the first, since the marks change the price, not the answer.
  const marked = request();
  for (const part of marked.messages[0].content) (part as { cacheUpTo?: true }).cacheUpTo = true;
  const served = await json(await call(stage, marked));
  assert.equal(served.cached, true);
  assert.equal(served.callId, first.callId);

  // Only true, and at most 4.
  const wrong = request();
  (wrong.messages[0].content[1] as { cacheUpTo?: unknown }).cacheUpTo = false;
  assert.equal((await call(stage, wrong)).status, 400);
  const tooMany = request();
  tooMany.messages[0].content = Array.from({ length: 5 }, (_, i) => ({ type: "text" as const, text: `part ${i}`, cacheUpTo: true as const }));
  assert.equal((await call(stage, tooMany)).status, 400);
});

test("requests are keyed by the images' recipe keys: a cached call is found before the images are made", async () => {
  await send("/api/settings/spendingCapUsd", { value: 1 }, "PUT");
  const config = await modelConfig();
  const stage = await runningStage(config.id);

  // Not cached, and no images: the browser is asked for them, and nothing is recorded.
  const lookup = await call(stage, request("How many systems?", { recipeKey: RECIPE_KEY }));
  assert.equal(lookup.status, 200);
  assert.deepEqual(await json(lookup), { imagesNeeded: true });
  assert.equal((await calls()).length, 0);

  const first = await json(await call(stage));
  assert.equal(first.cached, false);

  // The same recipe key without its image: served.
  const served = await json(await call(stage, request("How many systems?", { recipeKey: RECIPE_KEY })));
  assert.equal(served.cached, true);
  assert.equal(served.callId, first.callId);

  // Other pixels from the same recipe (another device): the same request, served.
  const otherPixels = await json(await call(stage, request("How many systems?", { recipeKey: RECIPE_KEY, base64: btoa("other pixels") })));
  assert.equal(otherPixels.cached, true);

  // The same pixels from another recipe: another request.
  const otherRecipe = await json(await call(stage, request("How many systems?", { recipeKey: "cd".repeat(32), base64: PNG })));
  assert.equal(otherRecipe.cached, false);

  // An image without a recipe key is refused.
  const bad = request();
  delete (bad.messages[0].content[0] as { recipeKey?: string }).recipeKey;
  assert.equal((await call(stage, bad)).status, 400);
});
