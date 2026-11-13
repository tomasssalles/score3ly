// LLM calls and what they need (docs/llm.md): model configs, the user's settings, and the endpoint a running
// LLM stage calls once per request. The Worker resolves the stage's model config and its secrets, serves an
// identical earlier answer from the call records (the item-level cache, §5.2), and otherwise checks the spending cap,
// calls the provider, and records the call with its tokens and cost.

import { COST_WITH_VAT, isVatPercent, withVat } from "./vat.ts";
import { logFields } from "./requestLog.ts";
import type { Hono } from "hono";
import { canonicalJson, keyOf, sha256Hex } from "@score3ly/core";
import { fetchPriceRange, freeOnOpenRouter } from "./llm/openrouter.ts";
import { bedrockModel, createAdapter, LlmError, type Effort, type LlmContent, MAX_CACHE_MARKS } from "./llm/index.ts";
import { cloudflareTimeoutMessage } from "./llm/types.ts";
import { costOf, type Price } from "./llm/prices.ts";
import { adapterFor, supportedFamilies } from "./llm/adapters.ts";
import {
  ACCOUNT_FEES,
  ACCOUNTS,
  BUSINESS_REGIONS,
  configBaseName,
  EFFORTS,
  effortsOf,
  FAMILY_NAMES,
  listedPrice,
  modelById,
  modelByString,
  offered,
  placesOf,
  placesOfProvider,
  priceOfConfig,
  PRICED_BY_PROVIDER,
  PROVIDER_NAMES,
  PROVIDERS,
  resolveModel,
  samePlace,
  type Account,
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
  "anthropic-bedrock": [["apiKey"], ["accessKeyId", "secretAccessKey"]],
  google: [["apiKey"]],
  "google-vertex": [["serviceAccount"]],
  openrouter: [["apiKey"]],
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
  account: Account | null; // OpenRouter only: the plan, which sets the fee on credits and allows the EU
  secrets: Record<string, string>; // field → name of a Worker secret: not part of any cache key
  pricing: Pricing;
  // What its calls cost now, from the list: its prices (perhaps borrowed: the model's name for people), free, unpriced,
  // priced by the provider (each answer says; plus `fee`, the share added for the provider's fee on credits), or
  // missing (the list has no price there any more).
  price:
    | { kind: "priced"; price: Price; borrowedFrom: string | null }
    | { kind: "free" }
    | { kind: "unpriced" }
    | { kind: "provider"; fee: number }
    | { kind: "missing" };
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
  account: Account | null;
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

// The model a config uses, for grouping and filtering the statistics by model, whatever the provider (docs/statistics.md):
// a listed model by its id, named as the list names it; a model added by hand by its string, the same model on every
// provider that spells it alike.
export function modelGroupOf(row: Pick<ModelConfigRow, "model_id" | "model_string">, list: ModelList = MODEL_LIST): { modelKey: string; modelLabel: string } {
  if (row.model_id) return { modelKey: row.model_id, modelLabel: modelById(list, row.model_id)?.name ?? row.model_id };
  return { modelKey: `string:${row.model_string ?? ""}`, modelLabel: row.model_string ?? "" };
}

// Why the app no longer supports a stored config, or null where it does (docs/llm.md, "No longer supported"). A config
// is supported when it is valid as a whole by today's code and list: when the request that would create it now passes
// the same checks (`configProblem`). Said after the config's name: `its model config, "X", ${reason}.`
export function unsupportedOf(row: ModelConfigRow, pricing: Pricing = pricingOf(row), list: ModelList = MODEL_LIST): string | null {
  const problem = configProblem(bodyOf(row, pricing), list);
  if (problem === null) return null;
  return unsupportedReason(list, row, pricing) ?? `can't be used as it is any more (${problem})`;
}

// The request that would create a stored config now.
function bodyOf(row: ModelConfigRow, pricing: Pricing): Record<string, unknown> {
  let secrets: unknown;
  try {
    secrets = JSON.parse(row.secrets_json);
  } catch {
    secrets = null;
  }
  return {
    name: row.name,
    provider: row.provider,
    ...(row.model_id !== null ? { modelId: row.model_id } : { modelString: row.model_string, family: row.family }),
    effort: row.effort,
    region: row.region,
    routing: row.routing,
    project: row.project,
    account: row.account,
    secrets,
    pricing,
  };
}

// What the app no longer supports about a config, in words: the first combination in the config form's order that
// nothing picked after it could make supported (docs/llm.md, "No longer supported"): the provider; the model on it; the
// account (OpenRouter); the model at the region, then with the routing; the effort; the credentials; the pricing. Null
// where none of these is the reason (unsupportedOf then says what the checks found).
function unsupportedReason(list: ModelList, row: ModelConfigRow, pricing: Pricing): string | null {
  const no = (what: string) => `uses ${what}, which the app no longer supports`;
  const p = row.provider;
  if (!PROVIDERS.includes(p)) return no(String(p));
  const provider = PROVIDER_NAMES[p];
  const entry = row.model_id !== null ? modelById(list, row.model_id) : null;
  const modelName = entry?.name ?? row.model_id ?? row.model_string ?? "";
  // The model on the provider: a listed one offered somewhere on it; one added by hand of a family the app supports there.
  if (row.model_id !== null) {
    if (!entry || entry.strings[p] === undefined || placesOf(list, entry.id, p).length === 0) return no(`${modelName} on ${provider}`);
  } else if (!row.family || !adapterFor(p, row.family)) {
    return no(`${row.family ? `${FAMILY_NAMES[row.family]} models` : modelName} on ${provider}`);
  }
  // OpenRouter's account, which decides where it may run.
  if (p === "openrouter" && (!ACCOUNTS.includes(row.account as Account) || (BUSINESS_REGIONS.includes(row.region) && row.account !== "business"))) {
    return no(`${provider}${row.region ? ` in the ${row.region.toUpperCase()}` : ""} with a ${row.account ?? "missing"} account`);
  }
  // The region, then the routing: a listed model where the list offers it; one added by hand at the provider's places.
  const places = row.model_id !== null ? placesOf(list, row.model_id, p) : placesOfProvider(list, p);
  const at = `${modelName} on ${provider}${row.region ? ` in ${row.region}` : ""}`;
  if (!places.some((place) => place.region === row.region)) return no(at);
  if (!places.some((place) => samePlace(place, { region: row.region, routing: row.routing }))) return no(`${at}${row.routing ? ` (${row.routing} routing)` : " without a routing"}`);
  // The effort, which the model takes or not, wherever it runs.
  if (row.effort !== null && !effortsOf(entry?.family ?? row.family!, entry).includes(row.effort)) return no(`${modelName} at effort ${row.effort}`);
  // The credentials: one of the sets of secrets the adapter takes.
  let secrets: Record<string, string> = {};
  try {
    secrets = JSON.parse(row.secrets_json) as Record<string, string>;
  } catch {
    // Unreadable: the checks say so.
  }
  const fields = Object.keys(secrets).sort().join(",");
  if (!SECRETS[adapterFor(p, entry?.family ?? row.family!)!].some((set) => [...set].sort().join(",") === fields)) {
    return `names secrets for ${provider} (${Object.keys(secrets).join(", ") || "none"}) that the app no longer takes`;
  }
  // The pricing: by the provider only where it reports each call's cost; a model priced as a listed one needs its price.
  if ((pricing.kind === "provider") !== PRICED_BY_PROVIDER.includes(p) && !(pricing.kind === "free")) {
    return `is priced ${pricing.kind === "provider" ? "by the provider" : `as "${pricing.kind}"`}, which the app no longer supports on ${provider}`;
  }
  if (pricing.kind === "list" && pricing.reference !== null && row.model_id === null && !listedPrice(list, pricing.reference, p, { region: row.region, routing: row.routing })) {
    const reference = modelById(list, pricing.reference)?.name ?? pricing.reference;
    return `is priced as ${reference} on ${provider}${row.region ? ` in ${row.region}` : ""}${row.routing ? ` (${row.routing} routing)` : ""}, which the app no longer has a price for`;
  }
  return null;
}

function pricingOf(row: ModelConfigRow): Pricing {
  return row.pricing_kind === "list" ? { kind: "list", reference: row.pricing_reference } : { kind: row.pricing_kind };
}

// A call's cost where the provider reports it: what the answer says, raised by the fee on credits (OpenRouter's is
// charged when credits are bought, on top of them, so a dollar of credits costs 1 + fee); unknown (null) where the
// answer doesn't say.
export function providerCost(reportedUsd: number | undefined, fee: number): number | null {
  return reportedUsd === undefined ? null : Math.round(reportedUsd * (1 + fee) * 1_000_000) / 1_000_000;
}

// The share a call's reported cost is raised by for the provider's fee on credits (OpenRouter's, by the account's
// plan), or 0.
export function feeOf(row: Pick<ModelConfigRow, "account">): number {
  return row.account ? ACCOUNT_FEES[row.account] : 0;
}

function configPrice(row: ModelConfigRow, pricing: Pricing, list: ModelList = MODEL_LIST): ModelConfig["price"] {
  const priced = priceOfConfig(list, { provider: row.provider, model: configModel(row), place: { region: row.region, routing: row.routing }, pricing });
  if (priced.kind === "provider") return { kind: "provider", fee: feeOf(row) };
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
    account: row.account ?? null,
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
  vatPercent: number; // the VAT added to every cost, a percentage (docs/llm.md, "VAT"): 0 until changed
};

const DEFAULT_SETTINGS: Settings = { defaultModelConfigId: null, spendingCapUsd: 1, newProjectRunMode: "auto", vatPercent: 0 };

export async function readSettings(db: D1Database): Promise<Settings> {
  const { results } = await db.prepare("SELECT key, value_json FROM settings").all<{ key: string; value_json: string }>();
  const stored = Object.fromEntries(results.map((r) => [r.key, JSON.parse(r.value_json)]));
  return { ...DEFAULT_SETTINGS, ...Object.fromEntries(Object.keys(DEFAULT_SETTINGS).filter((k) => k in stored).map((k) => [k, stored[k]])) };
}

function settingProblem(key: string, value: unknown): string | null {
  // There is always a default (docs/llm.md, "Which config a stage uses"): it can be changed, never removed.
  if (key === "defaultModelConfigId") return typeof value === "string" ? null : "expected a model config id";
  if (key === "spendingCapUsd") {
    // There is always a cap: it can be changed, never removed.
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? null : "expected an amount in US dollars above 0";
  }
  if (key === "newProjectRunMode") return value === "auto" || value === "manual" ? null : "expected 'auto' or 'manual'";
  if (key === "vatPercent") return isVatPercent(value) ? null : "expected a percentage from 0 to 100, with at most two decimals";
  return "no such setting";
}

// What a model config's body must be (docs/llm.md, "Configs"). Returns the problem, or null.
export function configProblem(body: Record<string, unknown> | null, list: ModelList = MODEL_LIST): string | null {
  if (!body) return "expected a JSON body";
  const { name, provider, modelId, modelString, family, effort, region, routing, project, account, secrets, pricing } = body;
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
    // A string the list has for this provider is a listed model: picked from the list, never added by hand.
    const listed = modelByString(list, p, modelString.trim());
    if (listed) {
      return placesOf(list, listed.id, p).length > 0
        ? `${listed.name} is in the app's list: pick it there`
        : `The app no longer supports ${listed.name} on ${PROVIDER_NAMES[p]}`;
    }
    if (!supportedFamilies(p).includes(family as Family)) {
      return `'family' must be one the app supports on ${PROVIDER_NAMES[p]}: ${supportedFamilies(p).map((f) => FAMILY_NAMES[f]).join(", ")}`;
    }
    modelFamily = family as Family;
  }
  if (!adapterFor(p, modelFamily)) return `The app doesn't support ${FAMILY_NAMES[modelFamily]} on ${PROVIDER_NAMES[p]}`;
  const efforts = effortsOf(modelFamily, typeof modelId === "string" ? modelById(list, modelId) : null);
  if (effort !== undefined && effort !== null && !efforts.includes(effort as Effort)) {
    return efforts.length === 0
      ? `${modelById(list, modelId as string)?.name ?? "This model"} takes no effort level: leave 'effort' out`
      : `'effort' must be one of ${efforts.join(", ")}`;
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
  // A listed model only where the list offers it (with its price, or priced by the provider), however the config is
  // priced: elsewhere the app doesn't support it.
  const byProvider = PRICED_BY_PROVIDER.includes(p);
  if (typeof modelId === "string" && modelId !== "" && !(byProvider ? offered(list, modelId, p, place) : listedPrice(list, modelId, p, place))) {
    return `The app doesn't support ${modelById(list, modelId)!.name} on ${PROVIDER_NAMES[p]} there: pick another region`;
  }
  if (project !== undefined && project !== null && (p !== "vertex" || typeof project !== "string")) return "'project' is for Vertex AI only";
  // OpenRouter's account: its plan sets the fee, and only Business may use the EU.
  if (p === "openrouter") {
    if (!ACCOUNTS.includes(account as Account)) return `'account' must be one of ${ACCOUNTS.join(", ")} for ${PROVIDER_NAMES[p]}`;
    if (BUSINESS_REGIONS.includes(place.region) && account !== "business") return `Only a Business account may use ${PROVIDER_NAMES[p]} in the ${place.region.toUpperCase()}`;
  } else if (account !== undefined && account !== null) return "'account' is for OpenRouter only";
  // The secrets: one of the adapter's sets.
  const isStrings = (v: unknown) =>
    v === undefined || (v !== null && typeof v === "object" && Object.values(v).every((x) => typeof x === "string"));
  if (!isStrings(secrets)) return "'secrets' must map names to text";
  const keys = Object.keys((secrets ?? {}) as Record<string, string>).sort().join(",");
  const sets = SECRETS[adapterFor(p, modelFamily)!];
  if (!sets.some((set) => [...set].sort().join(",") === keys)) {
    return `'secrets' must name ${sets.map((set) => set.join(" and ") || "nothing").join(", or ")} for ${PROVIDER_NAMES[p]}`;
  }
  // The pricing: by the provider where it reports each call's cost, and only there; otherwise from the list (as its own
  // model, or a model the user added as a listed one), free or unpriced.
  const pr = pricing as Partial<Pricing & { reference: unknown }> | undefined;
  // There, the free-tier mark too (decided 2026-11-08): a model the user's account doesn't pay for.
  if (byProvider) {
    return pr?.kind === "provider" || pr?.kind === "free" ? null : `'pricing' must be {kind: provider or free} for ${PROVIDER_NAMES[p]}: each answer says what it cost`;
  }
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

// Configs added by hand become listed ones when a new list of models has their string for their provider
// (docs/llm.md, "Configs"): the model id replaces the string and family; "priced as" another model and "unpriced"
// become the model's own price, "free" stays free (the user's free tier, not a guess). Where the list has no price at
// the config's place, the converted config is no longer supported, as any listed one there. Names don't change. Done
// once per list (the Worker has no start-up hook: the first request after a new list does it, and the database keeps
// which list it was done for). Returns how many configs were converted.
let convertedFor: string | null = null;

export async function listKey(list: ModelList): Promise<string> {
  return sha256Hex(new TextEncoder().encode(JSON.stringify(list.models.map((m) => [m.id, m.strings]))));
}

export async function convertAddedConfigs(db: D1Database, list: ModelList = MODEL_LIST): Promise<number> {
  const key = await listKey(list);
  if (convertedFor === key) return 0;
  const done = await db.prepare("SELECT value_json FROM settings WHERE key = 'modelListConvertedFor'").first<{ value_json: string }>();
  let converted = 0;
  if (!done || JSON.parse(done.value_json) !== key) {
    const { results } = await db
      .prepare("SELECT id, provider, model_string, pricing_kind FROM model_configs WHERE model_string IS NOT NULL")
      .all<{ id: string; provider: Provider; model_string: string; pricing_kind: Pricing["kind"] }>();
    const statements: D1PreparedStatement[] = [];
    for (const row of results) {
      const entry = modelByString(list, row.provider, row.model_string);
      if (!entry) continue;
      statements.push(
        db
          .prepare("UPDATE model_configs SET model_id = ?, model_string = NULL, family = NULL, pricing_kind = ?, pricing_reference = NULL WHERE id = ?")
          .bind(entry.id, row.pricing_kind === "free" || row.pricing_kind === "provider" ? row.pricing_kind : "list", row.id),
      );
    }
    statements.push(
      db
        .prepare("INSERT OR REPLACE INTO settings (key, value_json, updated_at) VALUES ('modelListConvertedFor', ?, ?)")
        .bind(JSON.stringify(key), new Date().toISOString()),
    );
    await db.batch(statements);
    converted = statements.length - 1;
  }
  convertedFor = key;
  return converted;
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
  costUsd: number | null; // with VAT (docs/llm.md, "VAT")
  vatPercent: number; // the rate in it
};

const DAY_MS = 24 * 60 * 60 * 1000;

// What the spending cap counts (docs/llm.md, "Spending cap"): the costs of the calls started in the last 24 hours, with
// their VAT, free-tier configs left out (unpriced calls have no cost to count), deleted projects included.
export async function spentInLastDay(db: D1Database, now = Date.now()): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(${COST_WITH_VAT}), 0) AS spent FROM llm_calls c JOIN model_configs m ON m.id = c.model_config_id WHERE m.pricing_kind <> 'free' AND c.started_at >= ?`,
    )
    .bind(new Date(now - DAY_MS).toISOString())
    .first<{ spent: number }>();
  return row?.spent ?? 0;
}

// What the config form's pickers need (docs/llm.md, "The settings page"): each provider with its name, the families the
// app supports there (each with its effort levels and the sets of secrets its adapter takes) and its places; and the
// listed models that aren't retired, each with its string, places and prices on the providers where the list has a
// price for it. A model added by hand is offered its provider's places; a listed one only those with its price.
export type ModelOptions = {
  asOf: string;
  mock: boolean;
  providers: {
    id: Provider;
    name: string;
    families: { id: Family; name: string; efforts: Effort[]; secrets: string[][] }[];
    places: (Place & { geography?: string })[];
    // Priced by the provider (OpenRouter): its configs have an account, whose plan sets the fee (`fees`), and
    // `businessRegions` are the regions only a Business account may use.
    pricedByProvider?: { fees: Record<Account, number>; businessRegions: string[] };
  }[];
  models: {
    id: string;
    name: string;
    family: Family;
    efforts: Effort[]; // the levels the model takes ([] for none)
    // A place's price is null where the provider prices each call itself.
    providers: Partial<Record<Provider, { string: string; places: (Place & { price: Price | null })[] }>>;
  }[];
};

export function modelOptions(list: ModelList = MODEL_LIST, dev = false): ModelOptions {
  const offered = PROVIDERS.filter((p) => dev || p !== "fake-dev");
  return {
    asOf: list.asOf,
    mock: list.mock ?? false,
    // "fake-dev" (made-up prices, for developing the costs and the cap) only where the Worker offers the providers for
    // development (docs/llm.md, "Calling the providers").
    providers: offered.map((id) => ({
      id,
      name: PROVIDER_NAMES[id],
      families: supportedFamilies(id).map((family) => ({
        id: family,
        name: FAMILY_NAMES[family],
        efforts: EFFORTS[family],
        secrets: SECRETS[adapterFor(id, family)!],
      })),
      places: list.regions
        .filter((r) => r.provider === id)
        .flatMap((r) => (r.routings ?? [null]).map((routing) => ({ region: r.region, routing, ...(r.geography ? { geography: r.geography } : {}) }))),
      ...(PRICED_BY_PROVIDER.includes(id) ? { pricedByProvider: { fees: ACCOUNT_FEES, businessRegions: BUSINESS_REGIONS } } : {}),
    })),
    models: list.models
      .filter((m) => !m.retired)
      .map((m) => ({
        id: m.id,
        name: m.name,
        family: m.family,
        efforts: effortsOf(m.family, m),
        providers: Object.fromEntries(
          offered.filter((p) => m.strings[p] !== undefined)
            .map((p) => [p, { string: m.strings[p]!, places: list.prices.filter((x) => x.model === m.id && x.provider === p).map((x) => ({ region: x.region, routing: x.routing, price: x.price })) }] as const)
            .filter(([, offer]) => offer.places.length > 0),
        ),
      }))
      .filter((m) => Object.keys(m.providers).length > 0),
  };
}

// The names of the Worker's secrets (its text values: D1, R2 and the assets are bindings, not text), sorted, for the
// form's secret pickers (§10: the app knows only their names). Never a value.
// The Worker's text values that are settings, not secrets (docs/llm.md, "Model configs"): every one the app reads is
// listed here, and left out of the secrets' names a config picks from. Any other text value is taken to be a secret.
export const NOT_SECRETS = [
  "DEV_PROVIDERS", // "true": the providers for development are offered too (Fake with costs)
] as const;

// Whether the providers for development are offered: `wrangler dev --var DEV_PROVIDERS:true`, or the desktop server's
// --dev-providers.
export function devProviders(env: Env): boolean {
  const value = (env as unknown as Record<string, unknown>).DEV_PROVIDERS;
  return value === "true" || value === "1";
}

export function secretNames(env: Env): string[] {
  return Object.entries(env as unknown as Record<string, unknown>)
    .filter(([name, value]) => typeof value === "string" && !(NOT_SECRETS as readonly string[]).includes(name))
    .map(([name]) => name)
    .sort();
}

export function llmRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/api/models", (c) => c.json(modelOptions(MODEL_LIST, devProviders(c.env))));

  app.get("/api/secrets", (c) => c.json({ names: secretNames(c.env) }));

  // A guide to what a config's model costs where the provider prices each call itself (OpenRouter: docs/llm.md,
  // "OpenRouter"): the range of its providers' input and output prices, or null.
  app.get("/api/model-configs/:id/price-range", async (c) => {
    const row = await c.env.DB.prepare("SELECT * FROM model_configs WHERE id = ?").bind(c.req.param("id")).first<ModelConfigRow>();
    if (!row) return c.json({ error: "no such model config" }, 404);
    if (row.provider !== "openrouter") return c.json({ range: null });
    const { model } = resolvedModel(row);
    return c.json({ range: model ? await fetchPriceRange(model, row.region) : null });
  });

  // When the list of models and prices was collected (llm/modelList.ts), for the About page.
  app.get("/api/prices", (c) => c.json({ asOf: MODEL_LIST.asOf, mock: MODEL_LIST.mock ?? false }));

  app.get("/api/settings", async (c) => c.json(await readSettings(c.env.DB)));

  app.put("/api/settings/:key", async (c) => {
    const key = c.req.param("key");
    const body = await c.req.json().catch(() => null);
    const problem = body && "value" in body ? settingProblem(key, body.value) : "expected a 'value'";
    if (problem) return c.json({ error: problem }, 400);
    if (key === "defaultModelConfigId") {
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

  // Creates a config, or clones one: `replaces` names the original to delete with it ("Delete the original"; the clone
  // becomes the default if the original was). A config with exactly the same values as one that isn't deleted isn't
  // created (docs/llm.md, "Managing model configs"): 409 with `code` "same_values" and that config, so the browser can
  // offer to rename it instead.
  app.post("/api/model-configs", async (c) => {
    const db = c.env.DB;
    const body = await c.req.json().catch(() => null);
    const problem = configProblem(body);
    if (problem) return c.json({ error: problem }, 400);
    if (body.provider === "fake-dev" && !devProviders(c.env)) {
      return c.json({ error: "Fake with costs is a provider for development: start the Worker with DEV_PROVIDERS=true to use it." }, 400);
    }
    if (body.replaces !== undefined && typeof body.replaces !== "string") return c.json({ error: "'replaces' must be a model config's id" }, 400);
    const original =
      typeof body.replaces === "string"
        ? await db.prepare("SELECT id, name FROM model_configs WHERE id = ? AND deleted_at IS NULL").bind(body.replaces).first<{ id: string; name: string }>()
        : null;
    if (typeof body.replaces === "string" && !original) return c.json({ error: "the config to replace doesn't exist" }, 404);
    const draft = newConfigRow(body, "");
    const same = (await db.prepare("SELECT * FROM model_configs WHERE deleted_at IS NULL").all<ModelConfigRow>()).results.find((row) => sameValues(row, draft));
    if (same) {
      return c.json({ error: `A config with these settings already exists: "${same.name}".`, code: "same_values", config: { id: same.id, name: same.name } }, 409);
    }
    const name = await configName(db, body);
    if (name === null) return c.json({ error: NAME_TAKEN }, 409);
    const row = { ...draft, name };
    const statements = [insertConfig(db, row)];
    if (original) {
      statements.push(db.prepare("UPDATE model_configs SET deleted_at = ? WHERE id = ?").bind(row.created_at, original.id));
      const { defaultModelConfigId } = await readSettings(db);
      if (defaultModelConfigId === original.id) {
        statements.push(
          db.prepare("INSERT OR REPLACE INTO settings (key, value_json, updated_at) VALUES ('defaultModelConfigId', ?, ?)").bind(JSON.stringify(row.id), row.created_at),
        );
      }
    }
    await db.batch(statements);
    return c.json(toModelConfig(row), 201);
  });

  // Renames a config: the only change a config's row takes besides its deletion (docs/llm.md, "Managing model configs").
  // The name is required and unique, ignoring case, among the configs that aren't deleted; changing only its case is
  // allowed.
  app.patch("/api/model-configs/:id", async (c) => {
    const db = c.env.DB;
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return c.json({ error: "expected a 'name'" }, 400);
    if (name.length > MAX_NAME_LENGTH) return c.json({ error: `'name' must be at most ${MAX_NAME_LENGTH} characters` }, 400);
    const row = await db.prepare("SELECT * FROM model_configs WHERE id = ? AND deleted_at IS NULL").bind(id).first<ModelConfigRow>();
    if (!row) return c.json({ error: "no such model config" }, 404);
    const taken = await db
      .prepare("SELECT id FROM model_configs WHERE deleted_at IS NULL AND id <> ? AND name = ? COLLATE NOCASE")
      .bind(id, name)
      .first();
    if (taken) return c.json({ error: NAME_TAKEN }, 409);
    await db.prepare("UPDATE model_configs SET name = ? WHERE id = ?").bind(name, id).run();
    return c.json(toModelConfig({ ...row, name }));
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

  // A config's test (docs/llm.md, "The settings page"): one small real request, with an image and a JSON schema, that
  // shows the model, the place, the key, the effort and structured output working before a long run. Never served from
  // the record nor cached: it is sent every time, recorded as a call of no stage, and counts towards the spending cap.
  // Real providers only (decided 2026-11-06): the fake ones need no test.
  app.post("/api/model-configs/:id/test", async (c) => {
    const row = await c.env.DB.prepare("SELECT * FROM model_configs WHERE id = ?").bind(c.req.param("id")).first<ModelConfigRow>();
    if (!row) return c.json({ error: "no such model config" }, 404);
    if (row.deleted_at) return c.json({ error: `The model config "${row.name}" was deleted.`, code: "deleted_model_config" }, 409);
    const unsupported = unsupportedOf(row);
    if (unsupported) return c.json({ error: `The model config "${row.name}" ${unsupported}.`, code: "unsupported_model_config" }, 409);
    if (row.provider === "fake" || row.provider === "fake-dev") return c.json({ error: "Only configs of real providers can be tested." }, 400);
    const startedAt = Date.now();
    const sent = await sendCall(c.env, row, TEST_REQUEST, `test:${crypto.randomUUID()}`, null);
    if ("refusal" in sent) {
      // A test is never served from the record: the cap's note about calls already paid for doesn't apply.
      const error = sent.refusal.code === "spending_cap" ? sent.refusal.error.replace(" Calls already paid for are still served.", "") : sent.refusal.error;
      return c.json({ error, code: sent.refusal.code }, sent.refusal.status);
    }
    const durationMs = Date.now() - startedAt;
    // An answer outside the schema fails the test, as a stage couldn't use it either: recorded as unusable, like a
    // stage's (§5.2), and said with what came back.
    if (sent.status === "ok" && typeof (sent.json as { colour?: unknown } | null)?.colour !== "string") {
      const error = `The response has an OK status and is valid JSON, but doesn't follow the schema the request asked for. Requested schema: {"colour": string}. Response: ${(sent.text ?? "").slice(0, 200)}`;
      await c.env.DB.prepare("UPDATE llm_calls SET status = 'unparseable', error = ? WHERE id = ?").bind(error, sent.callId).run();
      return c.json({ ...sent, status: "unparseable", error, durationMs });
    }
    return c.json({ ...sent, durationMs });
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
    // For the request's log line: what the browser calls the call ("System 12"), and how many images it carries.
    const images = request.messages.reduce((n, m) => n + m.content.filter((part) => part.type === "image" && part.image).length, 0);
    logFields(c.req.raw, { ...(typeof body.label === "string" ? { label: body.label.slice(0, 100) } : {}), images });

    const stage = await db
      .prepare(
        "SELECT s.step, s.status, s.model_config_id FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id JOIN projects p ON p.id = e.project_id WHERE e.project_id = ? AND e.stage_id = ? AND p.deleted_at IS NULL",
      )
      .bind(pid, sid)
      .first<{ step: string; status: string; model_config_id: string | null }>();
    if (!stage) return c.json({ error: "no such stage in this project's pipeline" }, 404);
    logFields(c.req.raw, { step: stage.step });
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
        logFields(c.req.raw, { answer: "cached" });
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
          vatPercent: 0,
        };
        return c.json(answer);
      }
    }

    // Not cached: the browser makes the images and asks again with them.
    if (request.messages.some((m) => m.content.some((c) => c.type === "image" && !c.image))) {
      logFields(c.req.raw, { answer: "images needed" });
      return c.json({ imagesNeeded: true });
    }

    logFields(c.req.raw, { answer: "sent", provider: config.provider });
    const sent = await sendCall(c.env, row, request, requestKey, sid);
    logFields(c.req.raw, "refusal" in sent ? { refused: sent.refusal.code } : { status: sent.status, outputTokens: sent.usage?.outputTokens });
    if ("refusal" in sent) return c.json({ error: sent.refusal.error, code: sent.refusal.code }, sent.refusal.status);
    return c.json(sent);
  });
}

// The test's request: a black square on white, 32 × 32 px, and a question about it, answered in a JSON schema. Its
// output is short, but a model thinking at a high effort may write more, hence the room.
const TEST_IMAGE = "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAAAAABWESUoAAAAGklEQVR42mP4TwAwjDAFDGhgVMHIVjDC8wUAMJb9Hysc1uIAAAAASUVORK5CYII=";
export const TEST_REQUEST: CallRequest = {
  messages: [
    {
      role: "user",
      content: [
        // The image's "recipe key" is its own hash: the test's image is no recipe's.
        { type: "image", recipeKey: "0e784026ef6e7650937f03b3311dd53d180be45ef51c960dfe8528beaa4d10f6", image: { mediaType: "image/png", base64: TEST_IMAGE } },
        { type: "text", text: "What colour is the square in this image? Answer with one word." },
      ],
    },
  ],
  maxOutputTokens: 4000,
  jsonSchema: { type: "object", properties: { colour: { type: "string" } }, required: ["colour"], additionalProperties: false },
};

// Sends a request that wasn't served from the record, and records the call: what a stage's request and a config's
// test have in common. Refused before anything is sent where the spending cap is reached (priced calls only), a secret
// is missing or the app has no adapter.
type Refusal = { refusal: { error: string; code: string; status: 409 | 429 } };

async function sendCall(env: Env, row: ModelConfigRow, request: CallRequest, requestKey: string, stageId: string | null): Promise<CallAnswer | Refusal> {
  const db = env.DB;
  const config = toModelConfig(row);
  // Then what a priced call needs: a price, room under the spending cap, and the secrets. Free and unpriced calls
  // don't count towards the cap (docs/llm.md, "Models the user adds").
  const priced = priceOfConfig(MODEL_LIST, { provider: config.provider, model: configModel(row), place: { region: config.region, routing: config.routing }, pricing: config.pricing });
  // (Never "missing": that is an unsupported config, refused above.)
  const price = priced.kind === "priced" ? priced.price : null;
  if (price || priced.kind === "provider") {
    const { spendingCapUsd } = await readSettings(db);
    // A model the provider itself lists as free (OpenRouter's ":free" models: all its prices 0) costs nothing, so the
    // cap doesn't stop it (decided 2026-11-08); its calls are still recorded at what they report.
    if ((await spentInLastDay(db)) >= spendingCapUsd && !(priced.kind === "provider" && (await freeOnOpenRouter(config.model, config.region)))) {
      return { refusal: { error: `The spending cap has been reached: $${spendingCapUsd.toFixed(2)} within 24 hours. Calls already paid for are still served.`, code: "spending_cap", status: 429 } };
    }
  }
  const secrets = secretValues(config, env);
  if ("missing" in secrets) {
    return { refusal: { error: missingSecretMessage(config.name, secrets.missing as string), code: "missing_secret", status: 409 } };
  }
  const adapter = createAdapter({ provider: config.provider, family: config.family, region: config.region, project: config.project, secrets });
  if (!adapter) {
    return { refusal: { error: `The app doesn't support ${FAMILY_NAMES[config.family]} on ${PROVIDER_NAMES[config.provider]}.`, code: "unsupported", status: 409 } };
  }
  // On Bedrock the routing is a prefix of the model string sent (llm/index.ts).
  const geography = MODEL_LIST.regions.find((r) => r.provider === config.provider && r.region === config.region)?.geography;
  const sentModel = config.provider === "bedrock" ? bedrockModel(config.model, config.routing, geography) : config.model;

  const callId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const requestSha = await putJson(env.PDFS, await recordedRequest(request));
  await db
    .prepare(
      "INSERT INTO llm_calls (id, stage_id, model_config_id, request_key, request_sha256, status, started_at) VALUES (?, ?, ?, ?, ?, 'running', ?)",
    )
    .bind(callId, stageId, config.id, requestKey, requestSha, startedAt)
    .run();

  let answer: CallAnswer;
  try {
    const response = await adapter.send({
      model: sentModel,
      effort: config.effort ?? undefined,
      ...(row.model_id && modelById(MODEL_LIST, row.model_id)?.thinking === "adaptive" ? { adaptiveThinking: true as const } : {}),
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
    // Unpriced: the tokens are known, the cost isn't (a call of unknown cost, docs/llm.md). Priced by the provider: what
    // the answer says it cost, plus the fee on credits; unknown where it doesn't say.
    const fee = feeOf(row);
    const costUsd =
      priced.kind === "unpriced" ? null
      : priced.kind === "provider" ? providerCost(response.reportedCostUsd, fee)
      : price ? costOf(response.usage, price) : 0;
    // The rate in force now, when the cost is recorded (docs/llm.md, "VAT").
    const { vatPercent } = await readSettings(db);
    const responseSha = await putJson(env.PDFS, { text: response.text, json: response.json, stop: response.stop, stopDetail: response.stopDetail, model: response.model, ...(response.servedBy ? { servedBy: response.servedBy } : {}), raw: response.raw });
    const error =
      status === "ok" ? null
      : response.unexpectedModel !== undefined ? response.unexpectedModel
      : status === "unparseable" ? response.invalidJson!
      : status === "cut_off" ? "The answer was cut off."
      : status === "refused" ? `The model declined${response.stopDetail ? ` (${response.stopDetail})` : ""}.`
      : "The answer ended unexpectedly.";
    await db
      .prepare(
        "UPDATE llm_calls SET status = ?, error = ?, error_kind = ?, response_model = ?, response_sha256 = ?, input_tokens = ?, output_tokens = ?, cached_tokens = ?, cache_write_tokens = ?, cost_usd = ?, vat_percent = ?, price_json = ?, finished_at = ? WHERE id = ?",
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
        vatPercent,
        price ? JSON.stringify({ ...price, asOf: MODEL_LIST.asOf, ...(priced.kind === "priced" && priced.borrowedFrom ? { borrowedFrom: priced.borrowedFrom } : {}) })
        : priced.kind === "provider" || (priced.kind === "free" && row.account) ? JSON.stringify({ reportedUsd: response.reportedCostUsd ?? null, fee, account: row.account })
        : null,
        new Date().toISOString(),
        callId,
      )
      .run();
    answer = { callId, cached: false, status, text: response.text, json: response.json ?? null, error, usage: response.usage, costUsd: withVat(costUsd, vatPercent), vatPercent };
  } catch (err) {
    const httpStatus = err instanceof LlmError ? (err.status ?? null) : null;
    // No usable response, so no token counts and no cost. With an HTTP error status, the provider refused the call
    // and didn't bill it, and `auth` without one failed before anything was sent; otherwise it may have been billed
    // (docs/llm.md, "Calling the providers"). Except a 524: Cloudflare's, not the provider's, which cut off a call the
    // provider may have finished and billed; its message says what happened and what may help.
    const message = httpStatus === 524 ? cloudflareTimeoutMessage(PROVIDER_NAMES[config.provider]) : err instanceof Error ? err.message : String(err);
    const kind = err instanceof LlmError ? err.kind : "unknown";
    await db
      .prepare("UPDATE llm_calls SET status = 'error', error = ?, error_kind = ?, http_status = ?, finished_at = ? WHERE id = ?")
      .bind(message, kind, httpStatus, new Date().toISOString(), callId)
      .run();
    answer = { callId, cached: false, status: "error", text: null, json: null, error: message, usage: null, costUsd: null, vatPercent: 0 };
  }
  return answer;
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

// Whether two configs do exactly the same: everything but their ids, names and dates.
function sameValues(a: ModelConfigRow, b: ModelConfigRow): boolean {
  const keys = ["provider", "model_id", "model_string", "family", "effort", "region", "routing", "project", "account", "pricing_kind", "pricing_reference"] as const;
  return keys.every((k) => (a[k] ?? null) === (b[k] ?? null)) && canonicalJson(JSON.parse(a.secrets_json)) === canonicalJson(JSON.parse(b.secrets_json));
}

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
    account: (body.account as Account | undefined) ?? null,
    secrets_json: canonicalJson(body.secrets ?? {}),
    pricing_kind: pricing.kind,
    pricing_reference: pricing.kind === "list" ? (pricing.reference ?? null) : null,
    created_at: new Date().toISOString(),
    deleted_at: null,
  };
}

function insertConfig(db: D1Database, row: ModelConfigRow): D1PreparedStatement {
  return db
    .prepare(
      "INSERT INTO model_configs (id, name, provider, model_id, model_string, family, effort, region, routing, project, account, secrets_json, pricing_kind, pricing_reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
      row.account,
      row.secrets_json,
      row.pricing_kind,
      row.pricing_reference,
      row.created_at,
    );
}
