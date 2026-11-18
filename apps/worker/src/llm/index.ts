// Vision LLMs behind one interface (types.ts). A model config (docs/llm.md, "Model configs") names the provider and the
// secrets and settings it needs; the Worker reads the secrets and makes the adapter here.

import { bedrockClaudeProvider, bedrockNames, anthropicProvider } from "./anthropic.ts";
import { FakeProvider } from "./fake.ts";
import { GeminiProvider, geminiApi, vertexAi } from "./google.ts";
import { OpenRouterProvider, sameModel } from "./openrouter.ts";
import { type Fetch, type LlmProvider, withJson } from "./types.ts";
import { isSupported } from "./adapters.ts";
import type { Family, Provider } from "./models.ts";

export * from "./types.ts";
export { bedrockModel } from "./anthropic.ts";

// Where and how a config's requests go (docs/llm.md, "Configs"): the provider and the model's family pick the adapter
// (adapters.ts), the place and the project say where, and the secrets' values (read from the Worker's environment)
// how to authenticate (the fields of one of the pair's `secretSets`).
export type AdapterSettings = {
  provider: Provider;
  family: Family;
  region: string;
  project: string | null;
  secrets: Record<string, string>; // field → the secret's value
};

// The adapter for a config, or null where the app doesn't support the pair. Throws an `LlmError` (`auth`) where the
// secrets can't be used (a key file that doesn't parse, both kinds of Bedrock credentials).
export function createAdapter(settings: AdapterSettings, options: { fetch?: Fetch } = {}): LlmProvider | null {
  const { provider, family, region, project, secrets } = settings;
  if (!isSupported(provider, family)) return null;
  const fetch = options.fetch;
  switch (provider) {
    case "anthropic":
      return answering(anthropicProvider({ apiKey: secrets.apiKey!, fetch }), (asked, answered) => answered === asked);
    case "bedrock":
      return answering(bedrockClaudeProvider({ region, ...secrets, fetch }), (asked, answered) => bedrockNames(asked).includes(answered));
    case "ai-studio":
      return answering(new GeminiProvider(geminiApi(secrets.apiKey!), fetch), ANY_VERSION);
    case "vertex":
      return answering(new GeminiProvider(vertexAi({ serviceAccount: secrets.serviceAccount!, region, ...(project ? { projectId: project } : {}) }, fetch), fetch), ANY_VERSION);
    case "openrouter":
      return answering(new OpenRouterProvider({ apiKey: secrets.apiKey!, region, fetch }), sameModel);
    case "fake":
    case "fake-dev":
      // Its answers are made whole, a wrong model and broken JSON on purpose included.
      return new FakeProvider();
  }
}

// Gemini names the exact version that answered, which can differ from the name asked for (an alias, a dated version),
// so it isn't checked.
const ANY_VERSION = () => true;

// What every real provider's answer goes through, once: a sanity check that it came from the model asked (it was paid
// for all the same, so it comes back with its usage rather than as an error; its answer isn't parsed), then a structured
// answer parsed (`withJson`).
function answering(adapter: LlmProvider, sameModel: (asked: string, answered: string) => boolean): LlmProvider {
  return {
    async send(request, signal, onProgress) {
      const response = await adapter.send(request, signal, onProgress);
      if (!sameModel(request.model, response.model)) return { ...response, unexpectedModel: `Asked ${request.model}, but ${response.model} answered.` };
      return request.jsonSchema ? withJson(response) : response;
    },
  };
}
