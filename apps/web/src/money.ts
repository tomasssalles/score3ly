// Amounts in US dollars as the app shows them (prices per million tokens are pricing.ts's; an amount typed in a
// field is @score3ly/core's `amount`, which the Worker's refusal at the cap uses too).

// An amount in US dollars with two decimals (docs/llm.md, "Costs"): "$0.12". A paid amount below one cent is "<$0.01",
// so "$0.00" only ever means free.
export function dollars(amount: number): string {
  if (amount > 0 && amount < 0.005) return "<$0.01";
  return `$${amount.toFixed(2)}`;
}
