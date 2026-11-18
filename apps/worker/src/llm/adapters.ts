// Which pairs of provider and model family the app supports: those with an adapter (docs/llm.md, "Providers and
// families"), and the secrets each takes (each set is one way to authenticate, by the fields the adapter reads; a
// config names a Worker secret for each). The pairs offered anywhere (a model the user adds, the list's check) come from
// here and nothing else; `createAdapter` (index.ts) makes each pair's adapter.

import type { Family, Provider } from "./models.ts";

const PAIRS: Record<Provider, Partial<Record<Family, string[][]>>> = {
  anthropic: { claude: [["apiKey"]] },
  bedrock: { claude: [["apiKey"], ["accessKeyId", "secretAccessKey"]] },
  "ai-studio": { gemini: [["apiKey"]] },
  vertex: { gemini: [["serviceAccount"]] },
  openrouter: { claude: [["apiKey"]], gemini: [["apiKey"]] },
  fake: { fake: [[]] },
  "fake-dev": { fake: [[]] },
};

// Whether the app supports the pair.
export function isSupported(provider: Provider, family: Family): boolean {
  return PAIRS[provider][family] !== undefined;
}

// The ways a supported pair authenticates, or null where the app doesn't support the pair.
export function secretSets(provider: Provider, family: Family): string[][] | null {
  return PAIRS[provider][family] ?? null;
}

// The families the app supports on a provider (the family picker for a model the user adds).
export function supportedFamilies(provider: Provider): Family[] {
  return Object.keys(PAIRS[provider]) as Family[];
}
