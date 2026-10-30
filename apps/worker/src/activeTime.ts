// Active time, for the statistics (docs/statistics.md, "Active time"): counted in quarters of an hour, which fit every
// time zone. A manual stage is active in the quarters in which it was saved (migration 0022), and in a quarter without
// a save between two such quarters: 15 minutes without a save is still work (reading, thinking), longer is a break.
// Only manual stages are filled so: elsewhere, events are dense while work happens.

// The same quarters as the costs' buckets (costs.ts, BUCKET_SECONDS), defined here so that this module imports nothing.
export const QUARTER_MS = 15 * 60 * 1000;

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
  const byStage = new Map<string, number[]>();
  for (const r of rows) byStage.set(r.stage_id, [...(byStage.get(r.stage_id) ?? []), r.quarter]);
  return new Map([...byStage].map(([stage, quarters]) => [stage, filledQuarters(quarters)]));
}
