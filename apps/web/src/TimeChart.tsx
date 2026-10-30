// A chart over time, for the statistics (docs/statistics.md, "The costs view"): stacked bars per bucket, or a line per
// series for the running total. It knows nothing about money: the caller gives the buckets' labels, the series, their
// values and how to write a value. Wider than the view when there are many buckets: every bucket gets at least
// MIN_PITCH pixels, the plot scrolls sideways (starting at its newest end) and the y axis stays. Tapping or clicking a
// bucket shows its values above the plot; the arrow keys move between buckets, Escape lets go. Only the bars in view
// are drawn, so a long range at a fine granularity stays fast.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ticks } from "./chart.ts";

export type ChartSeries = { key: string; label: string; note?: string; color: string }; // color: a CSS value, e.g. "var(--accent)"

const MIN_PITCH = 4; // px per bucket, at least
const MAX_BAR = 40; // px, the widest a bar gets
const HEIGHT = 200; // the plot's height, px
const TOP = 10; // room above the highest value
const LABEL_WIDTH = 64; // px a label under the axis needs
const AXIS_WIDTH = 56;

export function TimeChart({
  labels,
  titles,
  series,
  values,
  mode,
  format,
  formatTick,
  label,
  emptyHint,
}: {
  labels: string[]; // under each bucket, shown where there is room
  titles: string[]; // each bucket in full, for the readout
  series: ChartSeries[];
  values: number[][]; // per series, per bucket
  mode: "bars" | "line"; // line: the running total of each series
  format: (value: number) => string;
  formatTick: (value: number) => string;
  label: string; // the chart's accessible name
  emptyHint: string; // the readout's text while no bucket is picked
}) {
  const n = labels.length;
  const scroller = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const down = useRef<number | null>(null); // where a tap started: a drag that scrolls picks nothing

  useEffect(() => setSelected(null), [n, mode]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  const pitch = n ? Math.max(MIN_PITCH, width / n) : 0;
  const plotWidth = Math.max(width, n * pitch);

  // The newest end first: the plot scrolls to its right edge whenever its buckets change.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
    setScrollLeft(el?.scrollLeft ?? 0);
  }, [n, pitch]);

  const shown = useMemo(
    () => (mode === "bars" ? values : values.map((row) => row.reduce<number[]>((acc, v, i) => [...acc, (i ? acc[i - 1] : 0) + v], []))),
    [values, mode],
  );
  const max = useMemo(() => {
    if (mode === "line") return Math.max(0, ...shown.map((row) => row.at(-1) ?? 0));
    let m = 0;
    for (let i = 0; i < n; i++) m = Math.max(m, shown.reduce((sum, row) => sum + row[i], 0));
    return m;
  }, [shown, mode, n]);
  const scale = ticks(max);
  const top = scale.at(-1) || 1;
  const y = (v: number) => HEIGHT - (v / top) * (HEIGHT - TOP);

  const bar = pitch <= 5 ? pitch - 1 : Math.min(MAX_BAR, Math.round(pitch * 0.72));
  const first = Math.max(0, Math.floor((scrollLeft - 100) / (pitch || 1)));
  const last = Math.min(n - 1, Math.ceil((scrollLeft + width + 100) / (pitch || 1)));
  const every = Math.max(1, Math.ceil(LABEL_WIDTH / (pitch || 1)));

  function pick(e: PointerEvent<SVGSVGElement>) {
    if (down.current === null || Math.abs(e.clientX - down.current) > 6) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.min(n - 1, Math.max(0, Math.floor((e.clientX - rect.left) / pitch)));
    setSelected(i === selected ? null : i);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const step = e.key === "ArrowLeft" ? -1 : 1;
      const i = Math.min(n - 1, Math.max(0, (selected ?? (step < 0 ? n : -1)) + step));
      setSelected(i);
      const el = scroller.current;
      if (el && (i * pitch < el.scrollLeft || (i + 1) * pitch > el.scrollLeft + el.clientWidth)) el.scrollLeft = i * pitch - el.clientWidth / 2;
      e.preventDefault();
    } else if (e.key === "Escape") setSelected(null);
  }

  const readout =
    selected === null ? null : (
      <>
        <span className="chart-readout-title">{titles[selected]}</span>
        <span className="chart-readout-total">{format(shown.reduce((sum, row) => sum + row[selected], 0))}</span>
        {series.length > 1 && (
          <span className="chart-readout-series">
            {series.map((s, k) =>
              shown[k][selected] > 0 ? (
                <span key={s.key} className="chart-readout-item">
                  <span className="chart-swatch" style={{ background: s.color }} />
                  {s.label}
                  {s.note && <span className="menu-note"> {s.note}</span>} {format(shown[k][selected])}
                </span>
              ) : null,
            )}
          </span>
        )}
      </>
    );

  return (
    <div className="time-chart">
      <div className="chart-readout" aria-live="polite">
        {readout ?? <span className="chart-readout-hint">{emptyHint}</span>}
      </div>
      <div className="chart-body">
        <svg className="chart-axis" width={AXIS_WIDTH} height={HEIGHT + 24} aria-hidden="true">
          {scale.map((v) => (
            <text key={v} x={AXIS_WIDTH - 8} y={y(v) + 4} textAnchor="end">
              {formatTick(v)}
            </text>
          ))}
        </svg>
        <div className="chart-scroller" ref={scroller} onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}>
          <svg
            className="chart-plot"
            width={plotWidth}
            height={HEIGHT + 24}
            role="img"
            aria-label={label}
            tabIndex={0}
            onPointerDown={(e) => (down.current = e.clientX)}
            onPointerUp={pick}
            onKeyDown={onKeyDown}
          >
            {scale.map((v) => (
              <line key={v} className={v === 0 ? "chart-baseline" : "chart-grid"} x1={0} x2={plotWidth} y1={y(v)} y2={y(v)} />
            ))}
            {selected !== null && <rect className="chart-selected" x={selected * pitch} y={0} width={pitch} height={HEIGHT} />}
            {mode === "bars"
              ? Array.from({ length: n ? last - first + 1 : 0 }, (_, j) => {
                  const i = first + j;
                  let base = 0;
                  return (
                    <g key={i}>
                      {series.map((s, k) => {
                        const v = shown[k][i];
                        if (!(v > 0)) return null;
                        const rect = <rect key={s.key} x={i * pitch + (pitch - bar) / 2} y={y(base + v)} width={bar} height={Math.max(0.5, y(base) - y(base + v))} fill={s.color} />;
                        base += v;
                        return rect;
                      })}
                    </g>
                  );
                })
              : series.map((s, k) => {
                  const points = shown[k].map((v, i) => `${(i + 1) * pitch},${y(v)}`);
                  const line = `M0,${y(0)} L${points.join(" L")}`;
                  return (
                    <g key={s.key}>
                      {series.length === 1 && <path className="chart-area" d={`${line} L${n * pitch},${y(0)} Z`} fill={s.color} />}
                      <path className="chart-line" d={line} stroke={s.color} />
                      {/* The running total read out: at the end of the picked bucket. */}
                      {selected !== null && <circle className="chart-point" cx={(selected + 1) * pitch} cy={y(shown[k][selected])} r={3.5} fill={s.color} />}
                    </g>
                  );
                })}
            {labels.map((text, i) =>
              i % every === 0 && i >= first - every && i <= last && i * pitch + LABEL_WIDTH - 12 <= plotWidth ? (
                <text key={i} className="chart-label" x={i * pitch + 2} y={HEIGHT + 17}>
                  {text}
                </text>
              ) : null,
            )}
            {labels.map((_, i) =>
              i % every === 0 && i >= first - every && i <= last ? <line key={`t${i}`} className="chart-tick" x1={i * pitch} x2={i * pitch} y1={HEIGHT} y2={HEIGHT + 5} /> : null,
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}
