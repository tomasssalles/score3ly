// The rows of LLM calls that the mock statistics write (scripts/seedStats.ts, docs/statistics.md, "Mock data"), built
// the way the Worker builds its own (llmCalls.ts, `runCall` and a cache hit's row): the price from the list of models
// for the config (`priceOfConfig`), the cost by `costOf`, the VAT rate as recorded, the price as `price_json` keeps it,
// the call's place, and a row of its own for an answer served from the record. A test reads them through Costs and
// Usage beside rows the Worker wrote (seedRows.test.ts), so the mock data can't drift from what the app records.

import type { Effort, Family, Pricing, Provider, Routing } from "@score3ly/core";
import { configModel, type ConfigPrice, priceOfConfig } from "../src/llm/models.ts";
import { MODEL_LIST } from "../src/llm/modelList.ts";
import { costOf, type Price } from "../src/llm/prices.ts";

// A model config's columns as the database stores them, those the price depends on.
export type SeedConfigRow = {
  id: string;
  provider: Provider;
  model_id: string | null;
  model_string: string | null;
  family: Family | null;
  effort: Effort | null;
  region: string;
  routing: Routing | null;
  pricing_kind: Pricing["kind"];
  pricing_reference: string | null;
};

export function seedPrice(row: SeedConfigRow): ConfigPrice {
  const pricing: Pricing = row.pricing_kind === "list" ? { kind: "list", reference: row.pricing_reference } : { kind: row.pricing_kind };
  return priceOfConfig(MODEL_LIST, { provider: row.provider, model: configModel(row), place: { region: row.region, routing: row.routing }, pricing });
}

export type SeedUsage = { input: number; output: number; cacheRead: number; cacheWrite: number };

// How a call ended, as the mock data has them: answered (and usable, cut off or not JSON), or failed without an
// answer (the provider overloaded, or no answer in time).
export type SeedOutcome = "ok" | "cut_off" | "unparseable" | "overloaded" | "timeout";

export type SeedCall = {
  id: string;
  stageId: string;
  config: SeedConfigRow;
  item: string;
  round: number;
  outcome: SeedOutcome;
  usage: SeedUsage | null; // null for a call without an answer
  responseModel: string;
  vatPercent: number;
  requestKey: string;
  requestSha: string;
  responseSha: string;
  startedAt: string;
  finishedAt: string;
  deletedAt: string | null;
};

// A sent call's row, with the columns `runCall` writes for such a call. Its cost: null where nothing was answered.
export function seedCallRow(c: SeedCall): Record<string, unknown> {
  const priced = seedPrice(c.config);
  if (priced.kind !== "priced" && priced.kind !== "free") throw new Error(`the mock data has no ${priced.kind} configs (${c.config.id})`);
  const price: Price | null = priced.kind === "priced" ? priced.price : null;
  const answered = c.usage !== null;
  const usage = c.usage && { inputTokens: c.usage.input, outputTokens: c.usage.output, cacheReadTokens: c.usage.cacheRead, cacheWriteTokens: c.usage.cacheWrite };
  return {
    id: c.id,
    stage_id: c.stageId,
    model_config_id: c.config.id,
    request_key: c.requestKey,
    request_sha256: c.requestSha,
    item: c.item,
    round: c.round,
    status: c.outcome === "overloaded" || c.outcome === "timeout" ? "error" : c.outcome,
    error:
      c.outcome === "overloaded" ? "The provider is overloaded (529). Try again later."
      : c.outcome === "timeout" ? "The request timed out after 600 s."
      : c.outcome === "cut_off" ? "The answer was cut off."
      : c.outcome === "unparseable" ? "The answer isn't valid JSON."
      : null,
    error_kind: c.outcome === "overloaded" || c.outcome === "timeout" ? c.outcome : null,
    http_status: c.outcome === "overloaded" ? 529 : null,
    response_model: answered ? c.responseModel : null,
    response_sha256: answered ? c.responseSha : null,
    input_tokens: usage?.inputTokens ?? null,
    output_tokens: usage?.outputTokens ?? null,
    cached_tokens: usage?.cacheReadTokens ?? null,
    cache_write_tokens: usage?.cacheWriteTokens ?? null,
    cost_usd: usage === null ? null : price ? costOf(usage, price) : 0,
    vat_percent: answered ? c.vatPercent : 0,
    price_json: answered && price ? JSON.stringify({ ...price, asOf: MODEL_LIST.asOf, ...(priced.kind === "priced" && priced.borrowedFrom ? { borrowedFrom: priced.borrowedFrom } : {}) }) : null,
    started_at: c.startedAt,
    finished_at: c.finishedAt,
    deleted_at: c.deletedAt,
  };
}

// The row of an answer served from the record to a stage (llmCalls.ts, a cache hit): cost 0, the original's request,
// answer and model, at the serving stage's place.
export function seedServedRow(original: Record<string, unknown>, s: { id: string; stageId: string; configId: string; item: string; round: number; at: string; deletedAt: string | null }): Record<string, unknown> {
  return {
    id: s.id,
    stage_id: s.stageId,
    model_config_id: s.configId,
    request_key: original.request_key,
    request_sha256: original.request_sha256,
    response_sha256: original.response_sha256,
    response_model: original.response_model,
    item: s.item,
    round: s.round,
    status: "ok",
    cost_usd: 0,
    served_from: original.id,
    started_at: s.at,
    finished_at: s.at,
    deleted_at: s.deletedAt,
  };
}
