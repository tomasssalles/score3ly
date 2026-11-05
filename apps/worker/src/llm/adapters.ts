// Which pairs of provider and model family the app supports: those with an adapter (docs/llm.md, "Providers and
// families"). The pairs offered anywhere (a model the user adds, the list's check) come from here and nothing else.
// Each pair names the adapter `createProvider` makes for it (index.ts), by its old provider id until the adapters take
// the pair themselves.

import type { Family, Provider } from "./models.ts";
import type { ProviderId } from "./types.ts";

export const ADAPTERS: Record<Provider, Partial<Record<Family, ProviderId>>> = {
  anthropic: { claude: "anthropic" },
  bedrock: { claude: "anthropic-bedrock" },
  "ai-studio": { gemini: "google" },
  vertex: { claude: "anthropic-vertex", gemini: "google-vertex" },
  fake: { fake: "fake" },
  "fake-dev": { fake: "fake-dev" },
};

// The adapter for a pair, or null where the app doesn't support it.
export function adapterFor(provider: Provider, family: Family): ProviderId | null {
  return ADAPTERS[provider][family] ?? null;
}

// The families the app supports on a provider (the family picker for a model the user adds).
export function supportedFamilies(provider: Provider): Family[] {
  return Object.keys(ADAPTERS[provider]) as Family[];
}
