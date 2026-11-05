// What calls cost (docs/llm.md, "Costs"): the providers report tokens, not money, so the app computes the cost from the
// prices in the list of models (models.ts, modelList.ts). US dollars per million tokens. Estimates, not the invoice.

import type { LlmUsage } from "./types.ts";

export type Price = { input: number; output: number; cacheRead: number; cacheWrite: number };

export function costOf(usage: LlmUsage, price: Price): number {
  const dollars =
    (usage.inputTokens * price.input +
      usage.outputTokens * price.output +
      usage.cacheReadTokens * price.cacheRead +
      usage.cacheWriteTokens * price.cacheWrite) /
    1_000_000;
  return Math.round(dollars * 1_000_000) / 1_000_000;
}
