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
