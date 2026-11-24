// What calls cost and the spending cap (docs/llm.md, "Costs", "VAT", "Spending cap"): a cost with its VAT, the VAT
// setting's values, a cost the provider reports with its fee, and what the cap counts.

import { notImportingStage } from "./importing.ts";
import { amount, DAY_MS, roundUsd } from "@score3ly/core";
import { ACCOUNT_FEES, type Account } from "./llm/models.ts";
import { COST_WITH_VAT } from "./callRecords.ts";
import { freeOnOpenRouter } from "./llm/prices.ts";
import { readSettings } from "./settings.ts";

// VAT in the costs (docs/llm.md, "VAT"): each call keeps its cost before VAT (`cost_usd`) and the rate in force when that
// cost was recorded (`vat_percent`); every cost the app shows or counts, the spending cap's included, is the two
// together (`COST_WITH_VAT`, callRecords.ts). The prices of the model configs stay without VAT.

// A cost with VAT at a rate (a percentage); null stays null (an unknown cost).
export function withVat(usd: number | null, percent: number): number | null {
  return usd === null ? null : usd * (1 + percent / 100);
}

// A rate as the setting takes it: a percentage from 0 to 100, with at most two decimals.
export function isVatPercent(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 && Math.round(value * 100) / 100 === value;
}

// A call's cost where the provider reports it: what the answer says, raised by the fee on credits (OpenRouter's is
// charged when credits are bought, on top of them, so a dollar of credits costs 1 + fee); unknown (null) where the
// answer doesn't say.
export function providerCost(reportedUsd: number | undefined, fee: number): number | null {
  return reportedUsd === undefined ? null : roundUsd(reportedUsd * (1 + fee));
}

// The share a call's reported cost is raised by for the provider's fee on credits (OpenRouter's, by the account's
// plan), or 0.
export function feeOf(row: { account: Account | null }): number {
  return row.account ? ACCOUNT_FEES[row.account] : 0;
}

// What the spending cap counts (docs/llm.md, "Spending cap"): the costs of the calls started in the last 24 hours, with
// their VAT, free-tier configs left out (unpriced calls have no cost to count), deleted projects included.
export async function spentInLastDay(db: D1Database, now = Date.now()): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(${COST_WITH_VAT}), 0) AS spent FROM llm_calls c JOIN model_configs m ON m.id = c.model_config_id WHERE m.pricing_kind <> 'free' AND c.started_at >= ? AND ${notImportingStage("c.stage_id")}`,
    )
    .bind(new Date(now - DAY_MS).toISOString())
    .first<{ spent: number }>();
  return row?.spent ?? 0;
}

// Why a priced call can't be made, or null: the spending cap is reached (docs/llm.md, "Spending cap"). A model the
// provider itself lists as free (OpenRouter's ":free" models: all its prices 0) costs nothing, so the cap doesn't stop
// it (decided 2026-11-08); its calls are still recorded at what they report. `forTest`: a config's Test, which is never
// served from the record, so the note on calls already paid for is left out.
export async function capRefusal(db: D1Database, call: { pricedByProvider: boolean; model: string; region: string }, forTest: boolean): Promise<string | null> {
  const { spendingCapUsd } = await readSettings(db);
  if ((await spentInLastDay(db)) < spendingCapUsd) return null;
  if (call.pricedByProvider && (await freeOnOpenRouter(call.model, call.region))) return null;
  return `The spending cap has been reached: $${amount(spendingCapUsd)} within 24 hours.${forTest ? "" : " Calls already paid for are still served."}`;
}
