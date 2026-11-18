// Active time, for the statistics (docs/statistics.md, "Active time"): counted in quarters of an hour, which fit every
// time zone. A manual stage is active in the quarters in which it was saved , and in a quarter without
// a save between two such quarters: 15 minutes without a save is still work (reading, thinking), longer is a break.
// Only manual stages are filled so: elsewhere, events are dense while work happens.

// The same quarters as the costs' buckets (costs.ts, BUCKET_SECONDS) and the web's statistics: @score3ly/core's.
import { groupBy, QUARTER_MS } from "@score3ly/core";

// The quarters (their starts in ms) with a single empty quarter between two of them filled in, sorted.
export function filledQuarters(quarters: number[]): number[] {
  const sorted = [...new Set(quarters)].sort((a, b) => a - b);
  const filled: number[] = [];
  sorted.forEach((q, i) => {
    if (i > 0 && q - sorted[i - 1] === 2 * QUARTER_MS) filled.push(q - QUARTER_MS);
    filled.push(q);
  });
  return filled;
}

// Each manual stage's active quarters, gaps filled, from the rows of `manual_saves`.
export function manualQuarters(rows: { stage_id: string; quarter: number }[]): Map<string, number[]> {
  const byStage = groupBy(rows, (r) => r.stage_id, (r) => r.quarter);
  return new Map([...byStage].map(([stage, quarters]) => [stage, filledQuarters(quarters)]));
}
