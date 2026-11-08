// How a model config's prices are shown (docs/llm.md, "Configs").

import type { ModelConfig, ModelPrice, PriceRange } from "./api";

// A price per million tokens: whole dollars without cents ("$4"), else at least the cents ("$0.20", "$0.001").
export function dollars(amount: number): string {
  if (Number.isInteger(amount)) return `$${amount}`;
  const decimals = String(amount).split(".")[1]?.length ?? 0;
  return `$${amount.toFixed(Math.max(2, decimals))}`;
}

// What a config's calls cost (docs/llm.md, "Configs"): its four prices, from the app's list (borrowed from another
// model where it is priced as one), or why it has none. Priced by the provider (OpenRouter): the range among those who
// run the model, read from the provider (`range`), with the fee on credits included, or while it isn't there, how it
// is priced.
export function pricingText(config: ModelConfig, range: PriceRange | null = null): string {
  const { price } = config;
  if (price.kind === "free") return "Free tier";
  if (price.kind === "unpriced") return "Unpriced: its calls' costs are unknown";
  if (price.kind === "missing") return "No price in the app's list";
  if (price.kind === "provider") {
    const name = PROVIDER_NAMES[config.provider] ?? config.provider;
    if (!range) return `Priced per call by ${name}, plus its ${percent(price.fee)} fee on credit purchases`;
    return `${rangeText(range, price.fee)} (including ${name}'s ${percent(price.fee)} fee on credit purchases; the price depends on who runs the model)`;
  }
  const text = pricesText(price.price);
  return price.borrowedFrom ? `${text} (priced as ${price.borrowedFrom})` : text;
}

// A price with a fee on top, rounded to the cent from 10 cents up, else to three significant digits.
function withFee(amount: number, fee: number): number {
  const raised = amount * (1 + fee);
  return raised >= 0.1 ? Math.round(raised * 100) / 100 : Number(raised.toPrecision(3));
}

// The four prices as ranges, the fee included: "$4.22–4.64 input, $21.10–23.21 output, $0.21–0.23 cache read,
// $5.28–5.80 cache write, per million tokens" (one price where both ends are the same).
export function rangeText(range: PriceRange, fee = 0): string {
  const span = ([low, high]: [number, number]) => {
    const [a, b] = [withFee(low, fee), withFee(high, fee)];
    return a === b ? dollars(a) : `${dollars(a)}–${dollars(b).slice(1)}`;
  };
  return `${span(range.input)} input, ${span(range.output)} output, ${span(range.cacheRead)} cache read, ${span(range.cacheWrite)} cache write, per million tokens`;
}

// A share as a percentage: 0.055 → "5.5%".
export function percent(share: number): string {
  return `${Math.round(share * 1000) / 10}%`;
}

const PROVIDER_NAMES: Partial<Record<ModelConfig["provider"], string>> = { openrouter: "OpenRouter" };

export const ACCOUNT_NAMES: Record<NonNullable<ModelConfig["account"]>, string> = { standard: "Standard", business: "Business" };

// The four prices of a model, per million tokens.
export function pricesText(p: ModelPrice): string {
  return `${dollars(p.input)} input, ${dollars(p.output)} output, ${dollars(p.cacheRead)} cache read, ${dollars(p.cacheWrite)} cache write, per million tokens`;
}
