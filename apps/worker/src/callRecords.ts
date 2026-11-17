// What a call's row means, for the statistics (docs/statistics.md; docs/llm.md, "Calling the providers").

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

// A call of unknown cost, read from the call's own row (`c`, in a query that leaves out free-tier configs): tokens
// recorded but no cost (an unpriced config's call, docs/llm.md, "Models the user adds", also after a new list gave the
// config a price; or a call priced by the provider whose answer didn't say what it cost); or no tokens, and neither an
// HTTP error status from the provider (its refusal, which isn't billed) nor an `auth` error without a status (the
// credentials failed before anything was sent). A 524 is Cloudflare's, not the provider's: it cut off a call the
// provider may have finished and billed. A call still running counts once it is dead (`?`: `zombieBefore()`).
export const UNKNOWN_COST = `((c.input_tokens IS NOT NULL AND c.cost_usd IS NULL) OR (c.input_tokens IS NULL AND (c.http_status IS NULL OR c.http_status < 400 OR c.http_status = 524) AND (c.error_kind IS NOT 'auth' OR c.http_status IS NOT NULL)
  AND (c.status <> 'running' OR c.started_at < ?)))`;
