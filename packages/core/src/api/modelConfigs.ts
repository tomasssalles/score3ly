// Model configs as the Worker's API sends and takes them (docs/llm.md, "Model configs"), the words both sides use for
// them, and what makes two configs the same.

import { canonicalJson } from "../keys.ts";

// Providers are platforms (decided 2026-11-05); "fake" ships with the app, "fake-dev" is for development.
export type Provider = "anthropic" | "bedrock" | "ai-studio" | "vertex" | "openrouter" | "fake" | "fake-dev";
export const PROVIDERS: Provider[] = ["anthropic", "bedrock", "ai-studio", "vertex", "openrouter", "fake", "fake-dev"];

// As people call them: in the UI and in the default config names.
export const PROVIDER_NAMES: Record<Provider, string> = {
  anthropic: "Anthropic",
  bedrock: "Bedrock",
  "ai-studio": "AI Studio",
  vertex: "Vertex AI",
  openrouter: "OpenRouter",
  fake: "Fake",
  "fake-dev": "Fake (dev)",
};

export type Family = "claude" | "gemini" | "fake";

// How hard the model thinks. Each adapter maps it to what its provider offers.
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

// An OpenRouter account's plan (docs/llm.md, "OpenRouter"): its fee on credit purchases, and the EU for Business only.
export type Account = "standard" | "business";

// Bedrock's routing, in AWS's terms: global, within the region's geography (an inference profile: EU, US, JP, AU, …),
// or in the region only. Empty (null) for every other provider.
export type Routing = "global" | "geographic" | "in-region";

// Where a request goes: the region ("" for providers without regions; Vertex AI's location as Vertex spells it) and,
// on Bedrock, the routing.
export type Place = { region: string; routing: Routing | null };

// Prices per million tokens, in US dollars, without VAT.
export type Price = { input: number; output: number; cacheRead: number; cacheWrite: number };

// How a config is priced (docs/llm.md, "Configs"): from the list, as its own model or as the reference's; free (the
// free-tier mark); unpriced; or by the provider, whose answers say what each call cost.
export type Pricing = { kind: "list"; reference: string | null } | { kind: "free" } | { kind: "unpriced" } | { kind: "provider" };

// The secrets' fields as people call them (a config's secrets map a field to the name of a Worker secret).
export const SECRET_LABELS: Record<string, string> = {
  apiKey: "API key",
  serviceAccount: "Service account",
  accessKeyId: "Access key ID",
  secretAccessKey: "Secret access key",
};

// A model config (docs/llm.md, "Configs"), as stored, with what the list says about its model (`model`, `family`,
// `modelName`, `unsupported`, `price`) for the browser (`GET /api/model-configs`).
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

// What a new model config is made of (`POST /api/model-configs`; the Worker's `configProblem` checks it), and
// `replaces`: a clone's original, deleted with it.
export type NewModelConfig = {
  name?: string; // left out: the default name
  provider: Provider;
  modelId?: string;
  modelString?: string;
  family?: Family;
  effort: Effort | null;
  region: string;
  routing: Routing | null;
  project?: string;
  account?: Account;
  secrets: Record<string, string>;
  pricing: Pricing;
  replaces?: string;
};

// What the new config form's pickers offer (`GET /api/models`; docs/llm.md): the providers the app supports, each with
// the families the app supports there (each with its effort levels and the sets of secrets its adapter takes) and its
// places; and the listed models that aren't retired, each with its string, places and prices on the providers where the
// list has a price for it.
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

// A guide to what a config's model costs where the provider prices each call itself (OpenRouter;
// `GET /api/model-configs/<id>/price-range`): the lowest and highest of the four prices per million tokens among those
// who run it, without the fee on credits.
export type PriceRange = { input: [number, number]; output: [number, number]; cacheRead: [number, number]; cacheWrite: [number, number] };

// The names of the Worker's secrets, never their values (`GET /api/secrets`), for the secret pickers.
export type SecretNames = { names: string[] };

// When the list of models and prices was collected, and whether it is the mock (`GET /api/prices`; docs/llm.md, "Costs").
export type Prices = { asOf: string; mock: boolean };

// A config's test (`POST /api/model-configs/<id>/test`; docs/llm.md, "The settings page"): how its call ended, and how
// long it took.
export type TestResult = {
  status: "ok" | "cut_off" | "refused" | "unparseable" | "error";
  error: string | null;
  costUsd: number | null; // VAT included
  durationMs: number;
};

// What makes two model configs the same (decided 2026-11-17: a second one isn't created): every value but the id, the
// name and the dates, as stored (`model_configs`' columns). A listed model has no family of its own (null); secrets
// compare by content, whatever the order of their fields.
export type ConfigValues = {
  provider: string;
  model_id: string | null;
  model_string: string | null;
  family: string | null;
  effort: string | null;
  region: string;
  routing: string | null;
  project: string | null;
  account: string | null;
  secrets_json: string;
  pricing_kind: string;
  pricing_reference: string | null;
};

export const CONFIG_VALUES = [
  "provider",
  "model_id",
  "model_string",
  "family",
  "effort",
  "region",
  "routing",
  "project",
  "account",
  "secrets_json",
  "pricing_kind",
  "pricing_reference",
] as const satisfies readonly (keyof ConfigValues)[];

// Whether two configs have the same values. Values missing from a row compare as null; secrets that aren't JSON (a
// damaged import) compare as the text they are.
export function sameConfigValues(a: Partial<Record<keyof ConfigValues, unknown>>, b: Partial<Record<keyof ConfigValues, unknown>>): boolean {
  return CONFIG_VALUES.every((k) => (k === "secrets_json" ? secretsText(a[k]) === secretsText(b[k]) : (a[k] ?? null) === (b[k] ?? null)));
}

function secretsText(json: unknown): string {
  try {
    return canonicalJson(JSON.parse(String(json ?? "{}")));
  } catch {
    return String(json);
  }
}

// The values a new config would be stored with (the Worker's `newConfigRow`): a listed model without a family, a model
// added by hand by its string trimmed, an empty project as none, a reference only for list pricing.
export function valuesOfNew(config: NewModelConfig): ConfigValues {
  const listed = typeof config.modelId === "string" && config.modelId !== "";
  return {
    provider: config.provider,
    model_id: listed ? config.modelId! : null,
    model_string: listed ? null : (config.modelString ?? "").trim(),
    family: listed ? null : (config.family ?? null),
    effort: config.effort ?? null,
    region: config.region ?? "",
    routing: config.routing ?? null,
    project: config.project || null,
    account: config.account ?? null,
    secrets_json: canonicalJson(config.secrets ?? {}),
    pricing_kind: config.pricing.kind,
    pricing_reference: config.pricing.kind === "list" ? (config.pricing.reference ?? null) : null,
  };
}

// A config's values as stored, from what the Worker sends (`ModelConfig`).
export function valuesOf(config: ModelConfig): ConfigValues {
  return {
    provider: config.provider,
    model_id: config.modelId,
    model_string: config.modelId ? null : config.modelString,
    family: config.modelId ? null : config.family,
    effort: config.effort,
    region: config.region,
    routing: config.routing,
    project: config.project,
    account: config.account,
    secrets_json: canonicalJson(config.secrets),
    pricing_kind: config.pricing.kind,
    pricing_reference: config.pricing.kind === "list" ? config.pricing.reference : null,
  };
}



// A config with exactly the values of another (all but the name) isn't created: the Worker refuses it, and the form
// finds it before asking anything else (decided 2026-11-17: no offer to rename it, which named odd names).
export function sameValuesMessage(existing: string): string {
  return `A config with these settings already exists: "${existing}". Two configs can't have the same settings; you can rename a config from its ⋮ menu.`;
}
