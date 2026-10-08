// Vision LLMs behind one interface (types.ts). A model config (DESIGN.md §7.6) names the provider and the secret
// that holds its key; the Worker reads the key and creates the provider here.

import { AnthropicProvider } from "./anthropic.ts";
import { GoogleProvider } from "./google.ts";
import type { Fetch, LlmProvider, ProviderId } from "./types.ts";

export * from "./types.ts";

export function createProvider(id: ProviderId, options: { apiKey: string; fetch?: Fetch }): LlmProvider {
  switch (id) {
    case "anthropic":
      return new AnthropicProvider(options);
    case "google":
      return new GoogleProvider(options);
  }
}
