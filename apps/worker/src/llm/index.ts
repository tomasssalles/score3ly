// Vision LLMs behind one interface (types.ts). A model config (docs/llm.md, "Model configs") names the provider and the secrets
// and settings it needs; the Worker reads the secrets and creates the provider here.

import { anthropicProvider, bedrockClaudeProvider, vertexClaudeProvider } from "./anthropic.ts";
import { FakeProvider } from "./fake.ts";
import { GoogleProvider, VertexGeminiProvider } from "./google.ts";
import type { Fetch, LlmProvider } from "./types.ts";
import { adapterFor } from "./adapters.ts";
import type { Family, Provider, Routing } from "./models.ts";

export * from "./types.ts";

export type ProviderConfig =
  | { provider: "anthropic"; apiKey: string }
  | { provider: "anthropic-vertex"; serviceAccount: string; region: string; projectId?: string }
  | { provider: "anthropic-bedrock"; region: string; apiKey: string }
  | { provider: "anthropic-bedrock"; region: string; accessKeyId: string; secretAccessKey: string }
  | { provider: "google"; apiKey: string }
  | { provider: "google-vertex"; serviceAccount: string; region: string; projectId?: string }
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
    case "google-vertex":
      return new VertexGeminiProvider({ ...config, fetch: options.fetch });
    case "fake":
    case "fake-dev":
      return new FakeProvider(config.provider);
  }
}

// Where and how a config's requests go (docs/llm.md, "Configs"): the provider and the model's family pick the adapter
// (adapters.ts), the place and the project say where, and the secrets' values (read from the Worker's environment)
// how to authenticate. Null where the app doesn't support the pair.
export type AdapterSettings = {
  provider: Provider;
  family: Family;
  region: string;
  project: string | null;
  secrets: Record<string, string>; // field → the secret's value
};

export function createAdapter(settings: AdapterSettings, options: { fetch?: Fetch } = {}): LlmProvider | null {
  const adapter = adapterFor(settings.provider, settings.family);
  if (!adapter) return null;
  const { region, project, secrets } = settings;
  const where = { region, ...(project ? { projectId: project } : {}) };
  const config =
    adapter === "anthropic" || adapter === "google" ? { provider: adapter, apiKey: secrets.apiKey! }
    : adapter === "anthropic-bedrock" ? { provider: adapter, region, ...secrets }
    : adapter === "anthropic-vertex" || adapter === "google-vertex" ? { provider: adapter, serviceAccount: secrets.serviceAccount!, ...where }
    : { provider: adapter };
  return createProvider(config as ProviderConfig, options);
}

// The model string Bedrock is sent for a routing: on `bedrock-runtime`, global and geographic routing go through AWS's
// inference profiles, named by the model ID with a prefix, "global." or the geography's ("eu.", "us.", "jp.", "au.");
// in-region routing sends the model ID alone (Anthropic's page "Claude on Amazon Bedrock (Opus 4.6 and earlier)").
export function bedrockModel(model: string, routing: Routing | null, geography: string | undefined): string {
  if (routing === "global") return `global.${model}`;
  if (routing === "geographic" && geography) return `${geography.toLowerCase()}.${model}`;
  return model;
}
