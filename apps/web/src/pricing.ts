// How a model config's prices are shown (docs/llm.md, "Configs").

import type { ModelConfig, ModelPrice } from "./api";

// A price per million tokens: whole dollars without cents ("$4"), else at least the cents ("$0.20", "$0.001").
export function dollars(amount: number): string {
  if (Number.isInteger(amount)) return `$${amount}`;
  const decimals = String(amount).split(".")[1]?.length ?? 0;
  return `$${amount.toFixed(Math.max(2, decimals))}`;
}

// What a config's calls cost (docs/llm.md, "Configs"): its four prices, from the app's list (borrowed from another
// model where it is priced as one), or why it has none.
export function pricingText(config: ModelConfig): string {
  const { price } = config;
  if (price.kind === "free") return "Free tier";
  if (price.kind === "unpriced") return "Unpriced: its calls' costs are unknown";
  if (price.kind === "missing") return "No price in the app's list";
  if (price.kind === "provider") return `Priced per call by ${PROVIDER_NAMES[config.provider] ?? config.provider}, plus its ${percent(price.fee)} fee on credit purchases`;
  const text = pricesText(price.price);
  return price.borrowedFrom ? `${text} (priced as ${price.borrowedFrom})` : text;
}

// A guide price range: "$4–4.40 input, $20–22 output per million tokens" (one price where both ends are the same).
export function rangeText(range: { input: [number, number]; output: [number, number] }): string {
  const span = ([low, high]: [number, number]) => (low === high ? dollars(low) : `${dollars(low)}–${dollars(high).slice(1)}`);
  return `${span(range.input)} input, ${span(range.output)} output per million tokens`;
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
