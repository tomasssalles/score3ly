// The model configs' list on the Settings page's "Model configs" tab (docs/project-view.md, "The menu and its pages"):
// its order, and its filter by provider and by model. Only what is shown changes: nothing is stored.

import type { ModelConfig } from "./api";

export type ConfigOrder = "newest" | "oldest" | "name-asc" | "name-desc";

export const CONFIG_ORDERS: { id: ConfigOrder; label: string }[] = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "name-asc", label: "Name, A to Z" },
  { id: "name-desc", label: "Name, Z to A" },
];

// Names in the order people expect: ignoring case and accents, numbers by their value ("Opus 2" before "Opus 10").
const byName = (a: ModelConfig, b: ModelConfig) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
// Creation times, the name breaking a tie (configs made in the same instance, e.g. imported together).
const byAge = (a: ModelConfig, b: ModelConfig) => a.createdAt.localeCompare(b.createdAt) || byName(a, b);

export function sortedConfigs(configs: ModelConfig[], order: ConfigOrder): ModelConfig[] {
  const compare = { newest: (a: ModelConfig, b: ModelConfig) => byAge(b, a), oldest: byAge, "name-asc": byName, "name-desc": (a: ModelConfig, b: ModelConfig) => byName(b, a) }[order];
  return [...configs].sort(compare);
}

// The filter's two lists: each value a config has, by its key, with the label the cards show.
export type ConfigFacet = "provider" | "model";

export const CONFIG_FACETS: { id: ConfigFacet; label: string }[] = [
  { id: "provider", label: "Provider" },
  { id: "model", label: "Model" },
];

// A config's value of a facet: its key, and its label as the card shows it (a model added by hand by its string).
export function facetOf(config: ModelConfig, facet: ConfigFacet, providerName: (provider: ModelConfig["provider"]) => string): { key: string; label: string } {
  if (facet === "provider") return { key: config.provider, label: providerName(config.provider) };
  return config.modelName ? { key: `name:${config.modelName}`, label: config.modelName } : { key: `string:${config.model}`, label: config.model };
}

// Each facet's values among the configs, once each, in the order of their labels.
export function facetValues(configs: ModelConfig[], facet: ConfigFacet, providerName: (provider: ModelConfig["provider"]) => string): { key: string; label: string }[] {
  const values = new Map<string, string>();
  for (const config of configs) {
    const { key, label } = facetOf(config, facet, providerName);
    values.set(key, label);
  }
  return [...values].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base", numeric: true }));
}

// The values taken out of the list, per facet: a config is shown unless one of its values is.
export type ConfigFilter = Record<ConfigFacet, string[]>;

export const NO_FILTER: ConfigFilter = { provider: [], model: [] };

export function shownConfigs(configs: ModelConfig[], filter: ConfigFilter, providerName: (provider: ModelConfig["provider"]) => string): ModelConfig[] {
  return configs.filter((config) => CONFIG_FACETS.every(({ id }) => !filter[id].includes(facetOf(config, id, providerName).key)));
}

export function filtering(filter: ConfigFilter): boolean {
  return filter.provider.length > 0 || filter.model.length > 0;
}
