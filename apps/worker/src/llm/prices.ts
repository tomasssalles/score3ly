// What calls cost (docs/llm.md, "Costs"): the providers report tokens, not money, so the app computes the cost from the
// prices in the list of models (models.ts, modelList.ts). US dollars per million tokens. Estimates, not the invoice.
// And, for OpenRouter, whose answers say what they cost, the range of its prices for a model, looked up live.

import { DAY_MS, type Price, type PriceRange, roundUsd } from "@score3ly/core";
import { plainFetch } from "./http.ts";
import { openRouterBase } from "./openrouter.ts";
import type { Fetch, LlmUsage } from "./types.ts";

export type { Price, PriceRange };

export function costOf(usage: LlmUsage, price: Price): number {
  const dollars =
    (usage.inputTokens * price.input +
      usage.outputTokens * price.output +
      usage.cacheReadTokens * price.cacheRead +
      usage.cacheWriteTokens * price.cacheWrite) /
    1_000_000;
  return roundUsd(dollars);
}

// A guide to what a model costs on OpenRouter (docs/llm.md, "OpenRouter"): the lowest and highest of each of the four
// prices (input, output, cache read, cache write), US dollars per million tokens, among the providers that run it there
// (its endpoints API, public), without the tiers only a request asks for (`…/fast`, `…/priority`, …). A provider
// without a cache price has none (0: Gemini's implicit caching writes for free). Null where OpenRouter doesn't have
// the model or can't be reached. Only a guide: each call costs what its answer says. Without the fee on credits.
const TIERS = new Set(["fast", "priority", "turbo", "flex"]);

type EndpointPricing = { prompt?: string; completion?: string; input_cache_read?: string; input_cache_write?: string };

export function priceRange(endpoints: { tag?: string; pricing?: EndpointPricing }[]): PriceRange | null {
  const perMillion = (v: string | undefined) => (v === undefined ? NaN : roundUsd(Number(v) * 1e6));
  const prices = endpoints
    .filter((e) => !TIERS.has(e.tag?.split("/").at(-1) ?? ""))
    .map((e) => ({
      input: perMillion(e.pricing?.prompt),
      output: perMillion(e.pricing?.completion),
      cacheRead: perMillion(e.pricing?.input_cache_read ?? "0"),
      cacheWrite: perMillion(e.pricing?.input_cache_write ?? "0"),
    }))
    .filter((p) => Object.values(p).every(Number.isFinite));
  if (prices.length === 0) return null;
  const span = (key: keyof PriceRange): [number, number] => [Math.min(...prices.map((p) => p[key])), Math.max(...prices.map((p) => p[key]))];
  return { input: span("input"), output: span("output"), cacheRead: span("cacheRead"), cacheWrite: span("cacheWrite") };
}

// How long a price lookup may take: it runs before a priced call once the cap is reached, and in the config form.
const LOOKUP_TIMEOUT_MS = 10_000;

// Whether OpenRouter lists a model as free where it is sent (all its prices 0, as its ":free" models are): such calls
// cost nothing, so the spending cap lets them through. Not free where the prices can't be read.
export async function freeOnOpenRouter(model: string, region: string, fetchFn?: Fetch, now = Date.now()): Promise<boolean> {
  const range = await fetchPriceRange(model, region, fetchFn, now);
  return range !== null && Object.values(range).every(([, high]) => high === 0);
}

// Kept a day per host and model, in the Worker's memory.
const ranges = new Map<string, { at: number; range: PriceRange | null }>();

export async function fetchPriceRange(model: string, region: string, fetchFn: Fetch = plainFetch(), now = Date.now(), timeoutMs = LOOKUP_TIMEOUT_MS): Promise<PriceRange | null> {
  const key = `${region} ${model}`;
  const kept = ranges.get(key);
  if (kept && now - kept.at < DAY_MS) return kept.range;
  let range: PriceRange | null = null;
  try {
    const res = await fetchFn(`${openRouterBase(region)}/models/${model}/endpoints`, { signal: AbortSignal.timeout(timeoutMs) });
    if (res.ok) range = priceRange(((await res.json()) as { data?: { endpoints?: [] } }).data?.endpoints ?? []);
  } catch {
    return null; // unreachable, or no answer in time: not kept, so the next look tries again
  }
  ranges.set(key, { at: now, range });
  return range;
}
