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
