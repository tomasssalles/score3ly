// What calls cost (docs/llm.md, "Costs"): the providers report tokens, not money, so the app computes the cost from a price
// table in the code. US dollars per million tokens. Estimates, not the invoice.
//
// Claude's prices are Anthropic's API list prices (2026-10). On Bedrock and Vertex AI the same models are priced by
// AWS and Google, possibly differently (e.g. a premium for regional endpoints); until checked, the list prices stand
// in for them. A model without a price can't be called unless its config is marked free tier: the spending cap
// couldn't count it.

import type { LlmUsage, ProviderId } from "./types.ts";

// When the prices below were collected. Each call records the prices its cost was computed with, so updating the
// table doesn't change past costs; the About page shows this date, so stale prices are noticed (§10).
export const PRICES_AS_OF = "2026-10-06";

export type Price = { input: number; output: number; cacheRead: number; cacheWrite: number };

// Cache writes are 1.25 × the input price (5-minute cache), as Anthropic bills them.
function claude(input: number, output: number, cacheRead: number): Price {
  return { input, output, cacheRead, cacheWrite: input * 1.25 };
}

const CLAUDE: Record<string, Price> = {
  "claude-fable-5-1": claude(10, 50, 0.25),
  "claude-opus-5-5": claude(4, 20, 0.2),
  "claude-sonnet-5-5": claude(2, 10, 0.2),
  // Up to 100K tokens of prompt; beyond, $0.50 / $2.50 (not modelled: our prompts are far smaller).
  "claude-haiku-5-5": claude(0.1, 0.5, 0.01),
};

// The fake provider (fake.ts): made-up prices, so that costs and the spending cap can be tried without paying.
const FAKE: Price = { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 };

// The model's own name, without Bedrock's prefixes ("eu.anthropic.claude-opus-5-5" → "claude-opus-5-5") or a
// Vertex version after "@".
function baseModel(model: string): string {
  return model.replace(/^(?:[a-z]{2,6}\.)?anthropic\./, "").replace(/@.*$/, "");
}

export function priceOf(provider: ProviderId, model: string): Price | null {
  if (provider === "fake") return FAKE;
  if (provider === "google") return null;
  return CLAUDE[baseModel(model)] ?? null;
}

export function costOf(usage: LlmUsage, price: Price): number {
  const dollars =
    (usage.inputTokens * price.input +
      usage.outputTokens * price.output +
      usage.cacheReadTokens * price.cacheRead +
      usage.cacheWriteTokens * price.cacheWrite) /
    1_000_000;
  return Math.round(dollars * 1_000_000) / 1_000_000;
}
