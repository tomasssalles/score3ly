// VAT in the costs (docs/llm.md, "VAT"): each call keeps its cost before VAT (`cost_usd`) and the rate in force when that
// cost was recorded (`vat_percent`); every cost the app shows or counts, the spending cap's included, is the two
// together. The prices of the model configs stay without VAT.

// A call's cost with its VAT, in SQL, for a call row named `c`. NULL where the cost is unknown.
export const COST_WITH_VAT = "(c.cost_usd * (1 + c.vat_percent / 100.0))";

// A cost with VAT at a rate (a percentage); null stays null (an unknown cost).
export function withVat(usd: number | null, percent: number): number | null {
  return usd === null ? null : usd * (1 + percent / 100);
}

// A rate as the setting takes it: a percentage from 0 to 100, with at most two decimals.
export function isVatPercent(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 && Math.round(value * 100) / 100 === value;
}
