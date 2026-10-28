// Vision LLMs behind one interface (types.ts). A model config (docs/llm.md, "Model configs") names the provider and the secrets
// and settings it needs; the Worker reads the secrets and creates the provider here.

import { anthropicProvider, bedrockClaudeProvider, vertexClaudeProvider } from "./anthropic.ts";
import { FakeProvider } from "./fake.ts";
import { GoogleProvider } from "./google.ts";
import type { Fetch, LlmProvider } from "./types.ts";

export * from "./types.ts";

export type ProviderConfig =
  | { provider: "anthropic"; apiKey: string }
  | { provider: "anthropic-vertex"; serviceAccount: string; region: string; projectId?: string }
  | { provider: "anthropic-bedrock"; region: string; apiKey: string }
  | { provider: "anthropic-bedrock"; region: string; accessKeyId: string; secretAccessKey: string }
  | { provider: "google"; apiKey: string }
  | { provider: "fake" | "fake-dev" };

export function createProvider(config: ProviderConfig, options: { fetch?: Fetch } = {}): LlmProvider {
  switch (config.provider) {
    case "anthropic":
      return anthropicProvider({ apiKey: config.apiKey, fetch: options.fetch });
    case "anthropic-vertex":
      return vertexClaudeProvider({ ...config, fetch: options.fetch });
    case "anthropic-bedrock":
      return bedrockClaudeProvider({ ...config, fetch: options.fetch });
    case "google":
      return new GoogleProvider({ apiKey: config.apiKey, fetch: options.fetch });
    case "fake":
    case "fake-dev":
      return new FakeProvider(config.provider);
  }
}
