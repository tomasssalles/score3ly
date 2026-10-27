// LLM calls and what they need (docs/llm.md): model configs, the user's settings, and the endpoint a running
// LLM stage calls once per request. The Worker resolves the stage's model config and its secrets, serves an
// identical earlier answer from the call records (the item-level cache, §5.2), and otherwise checks the spending cap,
// calls the provider, and records the call with its tokens and cost.

import type { Hono } from "hono";
import { canonicalJson, keyOf, sha256Hex } from "@score3ly/core";
import { createProvider, LlmError, type Effort, type LlmContent, type ProviderConfig, type ProviderId } from "./llm/index.ts";
import { costOf, PRICES_AS_OF, priceOf } from "./llm/prices.ts";

const PROVIDERS: ProviderId[] = ["anthropic", "anthropic-vertex", "anthropic-bedrock", "google", "fake"];
const EFFORTS: Effort[] = ["low", "medium", "high", "xhigh", "max"];

// Each provider's fields: which are secrets (the name of a Worker secret is stored, never its value) and which are
// plain values. Bedrock takes an API key or an access key pair.
const FIELDS: Record<ProviderId, { secrets: string[][]; params: string[]; optionalParams: string[] }> = {
  anthropic: { secrets: [["apiKey"]], params: [], optionalParams: [] },
  "anthropic-vertex": { secrets: [["serviceAccount"]], params: ["region"], optionalParams: ["projectId"] },
  "anthropic-bedrock": { secrets: [["apiKey"], ["accessKeyId", "secretAccessKey"]], params: ["region"], optionalParams: [] },
  google: { secrets: [["apiKey"]], params: [], optionalParams: [] },
  fake: { secrets: [[]], params: [], optionalParams: [] },
};

export type ModelConfig = {
  id: string;
  name: string | null;
  provider: ProviderId;
  model: string;
  effort: Effort | null;
  params: Record<string, string>; // plain values, e.g. a region: not part of any cache key
  secrets: Record<string, string>; // field → name of a Worker secret: not part of any cache key
  freeTier: boolean;
  supersedesId: string | null;
  createdAt: string;
};

type ModelConfigRow = {
  id: string;
  name: string | null;
  provider: ProviderId;
  model: string;
  effort: Effort | null;
  params_json: string;
  secrets_json: string;
  free_tier: number;
  supersedes_id: string | null;
  created_at: string;
  deleted_at: string | null;
};

function toModelConfig(row: ModelConfigRow): ModelConfig {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    model: row.model,
    effort: row.effort,
    params: JSON.parse(row.params_json),
    secrets: JSON.parse(row.secrets_json),
    freeTier: row.free_tier === 1,
    supersedesId: row.supersedes_id,
    createdAt: row.created_at,
  };
}

// The settings the Worker knows, with their defaults. Settings that depend on the device stay in the browser (§5.8).
export type Settings = {
  defaultModelConfigId: string | null; // the model config of LLM stages unless one is chosen for the stage (§7.2)
  spendingCapUsd: number; // at most this much within any 24 hours, for configs that aren't free (§10): $1 until changed
  newProjectRunMode: "auto" | "manual"; // the run mode a new project starts with (§5.1)
};

const DEFAULT_SETTINGS: Settings = { defaultModelConfigId: null, spendingCapUsd: 1, newProjectRunMode: "auto" };

export async function readSettings(db: D1Database): Promise<Settings> {
  const { results } = await db.prepare("SELECT key, value_json FROM settings").all<{ key: string; value_json: string }>();
  const stored = Object.fromEntries(results.map((r) => [r.key, JSON.parse(r.value_json)]));
  return { ...DEFAULT_SETTINGS, ...Object.fromEntries(Object.keys(DEFAULT_SETTINGS).filter((k) => k in stored).map((k) => [k, stored[k]])) };
}

function settingProblem(key: string, value: unknown): string | null {
  if (key === "defaultModelConfigId") return value === null || typeof value === "string" ? null : "expected a model config id or null";
  if (key === "spendingCapUsd") {
    // There is always a cap: it can be changed, never removed.
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? null : "expected an amount in US dollars above 0";
  }
  if (key === "newProjectRunMode") return value === "auto" || value === "manual" ? null : "expected 'auto' or 'manual'";
  return "no such setting";
}

// What a model config's body must be. Returns the problem, or null.
function configProblem(body: Record<string, unknown> | null): string | null {
  if (!body) return "expected a JSON body";
  const { name, provider, model, effort, params, secrets, freeTier } = body;
  if (name !== undefined && name !== null && typeof name !== "string") return "'name' must be text";
  if (!PROVIDERS.includes(provider as ProviderId)) return `'provider' must be one of ${PROVIDERS.join(", ")}`;
  if (typeof model !== "string" || model.trim() === "") return "'model' must be the provider's model name";
  if (effort !== undefined && effort !== null && !EFFORTS.includes(effort as Effort)) {
    return `'effort' must be one of ${EFFORTS.join(", ")}`;
  }
  if (freeTier !== undefined && typeof freeTier !== "boolean") return "'freeTier' must be true or false";
  const fields = FIELDS[provider as ProviderId];
  const isStrings = (v: unknown) =>
    v === undefined || (v !== null && typeof v === "object" && Object.values(v).every((x) => typeof x === "string"));
  if (!isStrings(params) || !isStrings(secrets)) return "'params' and 'secrets' must map names to text";
  const p = (params ?? {}) as Record<string, string>;
  const s = (secrets ?? {}) as Record<string, string>;
  const missing = fields.params.find((f) => !p[f]);
  if (missing) return `'params' needs '${missing}'`;
  const extra = Object.keys(p).find((f) => !fields.params.includes(f) && !fields.optionalParams.includes(f));
  if (extra) return `'params' has no '${extra}' for ${provider}`;
  const keys = Object.keys(s).sort().join(",");
  if (!fields.secrets.some((set) => [...set].sort().join(",") === keys)) {
    return `'secrets' must name ${fields.secrets.map((set) => set.join(" and ") || "nothing").join(", or ")} for ${provider}`;
  }
  return null;
}

// The provider's config, with the secrets' values from the Worker's environment. Null names a missing secret.
function providerConfig(config: ModelConfig, env: Env): ProviderConfig | { missing: string } {
  const values: Record<string, string> = {};
  for (const [field, secretName] of Object.entries(config.secrets)) {
    const value = (env as unknown as Record<string, unknown>)[secretName];
    if (typeof value !== "string" || value === "") return { missing: secretName };
    values[field] = value;
  }
  return { provider: config.provider, ...config.params, ...values } as ProviderConfig;
}

// A request as the browser sends it. Each image is named by its recipe key (§5.2, "Only recipes, never pixels, in
// any key"), and comes inline, as base64, only once the Worker has said it isn't cached: the browser asks first with
// the recipe keys alone, so that a cached call is found before its images are made.
type RequestImage = { type: "image"; recipeKey: string; image?: { mediaType: "image/png" | "image/jpeg" | "image/webp"; base64: string } };
type CallRequest = {
  system?: string;
  messages: { role: "user" | "assistant"; content: ({ type: "text"; text: string } | RequestImage)[] }[];
  maxOutputTokens?: number;
  jsonSchema?: Record<string, unknown>;
};

function requestProblem(request: unknown): string | null {
  const r = request as CallRequest | null;
  if (!r || typeof r !== "object") return "expected a 'request'";
  if (r.system !== undefined && typeof r.system !== "string") return "'system' must be text";
  if (!Array.isArray(r.messages) || r.messages.length === 0) return "expected 'messages'";
  for (const m of r.messages) {
    if ((m?.role !== "user" && m?.role !== "assistant") || !Array.isArray(m.content)) return "a message needs a role and content";
    for (const c of m.content) {
      const ok =
        (c?.type === "text" && typeof c.text === "string") ||
        (c?.type === "image" &&
          typeof c.recipeKey === "string" &&
          /^[0-9a-f]{64}$/.test(c.recipeKey) &&
          (c.image === undefined ||
            (typeof c.image?.base64 === "string" && ["image/png", "image/jpeg", "image/webp"].includes(c.image?.mediaType))));
      if (!ok) return "content must be text or an image named by its recipe key (PNG, JPEG or WebP, base64)";
    }
  }
  if (r.maxOutputTokens !== undefined && !Number.isInteger(r.maxOutputTokens)) return "'maxOutputTokens' must be a whole number";
  if (r.jsonSchema !== undefined && (typeof r.jsonSchema !== "object" || r.jsonSchema === null)) return "'jsonSchema' must be an object";
  return null;
}

function base64Bytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// The request with each image as its recipe key alone: what the request key is made from.
function keyedRequest(request: CallRequest): unknown {
  return {
    ...request,
    messages: request.messages.map((m) => ({
      role: m.role,
      content: m.content.map((c) => (c.type === "image" ? { type: "image", recipeKey: c.recipeKey } : c)),
    })),
  };
}

// The request with each image as its recipe key and the hash of its bytes: what is recorded (images aren't stored,
// §2: they are rebuilt from their recipes).
async function recordedRequest(request: CallRequest): Promise<unknown> {
  return {
    ...request,
    messages: await Promise.all(
      request.messages.map(async (m) => ({
        role: m.role,
        content: await Promise.all(
          m.content.map(async (c) =>
            c.type === "image"
              ? { type: "image", recipeKey: c.recipeKey, mediaType: c.image!.mediaType, sha256: await sha256Hex(base64Bytes(c.image!.base64)) }
              : c,
          ),
        ),
      })),
    ),
  };
}

// The request as the providers take it: images inline, without their recipe keys.
function providerMessages(request: CallRequest): { role: "user" | "assistant"; content: LlmContent[] }[] {
  return request.messages.map((m) => ({
    role: m.role,
    content: m.content.map((c): LlmContent => (c.type === "image" ? { type: "image", image: c.image! } : c)),
  }));
}

async function putJson(bucket: R2Bucket, value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const sha256 = await sha256Hex(bytes);
  await bucket.put(`content/${sha256}`, bytes, { sha256, httpMetadata: { contentType: "application/json" } });
  return sha256;
}

// What the stage gets back from a call.
export type CallAnswer = {
  callId: string;
  cached: boolean; // served from an earlier call with the same request: nothing was paid
  status: "ok" | "cut_off" | "refused" | "unparseable" | "error";
  text: string | null;
  json: unknown;
  error: string | null;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number } | null;
  costUsd: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function llmRoutes(app: Hono<{ Bindings: Env }>) {
  // When the price table was collected (llm/prices.ts), for the About page.
  app.get("/api/prices", (c) => c.json({ asOf: PRICES_AS_OF }));

  app.get("/api/settings", async (c) => c.json(await readSettings(c.env.DB)));

  app.put("/api/settings/:key", async (c) => {
    const key = c.req.param("key");
    const body = await c.req.json().catch(() => null);
    const problem = body && "value" in body ? settingProblem(key, body.value) : "expected a 'value'";
    if (problem) return c.json({ error: problem }, 400);
    if (key === "defaultModelConfigId" && body.value !== null) {
      const exists = await c.env.DB.prepare("SELECT id FROM model_configs WHERE id = ? AND deleted_at IS NULL").bind(body.value).first();
      if (!exists) return c.json({ error: "no such model config" }, 404);
    }
    await c.env.DB.prepare("INSERT OR REPLACE INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)")
      .bind(key, JSON.stringify(body.value), new Date().toISOString())
      .run();
    return c.json(await readSettings(c.env.DB));
  });

  // The model configs that aren't deleted, oldest first. A config that was edited appears as its latest version.
  app.get("/api/model-configs", async (c) => {
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM model_configs WHERE deleted_at IS NULL ORDER BY created_at, id",
    ).all<ModelConfigRow>();
    return c.json(results.map(toModelConfig));
  });

  // One model config, deleted or not: stages and calls refer to the version they used.
  app.get("/api/model-configs/:id", async (c) => {
    const row = await c.env.DB.prepare("SELECT * FROM model_configs WHERE id = ?").bind(c.req.param("id")).first<ModelConfigRow>();
    return row ? c.json(toModelConfig(row)) : c.json({ error: "no such model config" }, 404);
  });

  app.post("/api/model-configs", async (c) => {
    const body = await c.req.json().catch(() => null);
    const problem = configProblem(body);
    if (problem) return c.json({ error: problem }, 400);
    const row = newConfigRow(body, null);
    await insertConfig(c.env.DB, row).run();
    return c.json(toModelConfig(row), 201);
  });

  // Editing is copy on change (§7.2): a new row supersedes the old one, which is marked deleted, and the default
  // setting follows it. Stages and calls keep referring to the version they used.
  app.put("/api/model-configs/:id", async (c) => {
    const db = c.env.DB;
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => null);
    const problem = configProblem(body);
    if (problem) return c.json({ error: problem }, 400);
    const old = await db.prepare("SELECT id FROM model_configs WHERE id = ? AND deleted_at IS NULL").bind(id).first();
    if (!old) return c.json({ error: "no such model config" }, 404);
    const row = newConfigRow(body, id);
    const settings = await readSettings(db);
    await db.batch([
      insertConfig(db, row),
      db.prepare("UPDATE model_configs SET deleted_at = ? WHERE id = ?").bind(row.created_at, id),
      ...(settings.defaultModelConfigId === id
        ? [
            db
              .prepare("INSERT OR REPLACE INTO settings (key, value_json, updated_at) VALUES ('defaultModelConfigId', ?, ?)")
              .bind(JSON.stringify(row.id), row.created_at),
          ]
        : []),
    ]);
    return c.json(toModelConfig(row));
  });

  app.delete("/api/model-configs/:id", async (c) => {
    const result = await c.env.DB.prepare("UPDATE model_configs SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL")
      .bind(new Date().toISOString(), c.req.param("id"))
      .run();
    return result.meta.changes === 0 ? c.json({ error: "no such model config" }, 404) : c.body(null, 204);
  });

  // An answer that is valid JSON but that the stage can't use (e.g. LilyPond inside it that doesn't parse, or boxes
  // outside the page): it is marked unparseable, so it is never served from the cache again and a retry asks anew
  // (§5.2). Its cost stays in the records: it was paid for.
  app.post("/api/projects/:pid/stages/:sid/llm-calls/:callId/unusable", async (c) => {
    const { pid, sid, callId } = c.req.param();
    const body = await c.req.json().catch(() => null);
    if (typeof body?.reason !== "string" || body.reason.trim() === "") return c.json({ error: "expected a 'reason'" }, 400);
    const result = await c.env.DB.prepare(
      "UPDATE llm_calls SET status = 'unparseable', error = ? WHERE id = ? AND status = 'ok' AND EXISTS (SELECT 1 FROM pipeline_entries e WHERE e.project_id = ? AND e.stage_id = ?)",
    )
      .bind(body.reason.trim(), callId, pid, sid)
      .run();
    return result.meta.changes === 0 ? c.json({ error: "no such usable call" }, 404) : c.body(null, 204);
  });

  // One LLM request of a running stage. Errors the stage can act on carry a `code`.
  app.post("/api/projects/:pid/stages/:sid/llm", async (c) => {
    const db = c.env.DB;
    const { pid, sid } = c.req.param();
    const body = await c.req.json().catch(() => null);
    const problem = requestProblem(body?.request);
    if (problem) return c.json({ error: problem }, 400);
    const request = body.request as CallRequest;

    const stage = await db
      .prepare(
        "SELECT s.status, s.model_config_id FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id JOIN projects p ON p.id = e.project_id WHERE e.project_id = ? AND e.stage_id = ? AND p.deleted_at IS NULL",
      )
      .bind(pid, sid)
      .first<{ status: string; model_config_id: string | null }>();
    if (!stage) return c.json({ error: "no such stage in this project's pipeline" }, 404);
    if (stage.status !== "running") return c.json({ error: "the stage isn't running" }, 409);
    if (!stage.model_config_id) return c.json({ error: "the stage has no model config", code: "no_model_config" }, 409);
    const row = await db.prepare("SELECT * FROM model_configs WHERE id = ?").bind(stage.model_config_id).first<ModelConfigRow>();
    if (!row) return c.json({ error: "the stage's model config doesn't exist", code: "no_model_config" }, 409);
    const config = toModelConfig(row);

    // The request key: the exact request, images by their recipe keys, with the model's provider, model and effort.
    // Not the config's id, parameters or secrets: they don't change the answer (§5.2).
    const requestKey = await keyOf({
      provider: config.provider,
      model: config.model,
      effort: config.effort,
      request: keyedRequest(request),
    });

    // The cache first: an answer already paid for is served even when the spending cap is reached.
    const earlier = await db
      .prepare(
        "SELECT id, response_sha256, input_tokens, output_tokens, cached_tokens, cache_write_tokens FROM llm_calls WHERE request_key = ? AND status = 'ok' AND deleted_at IS NULL AND response_sha256 IS NOT NULL ORDER BY started_at LIMIT 1",
      )
      .bind(requestKey)
      .first<{ id: string; response_sha256: string; input_tokens: number; output_tokens: number; cached_tokens: number; cache_write_tokens: number | null }>();
    if (earlier) {
      const object = await c.env.PDFS.get(`content/${earlier.response_sha256}`);
      if (object) {
        const response = (await object.json()) as { text: string; json?: unknown };
        const answer: CallAnswer = {
          callId: earlier.id,
          cached: true,
          status: "ok",
          text: response.text,
          json: response.json ?? null,
          error: null,
          usage: {
            inputTokens: earlier.input_tokens,
            outputTokens: earlier.output_tokens,
            cacheReadTokens: earlier.cached_tokens,
            cacheWriteTokens: earlier.cache_write_tokens ?? 0,
          },
          costUsd: 0,
        };
        return c.json(answer);
      }
    }

    // Not cached: the browser makes the images and asks again with them.
    if (request.messages.some((m) => m.content.some((c) => c.type === "image" && !c.image))) {
      return c.json({ imagesNeeded: true });
    }

    // Then what a paid call needs: a price, a spending cap, room under it, and the secrets.
    const price = priceOf(config.provider, config.model);
    if (!config.freeTier) {
      if (!price) {
        return c.json(
          { error: `No price is known for ${config.model}: the spending cap couldn't count it. Mark the config as free tier, or add the price.`, code: "no_price" },
          409,
        );
      }
      const { spendingCapUsd } = await readSettings(db);
      const spent = await db
        .prepare(
          "SELECT COALESCE(SUM(c.cost_usd), 0) AS spent FROM llm_calls c JOIN model_configs m ON m.id = c.model_config_id WHERE m.free_tier = 0 AND c.started_at >= ?",
        )
        .bind(new Date(Date.now() - DAY_MS).toISOString())
        .first<{ spent: number }>();
      if ((spent?.spent ?? 0) >= spendingCapUsd) {
        return c.json(
          { error: `The spending cap is reached: $${spendingCapUsd.toFixed(2)} within 24 hours. Calls already paid for are still served.`, code: "spending_cap" },
          429,
        );
      }
    }
    const providerSettings = providerConfig(config, c.env);
    if ("missing" in providerSettings) {
      return c.json({ error: `The Worker has no secret named ${providerSettings.missing}.`, code: "missing_secret" }, 409);
    }

    const callId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const requestSha = await putJson(c.env.PDFS, await recordedRequest(request));
    await db
      .prepare(
        "INSERT INTO llm_calls (id, stage_id, model_config_id, request_key, request_sha256, status, started_at) VALUES (?, ?, ?, ?, ?, 'running', ?)",
      )
      .bind(callId, sid, config.id, requestKey, requestSha, startedAt)
      .run();

    let answer: CallAnswer;
    try {
      const response = await createProvider(providerSettings).send({
        model: config.model,
        effort: config.effort ?? undefined,
        system: request.system,
        messages: providerMessages(request),
        maxOutputTokens: request.maxOutputTokens,
        jsonSchema: request.jsonSchema,
      });
      const status = response.stop === "end" ? "ok" : response.stop === "max_tokens" ? "cut_off" : response.stop === "refusal" ? "refused" : "error";
      const costUsd = config.freeTier || !price ? 0 : costOf(response.usage, price);
      const responseSha = await putJson(c.env.PDFS, { text: response.text, json: response.json, stop: response.stop, stopDetail: response.stopDetail, model: response.model, raw: response.raw });
      const error =
        status === "ok" ? null : status === "cut_off" ? "The answer was cut off." : status === "refused" ? `The model declined${response.stopDetail ? ` (${response.stopDetail})` : ""}.` : "The answer ended unexpectedly.";
      await db
        .prepare(
          "UPDATE llm_calls SET status = ?, error = ?, response_model = ?, response_sha256 = ?, input_tokens = ?, output_tokens = ?, cached_tokens = ?, cache_write_tokens = ?, cost_usd = ?, price_json = ?, finished_at = ? WHERE id = ?",
        )
        .bind(
          status,
          error,
          response.model,
          responseSha,
          response.usage.inputTokens,
          response.usage.outputTokens,
          response.usage.cacheReadTokens,
          response.usage.cacheWriteTokens,
          costUsd,
          config.freeTier || !price ? null : JSON.stringify({ ...price, asOf: PRICES_AS_OF }),
          new Date().toISOString(),
          callId,
        )
        .run();
      answer = { callId, cached: false, status, text: response.text, json: response.json ?? null, error, usage: response.usage, costUsd };
    } catch (err) {
      const status = err instanceof LlmError && err.kind === "invalid_output" ? "unparseable" : "error";
      const message = err instanceof Error ? err.message : String(err);
      // A failed call may still have been billed (an unparseable answer was generated): its cost isn't known here.
      await db
        .prepare("UPDATE llm_calls SET status = ?, error = ?, finished_at = ? WHERE id = ?")
        .bind(status, message, new Date().toISOString(), callId)
        .run();
      answer = { callId, cached: false, status, text: null, json: null, error: message, usage: null, costUsd: null };
    }
    return c.json(answer);
  });
}

function newConfigRow(body: Record<string, unknown>, supersedesId: string | null): ModelConfigRow {
  return {
    id: crypto.randomUUID(),
    name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : null,
    provider: body.provider as ProviderId,
    model: (body.model as string).trim(),
    effort: (body.effort as Effort | undefined) ?? null,
    params_json: JSON.stringify(body.params ?? {}),
    secrets_json: JSON.stringify(body.secrets ?? {}),
    free_tier: body.freeTier === true ? 1 : 0,
    supersedes_id: supersedesId,
    created_at: new Date().toISOString(),
    deleted_at: null,
  };
}

function insertConfig(db: D1Database, row: ModelConfigRow): D1PreparedStatement {
  return db
    .prepare(
      "INSERT INTO model_configs (id, name, provider, model, effort, params_json, secrets_json, free_tier, supersedes_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(row.id, row.name, row.provider, row.model, row.effort, row.params_json, row.secrets_json, row.free_tier, row.supersedes_id, row.created_at);
}
