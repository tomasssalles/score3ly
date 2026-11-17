// Amounts in US dollars as the app shows them (prices per million tokens are pricing.ts's).

// An amount in US dollars with two decimals (docs/llm.md, "Costs"): "$0.12". A paid amount below one cent is "<$0.01",
// so "$0.00" only ever means free.
export function dollars(amount: number): string {
  if (amount > 0 && amount < 0.005) return "<$0.01";
  return `$${amount.toFixed(2)}`;
}

// An amount typed in a field, as the field shows it: plain, with two decimals where they are enough ("1.50", "15.00"),
// else as many as it has ("0.004").
export function amount(usd: number): string {
  return Number.isInteger(Math.round(usd * 1e6) / 1e4) ? usd.toFixed(2) : String(usd);
}
