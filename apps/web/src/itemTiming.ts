// How long an item of a running stage took, and what it found in the caches (docs/database.md, "outputs"): for the
// statistics of run times, which estimate a fresh run from the items that really ran. The stage runner times each
// item (stageRunner.ts); while it runs, the model calls (llm.ts) and the device's image cache (pageImages.ts) report
// here. Items run one at a time, so one tracker is enough. An image looked up meanwhile by a view, not by the item, is
// counted with it too: views mostly find their images in the cache, so this rarely matters.

export type Timing = { durationMs: number; calls: number; callsCached: number; images: number; imagesCached: number };

type Counts = Omit<Timing, "durationMs">;

let current: Counts | null = null;

// A model answer the item asked for: served from the record, or asked now.
export function noteAnswer(cached: boolean): void {
  if (!current) return;
  current.calls++;
  if (cached) current.callsCached++;
}

// An image the item looked up on the device: found in the cache, or made now.
export function noteImage(found: boolean): void {
  if (!current) return;
  current.images++;
  if (found) current.imagesCached++;
}

// Runs an item's work, timing it and counting what it found in the caches.
export async function timed<T>(make: () => Promise<T>): Promise<{ value: T; timing: Timing }> {
  const counts: Counts = { calls: 0, callsCached: 0, images: 0, imagesCached: 0 };
  current = counts;
  const start = performance.now();
  try {
    const value = await make();
    return { value, timing: { durationMs: Math.round(performance.now() - start), ...counts } };
  } finally {
    current = null;
  }
}
