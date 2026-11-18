// What a call's row means, for the statistics (docs/statistics.md; docs/llm.md, "Calling the providers").

import { QUARTER_MS } from "@score3ly/core";
import { LLM_TIMEOUT_MINUTES } from "./llm/timeouts.ts";

// A call still running after this long will never answer (the tab was closed while it waited, or the Worker was cut
// off): it is dead, of unknown cost, and "interrupted" in Usage. One that started later may still answer. The Worker's
// longest call timeout (llm/timeouts.ts), so that refining the timeouts moves it too, plus a margin for the call's
// bookkeeping around it (decided 2026-11-17).
export const DEAD_CALL_MARGIN_MS = 5 * 60_000;
export const ZOMBIE_MS = Math.max(...Object.values(LLM_TIMEOUT_MINUTES)) * 60_000 + DEAD_CALL_MARGIN_MS;

// The start before which a call still running is dead, as stored (ISO 8601).
export function zombieBefore(now = Date.now()): string {
  return new Date(now - ZOMBIE_MS).toISOString();
}

// A call that has ended, or never will: not running, or running since before the cut-off (`zombieBefore`, as of
// `now`). The cut-off is written into the SQL, so that a query using it twice binds nothing for it.
export function endedOrDead(now = Date.now()): string {
  return `(c.status <> 'running' OR c.started_at < '${zombieBefore(now)}')`;
}

// A call of unknown cost, read from the call's own row (`c`, in a query that leaves out free-tier configs): tokens
// recorded but no cost (an unpriced config's call, docs/llm.md, "Models the user adds", also after a new list gave the
// config a price; or a call priced by the provider whose answer didn't say what it cost); or no tokens, and neither an
// HTTP error status from the provider (its refusal, which isn't billed) nor an `auth` error without a status (the
// credentials failed before anything was sent). A 524 is Cloudflare's, not the provider's: it cut off a call the
// provider may have finished and billed. A call still running counts once it is dead (`endedOrDead`).
export function unknownCost(now = Date.now()): string {
  return `((c.input_tokens IS NOT NULL AND c.cost_usd IS NULL) OR (c.input_tokens IS NULL AND (c.http_status IS NULL OR c.http_status < 400 OR c.http_status = 524) AND (c.error_kind IS NOT 'auth' OR c.http_status IS NOT NULL)
  AND ${endedOrDead(now)}))`;
}

// How a call ended, as the statistics tell calls apart (`Outcome`, core), for a call row named `c`: "ok", how an answer
// was unusable, why the call failed (its `error_kind`, "unexpected_model" for another model answering), an error
// without a kind ("unexpected_stop"), or a call still running ("interrupted": counted only once it is dead). Usage
// counts every call by it; Costs the paid ones, whose outcomes are a few of these (`CostOutcome`).
export const OUTCOME = `CASE
  WHEN c.status = 'running' THEN 'interrupted'
  WHEN c.status IN ('ok', 'cut_off', 'refused', 'unparseable') THEN c.status
  WHEN c.error_kind IS NULL THEN 'unexpected_stop'
  ELSE c.error_kind
END`;

// The start of the quarter of an hour a call started in, in seconds (the statistics' buckets, `QUARTER_MS`, core).
export const BUCKET_SECONDS = QUARTER_MS / 1000;
export const CALL_QUARTER = `(CAST(strftime('%s', c.started_at) AS INTEGER) / ${BUCKET_SECONDS}) * ${BUCKET_SECONDS}`;

export const COST_WITH_VAT = "(c.cost_usd * (1 + c.vat_percent / 100.0))";
