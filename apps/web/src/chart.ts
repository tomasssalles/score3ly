// What the charts share that isn't drawing (TimeChart.tsx).

// The y axis's values: 0 and about four round steps (1, 2, 2.5 or 5 times a power of ten) up to at least `max`.
export function ticks(max: number): number[] {
  if (!(max > 0)) return [0];
  const rough = max / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * power).find((s) => s >= rough) ?? 10 * power;
  const out: number[] = [];
  for (let k = 0; k === 0 || out[k - 1] < max; k++) out.push(Number((k * step).toPrecision(12)));
  return out;
}

// Each row's running total, in one pass per row.
export function runningTotals(values: number[][]): number[][] {
  return values.map((row) => {
    let sum = 0;
    return row.map((v) => (sum += v));
  });
}

// Whether a press and its release are a tap (picking a bucket) rather than a drag that scrolls. A press is forgotten
// once it ends, or is cancelled (the browser took it over to scroll), so a release whose press began elsewhere picks
// nothing.
export function tapTracker(slop = 6) {
  let start: number | null = null;
  return {
    down(x: number) {
      start = x;
    },
    cancel() {
      start = null;
    },
    up(x: number): boolean {
      const tap = start !== null && Math.abs(x - start) <= slop;
      start = null;
      return tap;
    },
  };
}
