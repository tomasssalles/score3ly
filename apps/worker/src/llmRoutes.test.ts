import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getPlatformProxy } from "wrangler";
import app from "./index.ts";
import { costOf } from "./llm/prices.ts";
import { listedPrice, type ModelList } from "./llm/models.ts";
import { convertAddedConfigs, modelOptions, secretNames, unsupportedOf, type ModelConfigRow, type ModelOptions } from "./llmRoutes.ts";
import { MODEL_LIST } from "./llm/modelList.ts";

// The LLM endpoints against Wrangler's local R2 and D1, kept in memory, with the fake provider (llm/fake.ts).
const workerDir = join(import.meta.dirname, "..");
let platform: Awaited<ReturnType<typeof getPlatformProxy<Env>>>;
let env: Env;

before(async () => {
  platform = await getPlatformProxy<Env>({ configPath: join(workerDir, "wrangler.jsonc"), persist: false });
  env = platform.env;
  const migrationsDir = join(workerDir, "migrations");
  for (const file of readdirSync(migrationsDir).sort()) {
    await env.DB.exec(withoutComments(readFileSync(join(migrationsDir, file), "utf8")));
  }
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
  await refused({ ...bedrock, modelId: "claude-fable-5-1", region: "eu-central-1", routing: "geographic" }, /doesn't support Claude Fable 5\.1 on Bedrock there/);
  // However it is priced: a listed model only where the list has its price.
  await refused({ ...bedrock, modelId: "claude-fable-5-1", region: "eu-central-1", routing: "geographic", pricing: { kind: "free" } }, /doesn't support/);
  // A model added by hand: a family the app supports on the provider, priced as a listed model of that family.
  const added = { provider: "bedrock", modelString: "anthropic.claude-opus-6", family: "claude", region: "eu-central-1", routing: "global", secrets: { apiKey: "K" } };
  await refused({ ...added, family: "gemini", pricing: { kind: "unpriced" } }, /one the app supports on Bedrock: Claude/);
  await refused({ ...added, pricing: { kind: "list" } }, /'reference' must be one/);
  await refused({ ...added, pricing: { kind: "list", reference: "gemini-3-1-pro" } }, /a Claude model/);
  await refused({ ...added, pricing: { kind: "unpriced", reference: "claude-opus-5-5" } }, /only a config priced from the list/);
  // A string the list has for the provider is picked from the list, not added by hand.
  await refused({ ...added, modelString: "anthropic.claude-opus-5-5", pricing: { kind: "unpriced" } }, /Claude Opus 5\.5 is in the app's list: pick it there/);

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
  assert.equal((await modelConfig({ pricing: { kind: "unpriced" } })).name, "fake-model (Fake (dev)) · high (1)");
  assert.equal((await modelConfig({ effort: null })).name, "fake-model (Fake (dev))");
  assert.equal((await modelConfig({ modelId: "fake", pricing: { kind: "list" } })).name, "Fake model (Fake (dev)) · high");
  assert.equal((await modelConfig({ name: "  Opus 5.5  ", model: "fake-opus" })).name, "Opus 5.5");
  const taken = await send("/api/model-configs", configBody({ name: "opus 5.5", model: "fake-other" }));
  assert.equal(taken.status, 409);
  assert.match((await json<{ error: string }>(taken)).error, /already exists/);
  assert.equal((await send("/api/model-configs", configBody({ name: "x".repeat(201) }))).status, 400);
  // A deleted config's name is free again.
  const opus = (await json<{ id: string; name: string }[]>(await app.request("/api/model-configs", {}, env))).find((c) => c.name === "Opus 5.5")!;
  assert.equal((await send(`/api/model-configs/${opus.id}`, undefined, "DELETE")).status, 204);
  assert.equal((await modelConfig({ name: "Opus 5.5", model: "fake-opus" })).name, "Opus 5.5");
});

test("settings: checked, with defaults", async () => {
  assert.deepEqual(await json(await app.request("/api/settings", {}, env)), { defaultModelConfigId: null, spendingCapUsd: 1, newProjectRunMode: "auto" });
  // There is always a cap.
  assert.equal((await send("/api/settings/spendingCapUsd", { value: null }, "PUT")).status, 400);
  assert.equal((await send("/api/settings/spendingCapUsd", { value: -1 }, "PUT")).status, 400);
  assert.equal((await send("/api/settings/nothing", { value: 1 }, "PUT")).status, 400);
  assert.equal((await send("/api/settings/defaultModelConfigId", { value: "missing" }, "PUT")).status, 404);
  // There is always a default: it can't be removed.
  assert.equal((await send("/api/settings/defaultModelConfigId", { value: null }, "PUT")).status, 400);
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
  assert.deepEqual(stages[1].modelConfig, { name: "fake-model (Fake (dev)) · high", model: "fake-model", deleted: false, unsupported: false });
  assert.equal(stages[1].costUsd, first.costUsd);

  // The same request again, from another stage with another config of the same model: served, nothing paid.
  const other = await runningStage((await modelConfig({ name: "Same model, other config", pricing: { kind: "unpriced" } })).id);
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

test("a call needs a running stage with a model config the app supports, and the config's secrets", async () => {
  await send("/api/settings/spendingCapUsd", { value: 1 }, "PUT");
  const without = await runningStage(null);
  assert.equal((await json(await call(without))).code, "no_model_config");
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
  // A config the app no longer supports (its row left the list's prices) while its stage runs: refused, the cache too.
  const opus = await modelConfig({ name: "Opus", provider: "anthropic", modelId: "claude-opus-5-5", pricing: { kind: "list" }, secrets: { apiKey: "K" } });
  const stage = await runningStage(opus.id);
  await env.DB.prepare("UPDATE model_configs SET model_id = 'claude-gone' WHERE id = ?").bind(opus.id).run();
  const refused = await json(await call(stage));
  assert.equal(refused.code, "unsupported_model_config");
  assert.equal(refused.error, 'The model config "Opus" uses claude-gone on Anthropic, which the app no longer supports. Pick another with "Change config" in the stage\'s ⋮, then retry.');
  assert.equal((await calls()).length, 0);
  assert.equal((await call(without, { messages: [] })).status, 400);
});

test("a config the app no longer supports: marked, its stages can't start, it can't be picked or be the default", async () => {
  // Listed at a place the list has no price for (any more): Fable 5.1 on Bedrock in the EU, routed within the EU.
  await env.DB.prepare(
    "INSERT INTO model_configs (id, name, provider, model_id, region, routing, secrets_json, pricing_kind, created_at) VALUES ('fable-eu', 'Fable EU', 'bedrock', 'claude-fable-5-1', 'eu-central-1', 'geographic', '{\"apiKey\":\"K\"}', 'list', '2026-10-01')",
  ).run();
  const config = await json(await app.request("/api/model-configs/fable-eu", {}, env));
  assert.equal(config.unsupported, "uses Claude Fable 5.1 on Bedrock in eu-central-1 (geographic routing), which the app no longer supports");
  assert.equal((await send("/api/settings/defaultModelConfigId", { value: "fable-eu" }, "PUT")).status, 400);
  // Its stage shows it, and can't start: the run stops there.
  const project = await runningStage(null);
  const { stages } = await json<{ stages: { id: string; modelConfig: unknown }[] }>(await app.request(`/api/projects/${project.projectId}/pipeline`, {}, env));
  const layout = stages[3];
  const picked = await send(`/api/projects/${project.projectId}/stages/${layout.id}/config`, { config: { modelConfigId: "fable-eu" } }, "PUT");
  assert.equal(picked.status, 400);
  await env.DB.prepare("UPDATE stages SET config_json = ?, model_config_id = 'fable-eu' WHERE id = ?").bind(JSON.stringify({ modelConfigId: "fable-eu" }), layout.id).run();
  const after = await json<{ stages: { id: string; modelConfig: unknown }[] }>(await app.request(`/api/projects/${project.projectId}/pipeline`, {}, env));
  assert.deepEqual(after.stages[3].modelConfig, { name: "Fable EU", model: "anthropic.claude-fable-5-1", deleted: false, unsupported: true });
  const start = await send(`/api/projects/${project.projectId}/stages/${layout.id}/start`, {
    stepVersion: 1,
    config: { modelConfigId: "fable-eu" },
    stageKey: "f".repeat(64),
    pageCount: 1,
    inputIds: [],
    modelConfigId: "fable-eu",
  });
  assert.equal(start.status, 409);
  assert.deepEqual(await json(start), {
    error: 'its model config, "Fable EU", uses Claude Fable 5.1 on Bedrock in eu-central-1 (geographic routing), which the app no longer supports.',
    code: "unsupported_model_config",
  });
  // A model added by hand priced as a listed one where that one has no price: the same.
  await env.DB.prepare(
    "INSERT INTO model_configs (id, name, provider, model_string, family, region, routing, secrets_json, pricing_kind, pricing_reference, created_at) VALUES ('new-eu', 'New EU', 'bedrock', 'anthropic.claude-new', 'claude', 'eu-central-1', 'geographic', '{\"apiKey\":\"K\"}', 'list', 'claude-fable-5-1', '2026-10-01')",
  ).run();
  assert.equal(
    (await json(await app.request("/api/model-configs/new-eu", {}, env))).unsupported,
    "is priced as Claude Fable 5.1 on Bedrock in eu-central-1 (geographic routing), which the app no longer has a price for",
  );
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
  await send("/api/settings/defaultModelConfigId", { value: (await modelConfig({ name: "Another", model: "fake-another" })).id }, "PUT");
  assert.equal((await send(`/api/model-configs/${config.id}`, undefined, "DELETE")).status, 204);
  const { stages } = await json<{ stages: { id: string; modelConfig: unknown }[] }>(await app.request(`/api/projects/${project.id}/pipeline`, {}, env));
  // The pipeline says so for every stage that names it, so that the card shows it.
  assert.deepEqual(stages[3].modelConfig, { name: "Opus EU", model: "fake-model", deleted: true, unsupported: false });
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
  const second = await modelConfig({ name: "Second", model: "fake-second" });
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

test("configs added by hand become listed ones when a new list has their string: priced from it, free staying free", async () => {
  const insert = (id: string, region: string, pricing: string, reference: string | null) =>
    env.DB.prepare(
      "INSERT INTO model_configs (id, name, provider, model_string, family, region, routing, secrets_json, pricing_kind, pricing_reference, created_at) VALUES (?, ?, 'bedrock', 'anthropic.claude-opus-6', 'claude', ?, 'global', '{}', ?, ?, '2026-10-01')",
    )
      .bind(id, id, region, pricing, reference)
      .run();
  await insert("priced-as", "eu-central-1", "list", "claude-opus-5-5");
  await insert("unpriced", "eu-central-1", "unpriced", null);
  await insert("free", "eu-central-1", "free", null);
  await insert("elsewhere", "us-east-1", "unpriced", null); // the new list has no price there
  await env.DB.prepare(
    "INSERT INTO model_configs (id, name, provider, model_string, family, region, secrets_json, pricing_kind, created_at) VALUES ('other', 'other', 'anthropic', 'claude-opus-7', 'claude', '', '{}', 'unpriced', '2026-10-01')",
  ).run();
  const opus6 = { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 };
  const list: ModelList = {
    ...MODEL_LIST,
    models: [...MODEL_LIST.models, { id: "claude-opus-6", name: "Claude Opus 6", family: "claude", strings: { bedrock: "anthropic.claude-opus-6" } }],
    prices: [...MODEL_LIST.prices, { model: "claude-opus-6", provider: "bedrock", region: "eu-central-1", routing: "global", price: opus6 }],
  };
  assert.equal(await convertAddedConfigs(env.DB, list), 4);
  assert.equal(await convertAddedConfigs(env.DB, list), 0); // once per list
  const rows = (await env.DB.prepare("SELECT * FROM model_configs ORDER BY id").all<ModelConfigRow>()).results;
  const shape = (r: ModelConfigRow) => [r.id, r.name, r.model_id, r.model_string, r.family, r.pricing_kind, r.pricing_reference];
  assert.deepEqual(rows.map(shape), [
    ["elsewhere", "elsewhere", "claude-opus-6", null, null, "list", null],
    ["free", "free", "claude-opus-6", null, null, "free", null],
    ["other", "other", null, "claude-opus-7", "claude", "unpriced", null],
    ["priced-as", "priced-as", "claude-opus-6", null, null, "list", null],
    ["unpriced", "unpriced", "claude-opus-6", null, null, "list", null],
  ]);
  assert.equal(unsupportedOf(rows[3], undefined, list), null);
  assert.equal(unsupportedOf(rows[0], undefined, list), "uses Claude Opus 6 on Bedrock in us-east-1 (global routing), which the app no longer supports");
});

test("the pickers' options: providers with their families, efforts, secrets and places; listed models where they have prices", async () => {
  const options = await json<ModelOptions>(await app.request("/api/models", {}, env));
  assert.deepEqual(options, modelOptions(MODEL_LIST));
  assert.equal(options.asOf, MODEL_LIST.asOf);
  const vertex = options.providers.find((p) => p.id === "vertex")!;
  assert.equal(vertex.name, "Vertex AI");
  assert.deepEqual(
    vertex.families.map((f) => [f.id, f.efforts.length, f.secrets]),
    [
      ["claude", 5, [["serviceAccount"]]],
      ["gemini", 3, [["serviceAccount"]]],
    ],
  );
  const bedrock = options.providers.find((p) => p.id === "bedrock")!;
  assert.deepEqual(bedrock.families[0].secrets, [["apiKey"], ["accessKeyId", "secretAccessKey"]]);
  assert.deepEqual(bedrock.places.find((p) => p.region === "eu-west-1" && p.routing === "geographic"), { region: "eu-west-1", routing: "geographic", geography: "EU" });

  // A list of the test's own: a retired model is left out, and a model only where it has prices.
  const P = { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 };
  const own = modelOptions({
    asOf: "2026-01-01",
    regions: [
      { provider: "anthropic", region: "", routings: null },
      { provider: "bedrock", region: "eu-west-1", routings: ["global", "in-region"] },
    ],
    models: [
      { id: "big", name: "Claude Big", family: "claude", strings: { anthropic: "claude-big", bedrock: "anthropic.claude-big" } },
      { id: "plain", name: "Claude Plain", family: "claude", strings: { bedrock: "anthropic.claude-plain" }, efforts: [] },
      { id: "old", name: "Claude Old", family: "claude", strings: { anthropic: "claude-old" }, retired: true },
    ],
    prices: [
      { model: "big", provider: "bedrock", region: "eu-west-1", routing: "in-region", price: P },
      { model: "plain", provider: "bedrock", region: "eu-west-1", routing: "global", price: P },
    ],
  });
  assert.equal(own.mock, false);
  assert.deepEqual(own.models, [
    // A model takes its family's efforts unless the list says otherwise: Claude Plain takes none.
    { id: "big", name: "Claude Big", family: "claude", efforts: ["low", "medium", "high", "xhigh", "max"], providers: { bedrock: { string: "anthropic.claude-big", places: [{ region: "eu-west-1", routing: "in-region", price: P }] } } },
    { id: "plain", name: "Claude Plain", family: "claude", efforts: [], providers: { bedrock: { string: "anthropic.claude-plain", places: [{ region: "eu-west-1", routing: "global", price: P }] } } },
  ]);
  assert.deepEqual(own.providers.find((p) => p.id === "bedrock")!.places, [
    { region: "eu-west-1", routing: "global" },
    { region: "eu-west-1", routing: "in-region" },
  ]);
});

test("the secrets' names: the Worker's text values, sorted, never a value; not its bindings", async () => {
  assert.deepEqual(secretNames({ ZED: "z", ANTHROPIC_KEY: "secret", DB: env.DB, PDFS: env.PDFS } as unknown as Env), ["ANTHROPIC_KEY", "ZED"]);
  const answer = await json<{ names: string[] }>(await app.request("/api/secrets", {}, { ...env, GEMINI_KEY: "secret" } as Env));
  assert.deepEqual(answer, { names: ["GEMINI_KEY"] });
});

test("a config with exactly the same values as another isn't created: the other is named, to offer renaming it", async () => {
  const first = await modelConfig({ name: "Claude" });
  const again = await send("/api/model-configs", configBody({ name: "Opus 5.5" }));
  assert.equal(again.status, 409);
  assert.deepEqual(await json(again), {
    error: 'A config with these settings already exists: "Claude".',
    code: "same_values",
    config: { id: first.id, name: "Claude" },
  });
  // Another effort is another config; the same secrets in another order are the same.
  assert.equal((await send("/api/model-configs", configBody({ effort: "low" }))).status, 201);
  const keys = { provider: "bedrock", modelId: "claude-opus-5-5", region: "eu-central-1", routing: "global", pricing: { kind: "list" } };
  await modelConfig({ ...keys, secrets: { accessKeyId: "ID", secretAccessKey: "SECRET" } });
  assert.equal((await send("/api/model-configs", configBody({ ...keys, secrets: { secretAccessKey: "SECRET", accessKeyId: "ID" } }))).status, 409);
});

test("a clone may replace its original: the original deleted, and the clone the default if the original was", async () => {
  const original = await modelConfig({ name: "Claude" });
  await send("/api/settings/defaultModelConfigId", { value: original.id }, "PUT");
  const clone = await modelConfig({ name: "Opus 5.5", effort: "max", replaces: original.id });
  assert.ok((await json(await app.request(`/api/model-configs/${original.id}`, {}, env))).deletedAt);
  assert.equal((await json(await app.request("/api/settings", {}, env))).defaultModelConfigId, clone.id);
  // A deleted original can't be replaced again.
  assert.equal((await send("/api/model-configs", configBody({ effort: "low", replaces: original.id }))).status, 404);
  // Its name is free again, its values too.
  assert.equal((await modelConfig({ name: "Claude" })).name, "Claude");
});

test("renaming a config: its name only, unique ignoring case among the configs that aren't deleted, its own case free", async () => {
  const a = await modelConfig({ name: "Claude" });
  await modelConfig({ name: "Other", effort: "low" });
  const rename = (id: string, name: unknown) => send(`/api/model-configs/${id}`, { name }, "PATCH");
  assert.equal((await rename(a.id, "  ")).status, 400);
  assert.equal((await rename(a.id, "x".repeat(201))).status, 400);
  assert.equal((await rename(a.id, "other")).status, 409);
  assert.equal((await rename("nope", "X")).status, 404);
  assert.equal((await json(await rename(a.id, "CLAUDE"))).name, "CLAUDE");
  const renamed = await json(await rename(a.id, " Opus 5.5 "));
  assert.deepEqual([renamed.name, renamed.effort], ["Opus 5.5", "high"]);
  assert.equal((await send(`/api/model-configs/${a.id}`, undefined, "DELETE")).status, 204);
  assert.equal((await rename(a.id, "Again")).status, 404); // a deleted config isn't renamed
});

// A config's test (docs/llm.md, "The settings page").

// An answer from Anthropic's API, as a stream of server-sent events.
function anthropicAnswer(text: string): Response {
  const events = [
    { type: "message_start", message: { id: "m", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 80, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } },
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } },
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 20 } },
    { type: "message_stop" },
  ];
  return new Response(events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join(""), { status: 200, headers: { "content-type": "text/event-stream" } });
}

test("a config's test is a real request, sent every time, recorded without a stage, counted towards the cap", async () => {
  await send("/api/settings/spendingCapUsd", { value: 1 }, "PUT");
  const fake = await modelConfig();
  assert.equal((await send(`/api/model-configs/${fake.id}/test`)).status, 400); // fake providers need no test

  const opus = await modelConfig({ provider: "anthropic", modelId: "claude-opus-5-5", pricing: { kind: "list" }, secrets: { apiKey: "TEST_ANTHROPIC_KEY" }, name: "Opus" });
  const missing = await send(`/api/model-configs/${opus.id}/test`);
  assert.equal(missing.status, 409);
  assert.equal((await json(missing)).code, "missing_secret");

  (env as unknown as Record<string, string>).TEST_ANTHROPIC_KEY = "sk-test";
  const realFetch = globalThis.fetch;
  const sent: unknown[] = [];
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)));
    return anthropicAnswer('{"colour":"black"}');
  }) as typeof fetch;
  try {
    for (let i = 0; i < 2; i++) {
      const response = await send(`/api/model-configs/${opus.id}/test`);
      assert.equal(response.status, 200, await response.clone().text());
      const answer = await json(response);
      assert.equal(answer.status, "ok");
      assert.equal(answer.answer, "black");
      assert.equal(answer.cached, false);
      assert.ok((answer.costUsd as number) > 0);
      assert.equal(typeof answer.durationMs, "number");
    }
  } finally {
    globalThis.fetch = realFetch;
    delete (env as unknown as Record<string, string>).TEST_ANTHROPIC_KEY;
  }
  assert.equal(sent.length, 2); // never served from the record
  const body = sent[0] as { messages: { content: { type: string }[] }[]; output_config?: unknown };
  assert.deepEqual(body.messages[0].content.map((c) => c.type), ["image", "text"]);
  const calls = (await env.DB.prepare("SELECT stage_id, status, cost_usd FROM llm_calls WHERE model_config_id = ?").bind(opus.id).all()).results;
  assert.equal(calls.length, 2);
  for (const call of calls) assert.equal(call.stage_id, null);

  // Counted towards the cap: once it is reached, the test is refused like a stage's call.
  await send("/api/settings/spendingCapUsd", { value: 0.0001 }, "PUT");
  const capped = await send(`/api/model-configs/${opus.id}/test`);
  assert.equal(capped.status, 429);
  await send("/api/settings/spendingCapUsd", { value: 1 }, "PUT");

  // Deleted configs aren't tested.
  assert.equal((await send(`/api/model-configs/${opus.id}`, undefined, "DELETE")).status, 204);
  assert.equal((await send(`/api/model-configs/${opus.id}/test`)).status, 409);
});

test("a listed model that takes no effort level gets none; one that thinks only when asked is asked", async () => {
  const haiku = configBody({ provider: "bedrock", modelId: "claude-haiku-4-5", region: "eu-central-1", routing: "global", pricing: { kind: "list" }, secrets: { apiKey: "K" }, name: "Haiku 4.5" });
  const refused = await send("/api/model-configs", haiku);
  assert.equal(refused.status, 400);
  assert.match((await json(refused)).error as string, /Claude Haiku 4.5 takes no effort level/);
  assert.equal((await send("/api/model-configs", { ...haiku, effort: null })).status, 201);
  const options = await json<ModelOptions>(await app.request("/api/models", {}, env));
  assert.deepEqual(options.models.find((m) => m.id === "claude-haiku-4-5")!.efforts, []);
});
