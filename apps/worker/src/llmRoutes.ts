// LLM calls and what they need (docs/llm.md): model configs, the user's settings, and the endpoint a running
// LLM stage calls once per request. The Worker resolves the stage's model config and its secrets, serves an
// identical earlier answer from the call records (the item-level cache, §5.2), and otherwise checks the spending cap,
// calls the provider, and records the call with its tokens and cost.

import type { Hono } from "hono";
import { canonicalJson, keyOf, sha256Hex } from "@score3ly/core";
import { bedrockModel, createAdapter, LlmError, type Effort, type LlmContent, MAX_CACHE_MARKS } from "./llm/index.ts";
import { costOf, type Price } from "./llm/prices.ts";
import { adapterFor, supportedFamilies } from "./llm/adapters.ts";
import {
  configBaseName,
  EFFORTS,
  FAMILY_NAMES,
  listedPrice,
  modelById,
  placesOfProvider,
  priceOfConfig,
  unsupportedReason,
  PROVIDER_NAMES,
  PROVIDERS,
  resolveModel,
  samePlace,
  type ConfigModel,
  type Family,
  type ModelList,
  type Place,
  type Pricing,
  type Provider,
  type Routing,
} from "./llm/models.ts";
import { MODEL_LIST } from "./llm/modelList.ts";
import { firstFreeName, MAX_NAME_LENGTH } from "./names.ts";

// The secrets each adapter needs, by field (the name of a Worker secret is stored, never its value): one set of them.
// Bedrock takes an API key or an access key pair.
const SECRETS: Record<string, string[][]> = {
  anthropic: [["apiKey"]],
  "anthropic-vertex": [["serviceAccount"]],
  "anthropic-bedrock": [["apiKey"], ["accessKeyId", "secretAccessKey"]],
  google: [["apiKey"]],
  "google-vertex": [["serviceAccount"]],
  fake: [[]],
  "fake-dev": [[]],
};

// A model config (docs/llm.md, "Configs"), as stored, with what the list says about its model (`model`, `family`,
// `modelName`, `unsupported`, `price`) for the browser.
export type ModelConfig = {
  id: string;
  name: string; // required and unique, ignoring case, among the configs that aren't deleted (docs/llm.md)
  provider: Provider;
  modelId: string | null; // a listed model
  modelString: string | null; // or a model the user added, with its family
  model: string; // the model's string on the provider ("" for a listed model the list doesn't have any more)
  family: Family;
  modelName: string | null; // the listed model's name for people
  // Why the app no longer supports it, said after its name (`its model config, "X", ${unsupported}.`), or null: a
  // stage that names it can't start, and it can't be picked (docs/llm.md, "No longer supported").
  unsupported: string | null;
  effort: Effort | null;
  region: string; // "" for providers without regions: not part of any cache key
  routing: Routing | null; // Bedrock only
  project: string | null; // Vertex AI only
  secrets: Record<string, string>; // field → name of a Worker secret: not part of any cache key
  pricing: Pricing;
  // What its calls cost now, from the list: its prices (perhaps borrowed: the model's name for people), free, unpriced,
  // or missing (the list has no price there any more).
  price: { kind: "priced"; price: Price; borrowedFrom: string | null } | { kind: "free" } | { kind: "unpriced" } | { kind: "missing" };
  freeTier: boolean; // pricing "free": its calls cost nothing and don't count towards the spending cap
  createdAt: string;
  deletedAt: string | null; // a deleted config is never used again: a stage that names one can't start
};

export type ModelConfigRow = {
  id: string;
  name: string;
  provider: Provider;
  model_id: string | null;
  model_string: string | null;
  family: Family | null;
  effort: Effort | null;
  region: string;
  routing: Routing | null;
  project: string | null;
  secrets_json: string;
  pricing_kind: Pricing["kind"];
  pricing_reference: string | null;
  created_at: string;
  deleted_at: string | null;
};

function configModel(row: Pick<ModelConfigRow, "model_id" | "model_string" | "family">): ConfigModel {
  return row.model_id !== null ? { modelId: row.model_id } : { modelString: row.model_string!, family: row.family! };
}

// A stored config's model as the list resolves it: its string and family, or for a listed model the list no longer
// has, its id and no family it can be called with.
export function resolvedModel(row: Pick<ModelConfigRow, "provider" | "model_id" | "model_string" | "family">, list: ModelList = MODEL_LIST) {
  const resolved = resolveModel(list, row.provider, configModel(row));
  const entry = row.model_id ? modelById(list, row.model_id) : null;
  return {
    model: resolved?.string ?? "",
    family: resolved?.family ?? entry?.family ?? row.family ?? "fake",
    modelName: resolved?.name ?? entry?.name ?? null,
  };
}

export function unsupportedOf(row: ModelConfigRow, pricing: Pricing = pricingOf(row), list: ModelList = MODEL_LIST): string | null {
  return unsupportedReason(list, { provider: row.provider, model: configModel(row), place: { region: row.region, routing: row.routing }, pricing });
}

function pricingOf(row: ModelConfigRow): Pricing {
  return row.pricing_kind === "list" ? { kind: "list", reference: row.pricing_reference } : { kind: row.pricing_kind };
}

function configPrice(row: ModelConfigRow, pricing: Pricing, list: ModelList = MODEL_LIST): ModelConfig["price"] {
  const priced = priceOfConfig(list, { provider: row.provider, model: configModel(row), place: { region: row.region, routing: row.routing }, pricing });
  if (priced.kind !== "priced") return priced;
  return { ...priced, borrowedFrom: priced.borrowedFrom ? (modelById(list, priced.borrowedFrom)?.name ?? priced.borrowedFrom) : null };
}

export function toModelConfig(row: ModelConfigRow): ModelConfig {
  const { model, family, modelName } = resolvedModel(row);
  const pricing = pricingOf(row);
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    modelId: row.model_id,
    modelString: row.model_string,
    model,
    family,
    modelName,
    unsupported: unsupportedOf(row, pricing),
    effort: row.effort,
    region: row.region,
    routing: row.routing,
    project: row.project,
    secrets: JSON.parse(row.secrets_json),
    pricing,
    price: configPrice(row, pricing),
    freeTier: pricing.kind === "free",
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
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

// What a model config's body must be (docs/llm.md, "Configs"). Returns the problem, or null.
export function configProblem(body: Record<string, unknown> | null, list: ModelList = MODEL_LIST): string | null {
  if (!body) return "expected a JSON body";
  const { name, provider, modelId, modelString, family, effort, region, routing, project, secrets, pricing } = body;
  if (name !== undefined && name !== null && typeof name !== "string") return "'name' must be text";
  if (typeof name === "string" && name.trim().length > MAX_NAME_LENGTH) return `'name' must be at most ${MAX_NAME_LENGTH} characters`;
  if (!PROVIDERS.includes(provider as Provider)) return `'provider' must be one of ${PROVIDERS.join(", ")}`;
  const p = provider as Provider;
  // The model: a listed one, or one the user adds with its family; never both.
  let modelFamily: Family;
  if (modelId !== undefined && modelId !== null) {
    if (modelString !== undefined && modelString !== null) return "give either 'modelId' or 'modelString', not both";
    const entry = typeof modelId === "string" ? modelById(list, modelId) : null;
    if (!entry) return "'modelId' must be a model of the list";
    if (entry.strings[p] === undefined) return `${entry.name} isn't offered on ${PROVIDER_NAMES[p]}`;
    if (family !== undefined && family !== null) return "a listed model's family comes from the list: leave 'family' out";
    modelFamily = entry.family;
  } else {
    if (typeof modelString !== "string" || modelString.trim() === "") return "expected 'modelId', or 'modelString' with 'family'";
    if (!supportedFamilies(p).includes(family as Family)) {
      return `'family' must be one the app supports on ${PROVIDER_NAMES[p]}: ${supportedFamilies(p).map((f) => FAMILY_NAMES[f]).join(", ")}`;
    }
    modelFamily = family as Family;
  }
  if (!adapterFor(p, modelFamily)) return `The app doesn't support ${FAMILY_NAMES[modelFamily]} on ${PROVIDER_NAMES[p]}`;
  if (effort !== undefined && effort !== null && !EFFORTS[modelFamily].includes(effort as Effort)) {
    return `'effort' must be one of ${EFFORTS[modelFamily].join(", ")}`;
  }
  // Where: one of the provider's places in the list.
  if (region !== undefined && typeof region !== "string") return "'region' must be text";
  if (routing !== undefined && routing !== null && !["global", "geographic", "in-region"].includes(routing as string)) {
    return "'routing' must be global, geographic or in-region";
  }
  const place: Place = { region: (region as string | undefined) ?? "", routing: (routing as Routing | null | undefined) ?? null };
  if (!placesOfProvider(list, p).some((other) => samePlace(other, place))) {
    return `${PROVIDER_NAMES[p]} has no region ${place.region || '""'}${place.routing ? ` with ${place.routing} routing` : ""} in the list`;
  }
  // A listed model only where the list has its price, however the config is priced: elsewhere the app doesn't support it.
  if (typeof modelId === "string" && modelId !== "" && !listedPrice(list, modelId, p, place)) {
    return `The app doesn't support ${modelById(list, modelId)!.name} on ${PROVIDER_NAMES[p]} there: pick another region`;
  }
  if (project !== undefined && project !== null && (p !== "vertex" || typeof project !== "string")) return "'project' is for Vertex AI only";
  // The secrets: one of the adapter's sets.
  const isStrings = (v: unknown) =>
    v === undefined || (v !== null && typeof v === "object" && Object.values(v).every((x) => typeof x === "string"));
  if (!isStrings(secrets)) return "'secrets' must map names to text";
  const keys = Object.keys((secrets ?? {}) as Record<string, string>).sort().join(",");
  const sets = SECRETS[adapterFor(p, modelFamily)!];
  if (!sets.some((set) => [...set].sort().join(",") === keys)) {
    return `'secrets' must name ${sets.map((set) => set.join(" and ") || "nothing").join(", or ")} for ${PROVIDER_NAMES[p]}`;
  }
  // The pricing: from the list (as its own model, or a model the user added as a listed one), free or unpriced.
  const pr = pricing as Partial<Pricing & { reference: unknown }> | undefined;
  if (!pr || !["list", "free", "unpriced"].includes(pr.kind as string)) return "'pricing' must be {kind: list, free or unpriced}";
  if (pr.kind === "list") {
    const reference = pr.reference ?? null;
    if (modelId) {
      if (reference !== null) return "a listed model is priced as itself: leave 'reference' out";
    } else {
      const entry = typeof reference === "string" ? modelById(list, reference) : null;
      if (!entry) return "a model you add is priced from the list as one of its models: 'reference' must be one";
      if (entry.family !== modelFamily) return `'reference' must be a ${FAMILY_NAMES[modelFamily]} model`;
      if (!listedPrice(list, entry.id, p, place)) return `the list has no price for ${entry.name} there: pick another region or another model`;
    }
  } else if (pr.reference !== undefined && pr.reference !== null) return "only a config priced from the list has a 'reference'";
  return null;
}

// Why a stage can't run with its model config, said so that the user knows what to do (docs/llm.md, "A missing key" and
// "Managing model configs"). The browser shows them after the stage's name ("Layout" can't run: …).
export function deletedConfigMessage(name: string): string {
  return `its model config, "${name}", was deleted.`;
}

export function unsupportedConfigMessage(name: string, reason: string): string {
  return `its model config, "${name}", ${reason}.`;
}

// A config deleted while its stage ran: the next request is refused (the start was checked already).
export function deletedWhileRunningMessage(name: string): string {
  return `The model config "${name}" was deleted while the stage ran. Pick another with "Change config" in the stage's ⋮, then retry.`;
}

export function missingSecretMessage(configName: string, secretName: string): string {
  return `The model config "${configName}" needs the secret ${secretName}, which isn't set. Set it where the app's secrets are kept (Settings, "Secrets"), then retry.`;
}

// The secrets' values from the Worker's environment, or the name of a missing one.
function secretValues(config: ModelConfig, env: Env): Record<string, string> | { missing: string } {
  const values: Record<string, string> = {};
  for (const [field, secretName] of Object.entries(config.secrets)) {
    const value = (env as unknown as Record<string, unknown>)[secretName];
    if (typeof value !== "string" || value === "") return { missing: secretName };
    values[field] = value;
  }
  return values;
}

// A request as the browser sends it. Each image is named by its recipe key (§5.2, "Only recipes, never pixels, in
// any key"), and comes inline, as base64, only once the Worker has said it isn't cached: the browser asks first with
// the recipe keys alone, so that a cached call is found before its images are made.
// `cacheUpTo` marks where the prompt is worth caching at the provider (docs/llm.md, "Prompt caching").
type RequestImage = { type: "image"; recipeKey: string; image?: { mediaType: "image/png" | "image/jpeg" | "image/webp"; base64: string } };
type CallRequest = {
  system?: string;
  messages: { role: "user" | "assistant"; content: (({ type: "text"; text: string } | RequestImage) & { cacheUpTo?: true })[] }[];
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
      if (c.cacheUpTo !== undefined && c.cacheUpTo !== true) return "'cacheUpTo' must be true or left out";
    }
  }
  const marks = r.messages.flatMap((m) => m.content).filter((c) => c.cacheUpTo).length;
  if (marks > MAX_CACHE_MARKS) return `at most ${MAX_CACHE_MARKS} parts can be marked 'cacheUpTo'`;
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

// The request with each image as its recipe key alone, and without the cache marks: what the request key is made
// from. The marks change what a call costs, not what the model is given.
function keyedRequest(request: CallRequest): unknown {
  return {
    ...request,
    messages: request.messages.map((m) => ({
      role: m.role,
      content: m.content.map((c) => (c.type === "image" ? { type: "image", recipeKey: c.recipeKey } : { type: "text", text: c.text })),
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
    content: m.content.map(
      (c): LlmContent =>
        c.type === "image" ? { type: "image", image: c.image!, ...(c.cacheUpTo ? { cacheUpTo: true } : {}) } : c,
    ),
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

// What the spending cap counts (docs/llm.md, "Spending cap"): the costs of the calls started in the last 24 hours,
// free-tier configs left out (unpriced calls have no cost to count), deleted projects included.
export async function spentInLastDay(db: D1Database, now = Date.now()): Promise<number> {
  const row = await db
    .prepare(
      "SELECT COALESCE(SUM(c.cost_usd), 0) AS spent FROM llm_calls c JOIN model_configs m ON m.id = c.model_config_id WHERE m.pricing_kind <> 'free' AND c.started_at >= ?",
    )
    .bind(new Date(now - DAY_MS).toISOString())
    .first<{ spent: number }>();
  return row?.spent ?? 0;
}

export function llmRoutes(app: Hono<{ Bindings: Env }>) {
  // When the list of models and prices was collected (llm/modelList.ts), for the About page.
  app.get("/api/prices", (c) => c.json({ asOf: MODEL_LIST.asOf, mock: MODEL_LIST.mock ?? false }));

  app.get("/api/settings", async (c) => c.json(await readSettings(c.env.DB)));

  app.put("/api/settings/:key", async (c) => {
    const key = c.req.param("key");
    const body = await c.req.json().catch(() => null);
    const problem = body && "value" in body ? settingProblem(key, body.value) : "expected a 'value'";
    if (problem) return c.json({ error: problem }, 400);
    if (key === "defaultModelConfigId" && body.value !== null) {
      const exists = await c.env.DB.prepare("SELECT * FROM model_configs WHERE id = ? AND deleted_at IS NULL").bind(body.value).first<ModelConfigRow>();
      if (!exists) return c.json({ error: "no such model config" }, 404);
      if (unsupportedOf(exists)) return c.json({ error: `"${exists.name}" ${unsupportedOf(exists)}: it can't be the default` }, 400);
    }
    await c.env.DB.prepare("INSERT OR REPLACE INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)")
      .bind(key, JSON.stringify(body.value), new Date().toISOString())
      .run();
    return c.json(await readSettings(c.env.DB));
  });

  // The model configs that aren't deleted, oldest first.
  app.get("/api/model-configs", async (c) => {
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM model_configs WHERE deleted_at IS NULL ORDER BY created_at, id",
    ).all<ModelConfigRow>();
    return c.json(results.map(toModelConfig));
  });

  // One model config, deleted or not: stages and calls refer to the config they used.
  app.get("/api/model-configs/:id", async (c) => {
    const row = await c.env.DB.prepare("SELECT * FROM model_configs WHERE id = ?").bind(c.req.param("id")).first<ModelConfigRow>();
    return row ? c.json(toModelConfig(row)) : c.json({ error: "no such model config" }, 404);
  });

  app.post("/api/model-configs", async (c) => {
    const body = await c.req.json().catch(() => null);
    const problem = configProblem(body);
    if (problem) return c.json({ error: problem }, 400);
    const name = await configName(c.env.DB, body);
    if (name === null) return c.json({ error: NAME_TAKEN }, 409);
    const row = newConfigRow(body, name);
    await insertConfig(c.env.DB, row).run();
    return c.json(toModelConfig(row), 201);
  });

  app.delete("/api/model-configs/:id", async (c) => {
    // The default can't be deleted until another config is the default (docs/llm.md, "Managing model configs").
    const { defaultModelConfigId } = await readSettings(c.env.DB);
    if (defaultModelConfigId === c.req.param("id")) {
      const row = await c.env.DB.prepare("SELECT name FROM model_configs WHERE id = ? AND deleted_at IS NULL")
        .bind(defaultModelConfigId)
        .first<{ name: string }>();
      if (row) {
        return c.json(
          { error: `"${row.name}" is the default model config: make another config the default first.`, code: "default_model_config" },
          409,
        );
      }
    }
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
    // Checked before every request, the cache included: a config deleted while its stage runs is never used again.
    if (row.deleted_at) return c.json({ error: deletedWhileRunningMessage(row.name), code: "deleted_model_config" }, 409);
    // So is one the app no longer supports (a new list of models), the cache included; its stage wasn't allowed to start.
    const unsupported = unsupportedOf(row);
    if (unsupported) {
      return c.json({ error: `The model config "${row.name}" ${unsupported}. Pick another with "Change config" in the stage's ⋮, then retry.`, code: "unsupported_model_config" }, 409);
    }
    const config = toModelConfig(row);

    // The request key: the exact request, images by their recipe keys, with the model's provider, model and effort.
    // Not the config's id, region, routing, project or secrets: they don't change the answer (§5.2).
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

    // Then what a priced call needs: a price, room under the spending cap, and the secrets. Free and unpriced calls
    // don't count towards the cap (docs/llm.md, "Models the user adds").
    const priced = priceOfConfig(MODEL_LIST, { provider: config.provider, model: configModel(row), place: { region: config.region, routing: config.routing }, pricing: config.pricing });
    // (Never "missing": that is an unsupported config, refused above.)
    const price = priced.kind === "priced" ? priced.price : null;
    if (price) {
      const { spendingCapUsd } = await readSettings(db);
      if ((await spentInLastDay(db)) >= spendingCapUsd) {
        return c.json(
          { error: `The spending cap has been reached: $${spendingCapUsd.toFixed(2)} within 24 hours. Calls already paid for are still served.`, code: "spending_cap" },
          429,
        );
      }
    }
    const secrets = secretValues(config, c.env);
    if ("missing" in secrets) {
      return c.json({ error: missingSecretMessage(config.name, secrets.missing as string), code: "missing_secret" }, 409);
    }
    const adapter = createAdapter({ provider: config.provider, family: config.family, region: config.region, project: config.project, secrets });
    if (!adapter) {
      return c.json({ error: `The app doesn't support ${FAMILY_NAMES[config.family]} on ${PROVIDER_NAMES[config.provider]}.`, code: "unsupported" }, 409);
    }
    // On Bedrock the routing is a prefix of the model string sent (llm/index.ts).
    const geography = MODEL_LIST.regions.find((r) => r.provider === config.provider && r.region === config.region)?.geography;
    const sentModel = config.provider === "bedrock" ? bedrockModel(config.model, config.routing, geography) : config.model;

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
      const response = await adapter.send({
        model: sentModel,
        effort: config.effort ?? undefined,
        system: request.system,
        messages: providerMessages(request),
        maxOutputTokens: request.maxOutputTokens,
        jsonSchema: request.jsonSchema,
      });
      // An answer that isn't valid JSON comes back with its usage like any other, so its cost is counted.
      const status =
        response.unexpectedModel !== undefined ? "error"
        : response.invalidJson !== undefined ? "unparseable"
        : response.stop === "end" ? "ok"
        : response.stop === "max_tokens" ? "cut_off"
        : response.stop === "refusal" ? "refused"
        : "error";
      // Unpriced: the tokens are known, the cost isn't (a call of unknown cost, docs/llm.md).
      const costUsd = priced.kind === "unpriced" ? null : price ? costOf(response.usage, price) : 0;
      const responseSha = await putJson(c.env.PDFS, { text: response.text, json: response.json, stop: response.stop, stopDetail: response.stopDetail, model: response.model, raw: response.raw });
      const error =
        status === "ok" ? null
        : response.unexpectedModel !== undefined ? response.unexpectedModel
        : status === "unparseable" ? response.invalidJson!
        : status === "cut_off" ? "The answer was cut off."
        : status === "refused" ? `The model declined${response.stopDetail ? ` (${response.stopDetail})` : ""}.`
        : "The answer ended unexpectedly.";
      await db
        .prepare(
          "UPDATE llm_calls SET status = ?, error = ?, error_kind = ?, response_model = ?, response_sha256 = ?, input_tokens = ?, output_tokens = ?, cached_tokens = ?, cache_write_tokens = ?, cost_usd = ?, price_json = ?, finished_at = ? WHERE id = ?",
        )
        .bind(
          status,
          error,
          response.unexpectedModel !== undefined ? "unexpected_model" : null,
          response.model,
          responseSha,
          response.usage.inputTokens,
          response.usage.outputTokens,
          response.usage.cacheReadTokens,
          response.usage.cacheWriteTokens,
          costUsd,
          price ? JSON.stringify({ ...price, asOf: MODEL_LIST.asOf, ...(priced.kind === "priced" && priced.borrowedFrom ? { borrowedFrom: priced.borrowedFrom } : {}) }) : null,
          new Date().toISOString(),
          callId,
        )
        .run();
      answer = { callId, cached: false, status, text: response.text, json: response.json ?? null, error, usage: response.usage, costUsd };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // No usable response, so no token counts and no cost. With an HTTP error status, the provider refused the call
      // and didn't bill it, and `auth` without one failed before anything was sent; otherwise it may have been billed
      // (docs/llm.md, "Calling the providers").
      const kind = err instanceof LlmError ? err.kind : "unknown";
      const httpStatus = err instanceof LlmError ? (err.status ?? null) : null;
      await db
        .prepare("UPDATE llm_calls SET status = 'error', error = ?, error_kind = ?, http_status = ?, finished_at = ? WHERE id = ?")
        .bind(message, kind, httpStatus, new Date().toISOString(), callId)
        .run();
      answer = { callId, cached: false, status: "error", text: null, json: null, error: message, usage: null, costUsd: null };
    }
    return c.json(answer);
  });
}

// The name of a new config: the one given, or else its default name ("Claude Opus 5.5 (Bedrock) · high"), the first
// free one, numbered like project names (docs/llm.md, "Configs"). A given name that another config has (ignoring case)
// is refused: null.
async function configName(db: D1Database, body: Record<string, unknown>): Promise<string | null> {
  const { results } = await db.prepare("SELECT name FROM model_configs WHERE deleted_at IS NULL").all<{ name: string }>();
  const taken = results.map((row) => row.name);
  const given = typeof body.name === "string" ? body.name.trim() : "";
  if (given) return taken.some((name) => name.toLowerCase() === given.toLowerCase()) ? null : given;
  const model: ConfigModel = body.modelId ? { modelId: body.modelId as string } : { modelString: (body.modelString as string).trim(), family: body.family as Family };
  const base = configBaseName(MODEL_LIST, body.provider as Provider, model, (body.effort as Effort | undefined) ?? null);
  return firstFreeName(base.slice(0, MAX_NAME_LENGTH).trim(), taken);
}

const NAME_TAKEN = "A model config with that name already exists. Names must be unique (case-insensitive).";

function newConfigRow(body: Record<string, unknown>, name: string): ModelConfigRow {
  const pricing = body.pricing as Pricing & { reference?: string | null };
  const listed = typeof body.modelId === "string" && body.modelId !== "";
  return {
    id: crypto.randomUUID(),
    name,
    provider: body.provider as Provider,
    model_id: listed ? (body.modelId as string) : null,
    model_string: listed ? null : (body.modelString as string).trim(),
    family: listed ? null : (body.family as Family),
    effort: (body.effort as Effort | undefined) ?? null,
    region: (body.region as string | undefined) ?? "",
    routing: (body.routing as Routing | undefined) ?? null,
    project: (body.project as string | undefined) || null,
    secrets_json: JSON.stringify(body.secrets ?? {}),
    pricing_kind: pricing.kind,
    pricing_reference: pricing.kind === "list" ? (pricing.reference ?? null) : null,
    created_at: new Date().toISOString(),
    deleted_at: null,
  };
}

function insertConfig(db: D1Database, row: ModelConfigRow): D1PreparedStatement {
  return db
    .prepare(
      "INSERT INTO model_configs (id, name, provider, model_id, model_string, family, effort, region, routing, project, secrets_json, pricing_kind, pricing_reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      row.id,
      row.name,
      row.provider,
      row.model_id,
      row.model_string,
      row.family,
      row.effort,
      row.region,
      row.routing,
      row.project,
      row.secrets_json,
      row.pricing_kind,
      row.pricing_reference,
      row.created_at,
    );
}
