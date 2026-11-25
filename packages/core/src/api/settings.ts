// The settings the Worker keeps (`GET /api/settings`; docs/database.md: the user's, in D1). Settings that depend on the
// device stay in the browser.

import type { RunMode } from "./project.ts";

export type Settings = {
  // The model config of LLM stages unless one is chosen for the stage (§7.2). Never null once the database is set up
  // (the Worker refuses to remove it); null only as a guard against a database edited by hand.
  defaultModelConfigId: string | null;
  spendingCapUsd: number; // at most this much within any 24 hours, for configs that aren't free (§10): $1 until changed
  newProjectRunMode: RunMode; // the run mode a new project starts with (§5.1)
  vatPercent: number; // the VAT added to every cost, a percentage (docs/llm.md, "VAT"): 0 until changed
};

// The rules of the two amounts a person types (the Worker refuses others, the settings page says so first): the VAT, a
// percentage from 0 to 100 with at most two decimals (docs/llm.md, "VAT"); the spending cap, an amount in US dollars
// above 0, never removed (docs/llm.md, "Costs").
export function isVatPercent(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 && Math.round(value * 100) / 100 === value;
}

export function isCapUsd(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
