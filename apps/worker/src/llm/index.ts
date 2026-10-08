// Vision LLMs behind one interface (types.ts). A model config (DESIGN.md §7.6) names the provider and the secrets
// and settings it needs; the Worker reads the secrets and creates the provider here.

import { anthropicProvider, vertexClaudeProvider } from "./anthropic.ts";
import { GoogleProvider } from "./google.ts";
import type { Fetch, LlmProvider } from "./types.ts";

export * from "./types.ts";

export type ProviderConfig =
  | { provider: "anthropic"; apiKey: string }
  | { provider: "anthropic-vertex"; serviceAccount: string; region: string; projectId?: string }
  | { provider: "google"; apiKey: string };

export function createProvider(config: ProviderConfig, options: { fetch?: Fetch } = {}): LlmProvider {
  switch (config.provider) {
    case "anthropic":
      return anthropicProvider({ apiKey: config.apiKey, fetch: options.fetch });
    case "anthropic-vertex":
      return vertexClaudeProvider({ ...config, fetch: options.fetch });
    case "google":
      return new GoogleProvider({ apiKey: config.apiKey, fetch: options.fetch });
  }
}
