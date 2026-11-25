// Model configs (docs/llm.md, "Model configs"): the stored rows and what the browser gets, the checks a config must pass
// and why a stored one is no longer supported, their names, the secrets they name, the config form's options, configs
// added by hand converted when a new list has them, and the routes: the pickers' endpoints, creating, cloning, renaming,
// deleting and testing a config.

import type { Hono } from "hono";
import { canonicalJson, type CallPlace, type CallRequest, firstFreeName, MAX_NAME_LENGTH, nameTooLong, ROUTINGS, sameConfigValues, sameValuesMessage, sha256Hex, type ModelConfig, type ModelOptions, type PriceRange, type Prices, type SecretNames, type TestResult } from "@score3ly/core";
import { badRequest, NO_MODEL_CONFIG, problemText, refuse } from "./refusals.ts";
import { fetchPriceRange } from "./llm/prices.ts";
import type { Effort } from "./llm/index.ts";
import { llmTimeoutMs } from "./llm/timeouts.ts";
import { isSupported, secretSets, supportedFamilies } from "./llm/adapters.ts";
import {
  ACCOUNT_FEES,
  ACCOUNTS,
  BUSINESS_REGIONS,
  configBaseName,
  configModel,
  EFFORTS,
  effortsOf,
  FAMILY_NAMES,
  listedPrice,
  modelById,
  modelByString,
  priceEntry,
  placesOf,
  pricesOf,
  placesOfProvider,
  priceOfConfig,
  PRICED_BY_PROVIDER,
  PROVIDER_NAMES,
  PROVIDERS,
  resolvedModel,
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
import { feeOf } from "./spending.ts";
import { readSettings } from "./settings.ts";
import { sendCall } from "./llmCalls.ts";

// A model config as the browser gets it is `ModelConfig` (core); as stored, a row:
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

// Why the app no longer supports a stored config, or null where it does (docs/llm.md, "No longer supported"). A config
// is supported when it is valid as a whole by today's code and list: when the request that would create it now passes
// the same checks (`configProblem`). Said after the config's name: `its model config, "X", ${reason}.`
// `dev`: whether the Worker offers the providers for development (`devProviders`): a config of one is unsupported
// without them (dec. 12).
export function unsupportedOf(row: ModelConfigRow, dev: boolean, pricing: Pricing = pricingOf(row), list: ModelList = MODEL_LIST): string | null {
  if (row.provider === "fake-dev" && !dev) return `uses ${PROVIDER_NAMES[row.provider]}, a provider for development that this Worker doesn't offer (start it with DEV_PROVIDERS=true)`;
  const problem = configProblem(bodyOf(row, pricing), list);
  if (problem === null) return null;
  return unsupportedReason(list, row, pricing) ?? `can't be used as it is any more (${problem})`;
}

// The request that would create a stored config now.
function bodyOf(row: ModelConfigRow, pricing: Pricing): Record<string, unknown> {
  const secrets = secretsOf(row);
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
  } else if (!row.family || !isSupported(p, row.family)) {
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
  // The credentials: one of the sets of secrets the adapter takes (unreadable ones: the checks say so).
  const secrets = secretsOf(row) ?? {};
  const fields = Object.keys(secrets).sort().join(",");
  if (!secretSets(p, entry?.family ?? row.family!)!.some((set) => [...set].sort().join(",") === fields)) {
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

// A stored config's secrets, the names of the Worker secrets by the adapter's fields (`secrets_json`), read in one place:
// null where they can't be read as names (a row written by hand or by an older import), which `unsupportedOf` reports.
export function secretsOf(row: Pick<ModelConfigRow, "secrets_json">): Record<string, string> | null {
  let secrets: unknown;
  try {
    secrets = JSON.parse(row.secrets_json);
  } catch {
    return null;
  }
  return isSecrets(secrets) ? secrets : null;
}

// Whether a value names secrets: an object of texts.
export function isSecrets(value: unknown): value is Record<string, string> {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.values(value).every((x) => typeof x === "string");
}

function pricingOf(row: ModelConfigRow): Pricing {
  return row.pricing_kind === "list" ? { kind: "list", reference: row.pricing_reference } : { kind: row.pricing_kind };
}
function configPrice(row: ModelConfigRow, pricing: Pricing, list: ModelList = MODEL_LIST): ModelConfig["price"] {
  const priced = priceOfConfig(list, { provider: row.provider, model: configModel(row), place: { region: row.region, routing: row.routing }, pricing });
  if (priced.kind === "provider") return { kind: "provider", fee: feeOf(row) };
  if (priced.kind !== "priced") return priced;
  return { ...priced, borrowedFrom: priced.borrowedFrom ? (modelById(list, priced.borrowedFrom)?.name ?? priced.borrowedFrom) : null };
}

export function toModelConfig(row: ModelConfigRow, dev: boolean): ModelConfig {
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
    unsupported: unsupportedOf(row, dev, pricing),
    effort: row.effort,
    region: row.region,
    routing: row.routing,
    project: row.project,
    account: row.account ?? null,
    secrets: secretsOf(row) ?? {},
    pricing,
    price: configPrice(row, pricing),
    freeTier: pricing.kind === "free",
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}
// What a model config's body must be (docs/llm.md, "Configs"). Returns the problem, or null.
export function configProblem(body: Record<string, unknown> | null, list: ModelList = MODEL_LIST): string | null {
  if (!body) return "expected a JSON body";
  const { name, provider, modelId, modelString, family, effort, region, routing, project, account, secrets, pricing } = body;
  if (name !== undefined && name !== null && typeof name !== "string") return "'name' must be text";
  if (typeof name === "string" && nameTooLong(name.trim())) return `'name' must be at most ${MAX_NAME_LENGTH} characters`;
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
    // A string the list has for this provider is a listed model: picked from the list, never added by hand. (A model
    // the list has with a string on a provider has a price there, `listProblems`; a retired one can be added.)
    const listed = modelByString(list, p, modelString.trim());
    if (listed) return `${listed.name} is in the app's list: pick it there`;
    if (!supportedFamilies(p).includes(family as Family)) {
      return `'family' must be one the app supports on ${PROVIDER_NAMES[p]}: ${supportedFamilies(p).map((f) => FAMILY_NAMES[f]).join(", ")}`;
    }
    modelFamily = family as Family;
  }
  if (!isSupported(p, modelFamily)) return `The app doesn't support ${FAMILY_NAMES[modelFamily]} on ${PROVIDER_NAMES[p]}`;
  const efforts = effortsOf(modelFamily, typeof modelId === "string" ? modelById(list, modelId) : null);
  if (effort !== undefined && effort !== null && !efforts.includes(effort as Effort)) {
    return efforts.length === 0
      ? `${modelById(list, modelId as string)?.name ?? "This model"} takes no effort level: leave 'effort' out`
      : `'effort' must be one of ${efforts.join(", ")}`;
  }
  // Where: one of the provider's places in the list.
  if (region !== undefined && typeof region !== "string") return "'region' must be text";
  if (routing !== undefined && routing !== null && !ROUTINGS.includes(routing as Routing)) {
    return "'routing' must be global, geographic or in-region";
  }
  const place: Place = { region: (region as string | undefined) ?? "", routing: (routing as Routing | null | undefined) ?? null };
  if (!placesOfProvider(list, p).some((other) => samePlace(other, place))) {
    return `${PROVIDER_NAMES[p]} has no region ${place.region || '""'}${place.routing ? ` with ${place.routing} routing` : ""} in the list`;
  }
  // A listed model only where the list offers it (with its price, or priced by the provider), however the config is
  // priced: elsewhere the app doesn't support it.
  const byProvider = PRICED_BY_PROVIDER.includes(p);
  if (typeof modelId === "string" && modelId !== "" && !(byProvider ? priceEntry(list, modelId, p, place) : listedPrice(list, modelId, p, place))) {
    return `The app doesn't support ${modelById(list, modelId)!.name} on ${PROVIDER_NAMES[p]} there: pick another region`;
  }
  if (project !== undefined && project !== null && (p !== "vertex" || typeof project !== "string")) return "'project' is for Vertex AI only";
  // OpenRouter's account: its plan sets the fee, and only Business may use the EU.
  if (p === "openrouter") {
    if (!ACCOUNTS.includes(account as Account)) return `'account' must be one of ${ACCOUNTS.join(", ")} for ${PROVIDER_NAMES[p]}`;
    if (BUSINESS_REGIONS.includes(place.region) && account !== "business") return `Only a Business account may use ${PROVIDER_NAMES[p]} in the ${place.region.toUpperCase()}`;
  } else if (account !== undefined && account !== null) return "'account' is for OpenRouter only";
  // The secrets: one of the adapter's sets.
  if (secrets !== undefined && !isSecrets(secrets)) return "'secrets' must map names to text";
  const keys = Object.keys((secrets ?? {}) as Record<string, string>).sort().join(",");
  const sets = secretSets(p, modelFamily)!;
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

export function badSecretMessage(configName: string, problem: string): string {
  return `A secret of the model config "${configName}" can't be used: ${problem} Check it where the app's secrets are kept (Settings, "Secrets"), then retry.`;
}

// The secrets' values from the Worker's environment, or the name of a missing one.
export function secretValues(config: ModelConfig, env: Env): Record<string, string> | { missing: string } {
  const values: Record<string, string> = {};
  for (const [field, secretName] of Object.entries(config.secrets)) {
    const value = (env as unknown as Record<string, unknown>)[secretName];
    if (typeof value !== "string" || value === "") return { missing: secretName };
    values[field] = value;
  }
  return values;
}
// What the config form's pickers need (docs/llm.md, "The settings page"): each provider with its name, the families the
// app supports there (each with its effort levels and the sets of secrets its adapter takes) and its places; and the
// listed models that aren't retired, each with its string, places and prices on the providers where the list has a
// price for it. A model added by hand is offered its provider's places; a listed one only those with its price.
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
        secrets: secretSets(id, family)!,
      })),
      places: placesOfProvider(list, id),
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
            .map((p) => [p, { string: m.strings[p]!, places: pricesOf(list, m.id, p).map((x) => ({ region: x.region, routing: x.routing, price: x.price })) }] as const)
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

export function modelConfigRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/api/models", (c) => c.json<ModelOptions>(modelOptions(MODEL_LIST, devProviders(c.env))));

  app.get("/api/secrets", (c) => c.json<SecretNames>({ names: secretNames(c.env) }));

  // A guide to what a config's model costs where the provider prices each call itself (OpenRouter: docs/llm.md,
  // "OpenRouter"): the range of its providers' input and output prices, or null.
  app.get("/api/model-configs/:id/price-range", async (c) => {
    const row = await c.env.DB.prepare("SELECT * FROM model_configs WHERE id = ?").bind(c.req.param("id")).first<ModelConfigRow>();
    if (!row) return refuse(c, 404, NO_MODEL_CONFIG);
    if (row.provider !== "openrouter") return c.json<{ range: PriceRange | null }>({ range: null });
    const { model } = resolvedModel(row);
    return c.json<{ range: PriceRange | null }>({ range: model ? await fetchPriceRange(model, row.region) : null });
  });

  // When the list of models and prices was collected (llm/modelList.ts), for the About page.
  app.get("/api/prices", (c) => c.json<Prices>({ asOf: MODEL_LIST.asOf, mock: MODEL_LIST.mock ?? false }));
  // The model configs that aren't deleted, oldest first.
  app.get("/api/model-configs", async (c) => {
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM model_configs WHERE deleted_at IS NULL ORDER BY created_at, id",
    ).all<ModelConfigRow>();
    return c.json<ModelConfig[]>(results.map((row) => toModelConfig(row, devProviders(c.env))));
  });

  // One model config, deleted or not: stages and calls refer to the config they used.
  app.get("/api/model-configs/:id", async (c) => {
    const row = await c.env.DB.prepare("SELECT * FROM model_configs WHERE id = ?").bind(c.req.param("id")).first<ModelConfigRow>();
    return row ? c.json<ModelConfig>(toModelConfig(row, devProviders(c.env))) : refuse(c, 404, NO_MODEL_CONFIG);
  });

  // Creates a config, or clones one: `replaces` names the original to delete with it ("Delete the original"; the clone
  // becomes the default if the original was). A config with exactly the same values as one that isn't deleted isn't
  // created (docs/llm.md, "Managing model configs"): 409 with `code` "same_values", naming it.
  app.post("/api/model-configs", async (c) => {
    const db = c.env.DB;
    const body = await c.req.json().catch(() => null);
    const problem = configProblem(body);
    if (problem) return refuse(c, 400, problemText(problem));
    if (body.provider === "fake-dev" && !devProviders(c.env)) {
      return refuse(c, 400, "Fake with costs is a provider for development: start the Worker with DEV_PROVIDERS=true to use it.");
    }
    if (body.replaces !== undefined && typeof body.replaces !== "string") return badRequest(c, "'replaces' must be a model config's id");
    const original =
      typeof body.replaces === "string"
        ? await db.prepare("SELECT id, name FROM model_configs WHERE id = ? AND deleted_at IS NULL").bind(body.replaces).first<{ id: string; name: string }>()
        : null;
    if (typeof body.replaces === "string" && !original) return refuse(c, 404, "The config to replace doesn't exist any more: it may have been deleted on another device.");
    const draft = newConfigRow(body, "");
    const same = (await db.prepare("SELECT * FROM model_configs WHERE deleted_at IS NULL").all<ModelConfigRow>()).results.find((row) => sameConfigValues(row, draft));
    if (same) {
      return refuse(c, 409, sameValuesMessage(same.name), "same_values");
    }
    const name = await configName(db, body, original?.id ?? null);
    if (name === null) return refuse(c, 409, NAME_TAKEN, "name_taken");
    const row = { ...draft, name };
    // The original is deleted first, so that the clone can take its name (the names' unique index counts live configs).
    const statements: D1PreparedStatement[] = [];
    if (original) statements.push(db.prepare("UPDATE model_configs SET deleted_at = ? WHERE id = ?").bind(row.created_at, original.id));
    statements.push(insertConfig(db, row));
    if (original) {
      const { defaultModelConfigId } = await readSettings(db);
      if (defaultModelConfigId === original.id) {
        statements.push(
          db.prepare("INSERT OR REPLACE INTO settings (key, value_json, updated_at) VALUES ('defaultModelConfigId', ?, ?)").bind(JSON.stringify(row.id), row.created_at),
        );
      }
    }
    await db.batch(statements);
    return c.json<ModelConfig>(toModelConfig(row, devProviders(c.env)), 201);
  });

  // Renames a config: the only change a config's row takes besides its deletion (docs/llm.md, "Managing model configs").
  // The name is required and unique, ignoring case, among the configs that aren't deleted; changing only its case is
  // allowed.
  app.patch("/api/model-configs/:id", async (c) => {
    const db = c.env.DB;
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return badRequest(c, "expected a 'name'");
    if (nameTooLong(name)) return badRequest(c, `'name' must be at most ${MAX_NAME_LENGTH} characters`);
    const row = await db.prepare("SELECT * FROM model_configs WHERE id = ? AND deleted_at IS NULL").bind(id).first<ModelConfigRow>();
    if (!row) return refuse(c, 404, NO_MODEL_CONFIG);
    const taken = await db
      .prepare("SELECT id FROM model_configs WHERE deleted_at IS NULL AND id <> ? AND name = ? COLLATE NOCASE")
      .bind(id, name)
      .first();
    if (taken) return refuse(c, 409, NAME_TAKEN, "name_taken");
    await db.prepare("UPDATE model_configs SET name = ? WHERE id = ?").bind(name, id).run();
    return c.json<ModelConfig>(toModelConfig({ ...row, name }, devProviders(c.env)));
  });

  app.delete("/api/model-configs/:id", async (c) => {
    // The default can't be deleted until another config is the default (docs/llm.md, "Managing model configs").
    const { defaultModelConfigId } = await readSettings(c.env.DB);
    if (defaultModelConfigId === c.req.param("id")) {
      const row = await c.env.DB.prepare("SELECT name FROM model_configs WHERE id = ? AND deleted_at IS NULL")
        .bind(defaultModelConfigId)
        .first<{ name: string }>();
      if (row) {
        return refuse(c, 409, `"${row.name}" is the default model config: make another config the default first.`, "default_model_config");
      }
    }
    const result = await c.env.DB.prepare("UPDATE model_configs SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL")
      .bind(new Date().toISOString(), c.req.param("id"))
      .run();
    return result.meta.changes === 0 ? refuse(c, 404, NO_MODEL_CONFIG) : c.body(null, 204);
  });

  // A config's test (docs/llm.md, "The settings page"): one small real request, with an image and a JSON schema, that
  // shows the model, the place, the key, the effort and structured output working before a long run. Never served from
  // the record nor cached: it is sent every time, recorded as a call of no stage, and counts towards the spending cap.
  // Real providers only (decided 2026-11-06): the fake ones need no test.
  app.post("/api/model-configs/:id/test", async (c) => {
    const row = await c.env.DB.prepare("SELECT * FROM model_configs WHERE id = ?").bind(c.req.param("id")).first<ModelConfigRow>();
    if (!row) return refuse(c, 404, NO_MODEL_CONFIG);
    if (row.deleted_at) return refuse(c, 409, `The model config "${row.name}" was deleted.`, "deleted_model_config");
    const unsupported = unsupportedOf(row, devProviders(c.env));
    if (unsupported) return refuse(c, 409, `The model config "${row.name}" ${unsupported}.`, "unsupported_model_config");
    if (row.provider === "fake" || row.provider === "fake-dev") return refuse(c, 400, "Only configs of real providers can be tested.");
    const startedAt = Date.now();
    const sent = await sendCall(c.env, row, TEST_REQUEST, `test:${crypto.randomUUID()}`, null, TEST_PLACE, llmTimeoutMs("test"), c.req.raw.signal);
    if ("refusal" in sent) return refuse(c, sent.refusal.status, sent.refusal.error, sent.refusal.code);
    const durationMs = Date.now() - startedAt;
    // An answer outside the schema fails the test, as a stage couldn't use it either: recorded as unusable, like a
    // stage's (§5.2), and said with what came back.
    if (sent.status === "ok" && typeof (sent.json as { colour?: unknown } | null)?.colour !== "string") {
      const error = `The response has an OK status and is valid JSON, but doesn't follow the schema the request asked for. Requested schema: {"colour": string}. Response: ${(sent.text ?? "").slice(0, 200)}`;
      await c.env.DB.prepare("UPDATE llm_calls SET status = 'unparseable', error = ? WHERE id = ?").bind(error, sent.callId).run();
      return c.json<TestResult>({ ...sent, status: "unparseable", error, durationMs });
    }
    return c.json<TestResult>({ ...sent, durationMs });
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
const TEST_PLACE: CallPlace = { item: "", round: 1 };

// The name of a new config: the one given, or else its default name ("Claude Opus 5.5 (Bedrock) · high"), the first
// free one, numbered like project names (docs/llm.md, "Configs"). A given name that another config has (ignoring case)
// is refused: null. A clone that replaces its original may take the original's name: it is deleted in the same batch.
async function configName(db: D1Database, body: Record<string, unknown>, replaces: string | null = null): Promise<string | null> {
  const { results } = await db
    .prepare("SELECT name FROM model_configs WHERE deleted_at IS NULL AND id IS NOT ?")
    .bind(replaces)
    .all<{ name: string }>();
  const taken = results.map((row) => row.name);
  const given = typeof body.name === "string" ? body.name.trim() : "";
  if (given) return taken.some((name) => name.toLowerCase() === given.toLowerCase()) ? null : given;
  const model: ConfigModel = body.modelId ? { modelId: body.modelId as string } : { modelString: (body.modelString as string).trim(), family: body.family as Family };
  const base = configBaseName(MODEL_LIST, body.provider as Provider, model, (body.effort as Effort | undefined) ?? null);
  return firstFreeName(base, taken);
}

const NAME_TAKEN = "A model config with that name already exists. Names must be unique (case-insensitive).";

// The row a creation's body makes (checked by `configProblem` first), with its secrets as canonical JSON.
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

export function insertConfig(db: D1Database, row: ModelConfigRow): D1PreparedStatement {
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
