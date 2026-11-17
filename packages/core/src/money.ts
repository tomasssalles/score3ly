// Amounts in US dollars (docs/llm.md, "Costs"), on both sides.

// An amount as costs are kept: to a millionth of a dollar, so that sums of many calls don't drift.
export function roundUsd(usd: number): number {
  return Math.round(usd * 1e6) / 1e6;
}

// An amount typed in a field, as the field shows it (the spending cap's, the settings): plain, with two decimals
// where they are enough ("1.50", "15.00"), else as many as it has ("0.004"). The Worker's refusal at the cap says it
// the same way.
export function amount(usd: number): string {
  return Number.isInteger(Math.round(usd * 1e6) / 1e4) ? usd.toFixed(2) : String(usd);
}
