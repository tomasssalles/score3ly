// The new model config form's logic (docs/llm.md, "The settings page"): what each picker offers given the others, the
// default name it would get, what is still missing, and the request it makes. Pure, so the dialog (NewModelConfig.tsx)
// only shows it.

import type { Family, ModelConfig, ModelOptions, NewModelConfig, Place, Provider, Routing } from "./api";

type Effort = NonNullable<ModelConfig["effort"]>;
type ProviderOption = ModelOptions["providers"][number];
type ModelOption = ModelOptions["models"][number];

// A listed model, or one added by hand (its string and family).
export type FormModel = { kind: "listed"; id: string } | { kind: "added"; string: string; family: Family | null };

// "list": a listed model at its own price; "as": a model added by hand priced as a listed one (`reference`).
export type FormPricing = "list" | "as" | "unpriced" | "free";

export type FormState = {
  provider: Provider | null;
  model: FormModel | null;
  region: string | null;
  routing: Routing | null;
  effort: Effort | null; // null: the model's default
  project: string;
  secretSet: number; // which of the adapter's sets of secrets (Bedrock: an API key, or an access key pair)
  secrets: Record<string, string>;
  pricing: FormPricing | null;
  reference: string | null;
  name: string;
  makeDefault: boolean;
};

export const EMPTY_FORM: FormState = {
  provider: null,
  model: null,
  region: null,
  routing: null,
  effort: null,
  project: "",
  secretSet: 0,
  secrets: {},
  pricing: null,
  reference: null,
  name: "",
  makeDefault: false,
};

export function providerOf(options: ModelOptions, form: FormState): ProviderOption | null {
  return options.providers.find((p) => p.id === form.provider) ?? null;
}

export function listedModel(options: ModelOptions, form: FormState): ModelOption | null {
  const model = form.model;
  return model?.kind === "listed" ? (options.models.find((m) => m.id === model.id) ?? null) : null;
}

// The model's family: a listed model's, or the one picked for a model added by hand.
export function familyOf(options: ModelOptions, form: FormState): Family | null {
  if (form.model?.kind === "added") return form.model.family;
  return listedModel(options, form)?.family ?? null;
}

export function familyOption(options: ModelOptions, form: FormState) {
  const family = familyOf(options, form);
  return providerOf(options, form)?.families.find((f) => f.id === family) ?? null;
}

const samePlace = (a: Place, b: Place) => a.region === b.region && a.routing === b.routing;

// The listed models a provider offers (with a price somewhere), among the families the app supports there.
export function modelsOf(options: ModelOptions, provider: Provider): ModelOption[] {
  return options.models.filter((m) => m.providers[provider] !== undefined);
}

// Whether a listed model has a price at the form's region (any routing there), or there is no region yet.
export function servedAtRegion(model: ModelOption, provider: Provider, region: string | null): boolean {
  return region === null || (model.providers[provider]?.places.some((p) => p.region === region) ?? false);
}

// The places the form may pick: a listed model's where it has a price; a model added by hand priced as a listed one,
// that one's; otherwise every place of the provider.
export function placesOf(options: ModelOptions, form: FormState): (Place & { geography?: string })[] {
  const provider = providerOf(options, form);
  if (!provider) return [];
  const withGeography = (p: Place) => provider.places.find((q) => samePlace(p, q)) ?? p;
  const listed = listedModel(options, form);
  if (listed) return (listed.providers[provider.id]?.places ?? []).map(withGeography);
  if (form.model?.kind === "added" && form.pricing === "as" && form.reference) {
    const reference = options.models.find((m) => m.id === form.reference);
    return (reference?.providers[provider.id]?.places ?? []).map(withGeography);
  }
  return provider.places;
}

// The regions to pick from, in order, each once.
export function regionsOf(options: ModelOptions, form: FormState): string[] {
  return [...new Set(placesOf(options, form).map((p) => p.region))];
}

// The routings at the form's region (Bedrock), with the geography for a geographic one.
export function routingsOf(options: ModelOptions, form: FormState): { routing: Routing; geography?: string }[] {
  return placesOf(options, form)
    .filter((p) => p.region === form.region && p.routing !== null)
    .map((p) => ({ routing: p.routing!, ...(p.geography ? { geography: p.geography } : {}) }));
}

export function routingLabel(routing: Routing, geography?: string): string {
  return routing === "global" ? "Global" : routing === "geographic" ? `Geographic${geography ? ` (${geography})` : ""}` : "In-region";
}

// Whether the provider has regions at all (Anthropic and AI Studio don't).
export function hasRegions(options: ModelOptions, form: FormState): boolean {
  return (providerOf(options, form)?.places ?? []).some((p) => p.region !== "");
}

// The listed models a model added by hand may be priced as: of its family, with a price at the form's place (or
// anywhere on the provider while no place is picked).
export function referencesOf(options: ModelOptions, form: FormState): ModelOption[] {
  const family = familyOf(options, form);
  if (!form.provider || !family) return [];
  return modelsOf(options, form.provider).filter(
    (m) =>
      m.family === family &&
      (form.region === null || m.providers[form.provider!]!.places.some((p) => p.region === form.region && (form.routing === null || p.routing === form.routing))),
  );
}

// The price the config would have: a listed model's own, or the reference's, at the form's place.
export function priceAt(options: ModelOptions, form: FormState) {
  const id = form.pricing === "list" ? listedModel(options, form)?.id : form.pricing === "as" ? form.reference : null;
  const model = options.models.find((m) => m.id === id);
  if (!model || !form.provider || form.region === null) return null;
  return model.providers[form.provider]?.places.find((p) => samePlace(p, { region: form.region!, routing: form.routing }))?.price ?? null;
}

// After a change, what no longer fits is dropped, and a choice with one option is made: the place (a provider without
// regions, a region with one routing), the family (a provider with one), the pricing (a listed model's own).
export function settled(options: ModelOptions, form: FormState): FormState {
  let next = { ...form };
  const provider = providerOf(options, next);
  if (!provider) return { ...EMPTY_FORM, name: next.name, makeDefault: next.makeDefault };
  if (next.model?.kind === "added" && next.model.family === null && provider.families.length === 1) {
    next.model = { ...next.model, family: provider.families[0].id };
  }
  if (next.model?.kind === "listed" && !modelsOf(options, provider.id).some((m) => m.id === (next.model as { id: string }).id)) next.model = null;
  // Pricing: a listed model at its own price or free; a model added by hand priced as another, unpriced or free.
  if (next.model?.kind === "listed" && next.pricing !== "free") next.pricing = "list";
  if (next.model?.kind === "added" && next.pricing === "list") next.pricing = null;
  if (next.pricing !== "as") next.reference = null;
  // The place.
  const regions = regionsOf(options, next);
  if (next.region !== null && !regions.includes(next.region)) next = { ...next, region: null, routing: null };
  if (next.region === null && regions.length === 1) next.region = regions[0];
  const routings = routingsOf(options, next).map((r) => r.routing);
  if (next.routing !== null && !routings.includes(next.routing)) next.routing = null;
  if (next.routing === null && routings.length === 1) next.routing = routings[0];
  // A reference that isn't priced at the place any more.
  if (next.reference !== null && !referencesOf(options, next).some((m) => m.id === next.reference)) next.reference = null;
  // The effort and the secrets follow the family.
  const family = familyOption(options, next);
  if (next.effort !== null && !(family?.efforts ?? []).includes(next.effort)) next.effort = null;
  const sets = family?.secrets ?? [[]];
  if (next.secretSet >= sets.length) next.secretSet = 0;
  next.secrets = Object.fromEntries(Object.entries(next.secrets).filter(([field]) => sets[next.secretSet].includes(field)));
  if (provider.id !== "vertex") next.project = "";
  return next;
}

// The name the Worker gives when none is typed: "Claude Opus 5.5 (Bedrock) · high" (docs/llm.md, "Configs"), before
// numbering.
export function defaultName(options: ModelOptions, form: FormState): string | null {
  const provider = providerOf(options, form);
  const model = listedModel(options, form)?.name ?? (form.model?.kind === "added" ? form.model.string.trim() : "");
  if (!provider || !model) return null;
  return `${model} (${provider.name})${form.effort ? ` · ${form.effort}` : ""}`;
}

// What is still missing, as a sentence, or null when the config can be created.
export function missing(options: ModelOptions, form: FormState): string | null {
  const provider = providerOf(options, form);
  if (!provider) return "Pick a provider.";
  if (!form.model) return "Pick a model.";
  if (form.model.kind === "added" && form.model.string.trim() === "") return "Enter the model's string.";
  if (form.model.kind === "added" && form.model.family === null) return "Pick the model's family.";
  if (form.region === null) return "Pick a region.";
  if (routingsOf(options, form).length > 0 && form.routing === null) return "Pick a routing.";
  const family = familyOption(options, form);
  const fields = family?.secrets[form.secretSet] ?? [];
  if (fields.some((field) => !form.secrets[field])) return "Pick the secrets.";
  if (form.pricing === null) return "Pick how its calls are priced.";
  if (form.pricing === "as" && form.reference === null) return "Pick the model it is priced as.";
  return null;
}

// The request that creates it (the Worker checks it again).
export function requestOf(form: FormState): NewModelConfig {
  const model = form.model!;
  return {
    ...(form.name.trim() ? { name: form.name.trim() } : {}),
    provider: form.provider!,
    ...(model.kind === "listed" ? { modelId: model.id } : { modelString: model.string.trim(), family: model.family! }),
    effort: form.effort,
    region: form.region ?? "",
    routing: form.routing,
    ...(form.project.trim() ? { project: form.project.trim() } : {}),
    secrets: form.secrets,
    pricing:
      form.pricing === "list" ? { kind: "list", reference: null }
      : form.pricing === "as" ? { kind: "list", reference: form.reference }
      : { kind: form.pricing! },
  };
}

// What creating it asks to confirm, for a price the app can't vouch for (docs/llm.md, "Models the user adds"), or null.
export function confirmationOf(options: ModelOptions, form: FormState): string | null {
  if (form.pricing === "as") {
    const reference = options.models.find((m) => m.id === form.reference)?.name ?? "the other model";
    return `The costs and the spending cap use ${reference}'s prices for this model. Check the provider's price page.`;
  }
  if (form.pricing === "unpriced") return "The spending cap can't limit this model's calls, and the costs won't include them. Check your charges with the provider.";
  if (form.pricing === "free") return "Its calls will cost $0.00 and won't count towards the spending cap. Only for a model your account really doesn't pay for.";
  return null;
}
