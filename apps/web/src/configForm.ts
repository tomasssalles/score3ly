// The model config form's logic (docs/llm.md, "The settings page"), for a new config and for a clone: what each picker
// offers given the others, the default name it would get, what is still missing, and the request it makes. Pure, so the
// dialog (NewModelConfig.tsx) only shows it.

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
  secrets: Record<string, string>;
  pricing: FormPricing | null;
  reference: string | null;
  name: string; // what the user typed, once `nameEdited`; until then the default name stands in
  nameEdited: boolean;
  makeDefault: boolean;
  deleteOriginal: boolean; // a clone: the original is deleted with it
  // A clone's original values that a new config couldn't have (a model, a place or a model priced as that the app no
  // longer supports): the pickers hold them, exceptionally, until the user picks another (docs/llm.md, "Clone").
  pinned: Pinned | null;
};

export type Pinned = {
  model: FormModel;
  family: Family;
  modelName: string | null;
  region: string;
  routing: Routing | null;
  reference: string | null;
  referenceName: string | null;
};

const sameModel = (a: FormModel | null, b: FormModel | null) =>
  a !== null && b !== null && a.kind === b.kind && (a.kind === "listed" ? a.id === (b as { id: string }).id : a.string === (b as { string: string }).string);

export const EMPTY_FORM: FormState = {
  provider: null,
  model: null,
  region: null,
  routing: null,
  effort: null,
  project: "",
  secrets: {},
  pricing: null,
  reference: null,
  name: "",
  nameEdited: false,
  makeDefault: false,
  deleteOriginal: false,
  pinned: null,
};

// The model a provider starts with: Claude Opus 5.5 where it is offered, else Gemini 3.1 Pro, else the first listed one,
// else an unlisted one (decided 2026-11-05).
const PREFERRED_MODELS = ["claude-opus-5-5", "gemini-3-1-pro-preview"];

export function defaultModel(options: ModelOptions, provider: Provider): FormModel {
  const listed = modelsOf(options, provider);
  const id = PREFERRED_MODELS.find((m) => listed.some((x) => x.id === m)) ?? listed[0]?.id;
  return id ? { kind: "listed", id } : { kind: "added", string: "", family: null };
}

// The form as it opens: the first provider, with its model.
export function initialForm(options: ModelOptions): FormState {
  const provider = options.providers[0]?.id ?? null;
  return provider ? settled(options, { ...EMPTY_FORM, provider, model: defaultModel(options, provider) }) : EMPTY_FORM;
}

// Another provider: the form starts over with its model, keeping the name typed, "Make default" and "Delete the
// original".
export function withProvider(options: ModelOptions, form: FormState, provider: Provider): FormState {
  const kept = { name: form.name, nameEdited: form.nameEdited, makeDefault: form.makeDefault, deleteOriginal: form.deleteOriginal };
  return settled(options, { ...EMPTY_FORM, ...kept, provider, model: defaultModel(options, provider) });
}

// A clone's form: the original's values, its name as typed text (decided 2026-11-05), and what the app no longer
// supports pinned so that the pickers can show it.
export function formFromConfig(options: ModelOptions, config: ModelConfig): FormState {
  const model: FormModel = config.modelId ? { kind: "listed", id: config.modelId } : { kind: "added", string: config.modelString ?? config.model, family: config.family };
  const pricing: FormPricing =
    config.pricing.kind === "list" ? (config.pricing.reference ? "as" : "list") : config.pricing.kind;
  const reference = config.pricing.kind === "list" ? config.pricing.reference : null;
  const form: FormState = {
    ...EMPTY_FORM,
    provider: config.provider,
    model,
    region: config.region,
    routing: config.routing,
    effort: config.effort,
    project: config.project ?? "",
    secrets: { ...config.secrets },
    pricing,
    reference,
    name: config.name,
    nameEdited: true,
    pinned: {
      model,
      family: config.family,
      modelName: config.modelName,
      region: config.region,
      routing: config.routing,
      reference,
      referenceName: config.price.kind === "priced" ? config.price.borrowedFrom : (options.models.find((m) => m.id === reference)?.name ?? reference),
    },
  };
  return settled(options, form);
}

export function providerOf(options: ModelOptions, form: FormState): ProviderOption | null {
  return options.providers.find((p) => p.id === form.provider) ?? null;
}

export function listedModel(options: ModelOptions, form: FormState): ModelOption | null {
  const model = form.model;
  return model?.kind === "listed" ? (options.models.find((m) => m.id === model.id) ?? null) : null;
}

// A clone's listed model that the app's list no longer has at all: kept in the pickers, with its name.
export function pinnedModel(form: FormState): Pinned | null {
  return form.pinned && sameModel(form.model, form.pinned.model) ? form.pinned : null;
}

// The model's family: a listed model's, or the one picked for a model added by hand.
export function familyOf(options: ModelOptions, form: FormState): Family | null {
  if (form.model?.kind === "added") return form.model.family;
  return listedModel(options, form)?.family ?? pinnedModel(form)?.family ?? null;
}

// The effort levels the form offers: a listed model's own (none for some), else its family's.
export function effortsOf(options: ModelOptions, form: FormState): Effort[] {
  return listedModel(options, form)?.efforts ?? familyOption(options, form)?.efforts ?? [];
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

// The places the form may pick: a listed model's where it has a price; for a model added by hand, every place of the
// provider (the model it is priced as is then picked among those priced there).
export function placesOf(options: ModelOptions, form: FormState): (Place & { geography?: string })[] {
  const provider = providerOf(options, form);
  if (!provider) return [];
  const withGeography = (p: Place) => provider.places.find((q) => samePlace(p, q)) ?? p;
  const listed = listedModel(options, form);
  const places = listed || form.model?.kind === "listed" ? (listed?.providers[provider.id]?.places ?? []).map(withGeography) : provider.places;
  // A clone's original place, kept while its model is the original's, even where the app no longer supports it.
  const pinned = pinnedModel(form);
  if (pinned && !places.some((p) => samePlace(p, pinned))) {
    return [...places, provider.places.find((p) => samePlace(p, pinned)) ?? { region: pinned.region, routing: pinned.routing }];
  }
  return places;
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

// After a change, what no longer fits is dropped, and the pickers that start on their first entry get it (docs/style.md,
// "Pickers"): the family, the region, the routing; the pricing of a listed model is its own, of a model added by hand
// "Priced as" at first. The effort stays "—" (the model's own default) unless picked. The secrets and the model priced as
// have no sensible first entry: they stay "—", not chosen yet, until the user picks them (`missing` says so).
export function settled(options: ModelOptions, form: FormState): FormState {
  let next = { ...form };
  const provider = providerOf(options, next);
  if (!provider) return { ...EMPTY_FORM, name: next.name, nameEdited: next.nameEdited, makeDefault: next.makeDefault };
  if (next.model?.kind === "added" && next.model.family === null && provider.families.length > 0) {
    next.model = { ...next.model, family: provider.families[0].id };
  }
  if (next.model?.kind === "listed" && !modelsOf(options, provider.id).some((m) => m.id === (next.model as { id: string }).id) && !pinnedModel(next)) {
    next.model = null;
  }
  // Pricing: a listed model at its own price or free; a model added by hand priced as another, unpriced or free.
  if (next.model?.kind === "listed" && next.pricing !== "free") next.pricing = "list";
  if (next.model?.kind === "added" && (next.pricing === "list" || next.pricing === null)) next.pricing = "as";
  if (next.pricing !== "as") next.reference = null;
  // The place.
  const regions = regionsOf(options, next);
  if (next.region !== null && !regions.includes(next.region)) next = { ...next, region: null, routing: null };
  if (next.region === null && regions.length > 0) next.region = regions[0];
  const routings = routingsOf(options, next).map((r) => r.routing);
  if (next.routing !== null && !routings.includes(next.routing)) next.routing = null;
  if (next.routing === null && routings.length > 0) next.routing = routings[0];
  // A reference that isn't priced at the place any more.
  const references = referencesOf(options, next);
  if (next.reference !== null && !references.some((m) => m.id === next.reference) && next.reference !== next.pinned?.reference) next.reference = null;
  // The effort follows the model, the secrets the family.
  const family = familyOption(options, next);
  if (next.effort !== null && !effortsOf(options, next).includes(next.effort)) next.effort = null;
  const fields = family?.secrets ?? [];
  next.secrets = Object.fromEntries(Object.entries(next.secrets).filter(([field]) => fields.includes(field)));
  if (provider.id !== "vertex") next.project = "";
  return next;
}

// The name the Worker gives when none is typed: "Claude Opus 5.5 (Bedrock) · high" (docs/llm.md, "Configs"), before
// numbering.
export function defaultName(options: ModelOptions, form: FormState): string | null {
  const provider = providerOf(options, form);
  const model = listedModel(options, form)?.name ?? pinnedModel(form)?.modelName ?? (form.model?.kind === "added" ? form.model.string.trim() : "");
  if (!provider || !model) return null;
  return `${model} (${provider.name})${form.effort ? ` · ${form.effort}` : ""}`;
}

export const SECRET_LABELS: Record<string, string> = {
  apiKey: "API key",
  serviceAccount: "Service account",
};

// What is still missing, as a sentence, or null when the config can be created.
export function missing(options: ModelOptions, form: FormState): string | null {
  const provider = providerOf(options, form);
  if (!provider) return "The provider isn't chosen yet.";
  if (!form.model) return "The model isn't chosen yet.";
  if (form.model.kind === "added" && form.model.string.trim() === "") return "The model identifier is still empty.";
  if (form.model.kind === "added" && form.model.family === null) return "The model's family isn't chosen yet.";
  if (form.region === null) return "The region isn't chosen yet.";
  if (routingsOf(options, form).length > 0 && form.routing === null) return "The routing isn't chosen yet.";
  const family = familyOption(options, form);
  const unset = (family?.secrets ?? []).find((field) => !form.secrets[field]);
  if (unset) return `The secret for the ${SECRET_LABELS[unset] ?? unset} isn't chosen yet.`;
  if (form.pricing === null) return "The pricing isn't chosen yet.";
  if (form.pricing === "as" && form.reference === null) return "The model it is priced as isn't chosen yet.";
  // A clone of a config the app no longer supports, as it was: not saved until it is supported (docs/llm.md, "Clone").
  const where = `${provider.name}${form.region ? ` in ${form.region}` : ""}${form.routing ? ` (${form.routing} routing)` : ""}`;
  if (form.model.kind === "listed" && priceAt(options, form) === null) {
    return `The app no longer supports ${listedModel(options, form)?.name ?? pinnedModel(form)?.modelName ?? form.model.id} on ${where}.`;
  }
  if (form.pricing === "as" && priceAt(options, form) === null) {
    const reference = options.models.find((m) => m.id === form.reference)?.name ?? form.pinned?.referenceName ?? form.reference;
    return `The app has no price for ${reference} on ${where} any more.`;
  }
  return null;
}

// The request that creates it (the Worker checks it again).
export function requestOf(form: FormState): NewModelConfig {
  // (The clone's `replaces` is added by the dialog, which knows the original.)
  const model = form.model!;
  return {
    ...(form.nameEdited && form.name.trim() ? { name: form.name.trim() } : {}),
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

// The config that already has exactly the values the form would create, if any (the Worker refuses a second one,
// docs/llm.md, "Managing model configs"): found before anything is asked, so that renaming it can be offered first.
export function sameValues(configs: ModelConfig[], request: NewModelConfig): ModelConfig | null {
  const secrets = (s: Record<string, string>) => JSON.stringify(Object.entries(s).sort(([a], [b]) => a.localeCompare(b)));
  const reference = (p: ModelConfig["pricing"]) => (p.kind === "list" ? p.reference : null);
  return (
    configs.find(
      (c) =>
        c.provider === request.provider &&
        (c.modelId ?? null) === (request.modelId ?? null) &&
        (c.modelId ? true : c.modelString === request.modelString && c.family === request.family) &&
        c.effort === request.effort &&
        c.region === request.region &&
        c.routing === request.routing &&
        (c.project ?? null) === (request.project ?? null) &&
        secrets(c.secrets) === secrets(request.secrets) &&
        c.pricing.kind === request.pricing.kind &&
        reference(c.pricing) === reference(request.pricing),
    ) ?? null
  );
}
