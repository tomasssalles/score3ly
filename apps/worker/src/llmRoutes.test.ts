import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getPlatformProxy } from "wrangler";
import app from "./index.ts";
import { costOf, priceOf } from "./llm/prices.ts";

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
    "DELETE FROM llm_calls; DELETE FROM output_inputs; DELETE FROM stage_inputs; DELETE FROM outputs; DELETE FROM pipeline_entries; DELETE FROM stages; DELETE FROM projects; DELETE FROM settings; DELETE FROM model_configs;",
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

async function modelConfig(fields: Record<string, unknown> = {}): Promise<Record<string, string>> {
  const response = await send("/api/model-configs", { provider: "fake", model: "fake-model", effort: "high", ...fields });
  assert.equal(response.status, 201);
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

function request(question = "How many systems?") {
  return {
    system: "You find systems.",
    messages: [
      {
        role: "user",
        content: [
          { type: "image", image: { mediaType: "image/png", base64: PNG } },
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

test("prices: Claude's list prices, Bedrock's names included; unknown models have none", () => {
  assert.deepEqual(priceOf("anthropic", "claude-opus-5-5"), { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 });
  assert.deepEqual(priceOf("anthropic-bedrock", "eu.anthropic.claude-opus-5-5"), priceOf("anthropic", "claude-opus-5-5"));
  assert.deepEqual(priceOf("anthropic-bedrock", "anthropic.claude-sonnet-5-5"), priceOf("anthropic", "claude-sonnet-5-5"));
  assert.equal(priceOf("anthropic", "claude-unknown"), null);
  assert.equal(priceOf("google", "gemini-3-pro"), null);
  const price = priceOf("anthropic", "claude-opus-5-5")!;
  // 10,000 in, 2,000 out, 1,000 cache reads, 1,000 cache writes.
  assert.equal(costOf({ inputTokens: 10_000, outputTokens: 2_000, cacheReadTokens: 1_000, cacheWriteTokens: 1_000 }, price), 0.0852);
});

test("model configs: checked per provider, edited by copy on change, deleted by marking", async () => {
  assert.equal((await send("/api/model-configs", { provider: "anthropic", model: "claude-opus-5-5" })).status, 400); // no secret
  assert.equal(
    (await send("/api/model-configs", { provider: "anthropic-bedrock", model: "x", secrets: { apiKey: "BEDROCK_KEY" } })).status,
    400, // no region
  );
  const bedrock = await modelConfig({
    provider: "anthropic-bedrock",
    model: "eu.anthropic.claude-opus-5-5",
    params: { region: "eu-central-1" },
    secrets: { accessKeyId: "AWS_KEY_ID", secretAccessKey: "AWS_SECRET" },
  });
  assert.deepEqual(bedrock.secrets, { accessKeyId: "AWS_KEY_ID", secretAccessKey: "AWS_SECRET" });

  await send("/api/settings/defaultModelConfigId", { value: bedrock.id }, "PUT");
  const edited = await json<Record<string, string>>(
    await send(`/api/model-configs/${bedrock.id}`, { provider: "fake", model: "fake-model", name: "Try" }, "PUT"),
  );
  assert.equal(edited.supersedesId, bedrock.id);
  assert.equal((await json<Record<string, unknown>>(await app.request("/api/settings", {}, env))).defaultModelConfigId, edited.id);
  const listed = await json<{ id: string }[]>(await app.request("/api/model-configs", {}, env));
  assert.deepEqual(
    listed.map((c) => c.id),
    [edited.id],
  );
  // The old version can still be read: stages and calls refer to it.
  assert.equal((await app.request(`/api/model-configs/${bedrock.id}`, {}, env)).status, 200);
  assert.equal((await send(`/api/model-configs/${edited.id}`, undefined, "DELETE")).status, 204);
  assert.equal((await send(`/api/model-configs/${edited.id}`, undefined, "DELETE")).status, 404);
});

test("settings: checked, with defaults", async () => {
  assert.deepEqual(await json(await app.request("/api/settings", {}, env)), { defaultModelConfigId: null, spendingCapUsd: null });
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
  assert.deepEqual(JSON.parse(rows[0].price_json as string), { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25, asOf: "2026-10-06" });
  // The request is recorded without the image, which is replaced by its hash.
  const recorded = await (await app.request(`/api/content/${rows[0].request_sha256}`, {}, env)).text();
  assert.ok(!recorded.includes(PNG) && recorded.includes('"sha256"'));

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

test("failed answers are recorded but never served from the record", async () => {
  await send("/api/settings/spendingCapUsd", { value: 1 }, "PUT");
  for (const [model, status] of [
    ["fake-error", "error"],
    ["fake-refusal", "refused"],
    ["fake-cut-off", "cut_off"],
    ["fake-unparseable", "unparseable"],
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
  assert.equal(rows.length, 8);
  assert.ok(rows.every((r) => r.status !== "ok"));
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
  // No cap, no paid calls.
  const refused = await call(stage);
  assert.equal(refused.status, 409);
  assert.equal((await json(refused)).code, "no_spending_cap");

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
    (await modelConfig({ freeTier: true, provider: "google", model: "gemini-x", secrets: { apiKey: "NO_SUCH_SECRET" } })).id,
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
  const unpriced = await runningStage((await modelConfig({ provider: "google", model: "gemini-x", secrets: { apiKey: "GEMINI_KEY" } })).id);
  assert.equal((await json(await call(unpriced))).code, "no_price");
  const unset = await runningStage(
    (await modelConfig({ provider: "anthropic", model: "claude-opus-5-5", secrets: { apiKey: "NO_SUCH_SECRET" } })).id,
  );
  const missing = await json(await call(unset));
  assert.equal(missing.code, "missing_secret");
  assert.match(missing.error as string, /NO_SUCH_SECRET/);
  assert.equal((await calls()).length, 0);
  assert.equal((await call(without, { messages: [] })).status, 400);
});
