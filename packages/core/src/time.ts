// Quarters of an hour (docs/statistics.md, "Active time"): what the statistics count active time and buckets in, on
// both sides, since they fit every time zone.

export const QUARTER_MS = 15 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

// The start of the quarter a time (in ms) is in.
export function quarterOf(ms: number): number {
  return Math.floor(ms / QUARTER_MS) * QUARTER_MS;
}
