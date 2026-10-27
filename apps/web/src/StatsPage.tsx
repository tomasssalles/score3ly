// The Statistics page (docs/llm.md, "The costs view"). For now its costs: the spending cap's last 24 hours at the
// top; then a range and what it cost in all, unfiltered; then, apart, the chart (bars per day, week or month, or the
// running total), split into groups and filtered by them, and a table of the totals. It opens on the plainest view:
// the last 30 days, per day, nothing split or filtered.

import { useEffect, useMemo, useState } from "react";
import { fetchCosts, type CostData } from "./api";
import {
  axisLabel,
  bucketTitle,
  costView,
  defaultGranularity,
  DIMENSIONS,
  filterId,
  GRANULARITIES,
  granularitiesFor,
  grouper,
  GROUPINGS,
  groupsIn,
  hiddenCount,
  OTHER,
  RANGES,
  rangeOf,
  type Dimension,
  type Filters,
  type Granularity,
  type RangeId,
  type Split,
} from "./costs";
import { DropdownMenu } from "./DropdownMenu";
import { BarsIcon, ChevronDownIcon, FilterIcon, RunningTotalIcon, SplitIcon } from "./icons";
import { dollars } from "./money";
import { TimeChart, type ChartSeries } from "./TimeChart";

export function StatsPage() {
  const [data, setData] = useState<CostData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCosts().then(setData, () => setError("The costs couldn't be loaded."));
  }, []);

  return (
    <div className="page-view stats">
      <h2>Statistics</h2>
      {error && <p className="settings-error">{error}</p>}
      {data && <Costs data={data} />}
    </div>
  );
}

// A small picker: the current choice and a chevron, opening the list (like the run mode).
function Picker<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (id: T) => void }) {
  return (
    <DropdownMenu
      className="mode-picker"
      buttonClassName="mode-button"
      icon={
        <>
          {options.find((o) => o.id === value)?.label}
          <ChevronDownIcon />
        </>
      }
      label={label}
      groups={[options.map((o) => ({ label: o.label, current: o.id === value, onSelect: () => onChange(o.id) }))]}
    />
  );
}

function Costs({ data }: { data: CostData }) {
  const [now] = useState(() => Date.now());
  const [rangeId, setRangeId] = useState<RangeId>("30d");
  const firstCost = data.points.length ? data.points[0][2] : null;
  const range = useMemo(() => rangeOf(rangeId, now, firstCost), [rangeId, now, firstCost]);
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [mode, setMode] = useState<"bars" | "line">("bars");
  const [split, setSplit] = useState<Split>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [panel, setPanel] = useState<"split" | "filters" | null>(null);

  function pickRange(id: RangeId) {
    setRangeId(id);
    const r = rangeOf(id, now, firstCost);
    setGranularity(defaultGranularity(id, r.start, r.end));
  }

  const view = useMemo(() => costView(data, range, granularity, split, filters), [data, range, granularity, split, filters]);
  const colors = view.series.map((s, i) => (s.key === OTHER ? "var(--series-other)" : split ? `var(--series-${i + 1})` : "var(--chart)"));
  const series: ChartSeries[] = view.series.map((s, i) => ({ ...s, color: colors[i] }));
  const hidden = hiddenCount(filters);

  return (
    <>
      <SpendingCap spent={data.spentLastDayUsd} cap={data.capUsd} />

      <section className="stats-section">
        <h3>Costs</h3>
        <div className="costs-range">
          <Picker label="Time range" value={rangeId} options={RANGES} onChange={pickRange} />
          <div className="costs-total">
            <span className="costs-total-amount">{dollars(view.total)}</span>
            <span className="costs-total-label">in all, nothing filtered</span>
          </div>
        </div>
        <p className="settings-hint">Estimates in US dollars, from the providers' list prices. Free-tier calls aren't counted.</p>
      </section>

      <section className="stats-section costs-chart">
        <div className="costs-toolbar">
          <div className="editor-tools editor-modes" role="radiogroup" aria-label="Chart">
            {(
              [
                ["bars", "Amounts", <BarsIcon key="b" />],
                ["line", "Running total", <RunningTotalIcon key="l" />],
              ] as const
            ).map(([m, title, icon]) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} className="editor-mode" aria-label={title} title={title} onClick={() => setMode(m)}>
                {icon}
              </button>
            ))}
          </div>
          <Picker
            label="Granularity"
            value={granularity}
            options={GRANULARITIES.filter((g) => granularitiesFor(range.start, range.end).includes(g.id))}
            onChange={setGranularity}
          />
          <span className="costs-toolbar-gap" />
          <button
            type="button"
            className="editor-mode"
            aria-pressed={panel === "split"}
            aria-label="Split into groups"
            title="Split into groups"
            onClick={() => setPanel(panel === "split" ? null : "split")}
          >
            <SplitIcon />
            {split && <span className="toggle-dot" />}
          </button>
          <button
            type="button"
            className="editor-mode"
            aria-pressed={panel === "filters"}
            aria-label="Filters"
            title="Filters"
            onClick={() => setPanel(panel === "filters" ? null : "filters")}
          >
            <FilterIcon />
            {hidden > 0 && <span className="toggle-count">{hidden}</span>}
          </button>
        </div>

        {panel === "split" && <SplitPanel split={split} onChange={setSplit} />}
        {panel === "filters" && <FilterPanel data={data} range={range} filters={filters} onChange={setFilters} />}
        {panel !== "filters" && hidden > 0 && (
          <p className="costs-filtered">
            {hidden === 1 ? "1 group" : `${hidden} groups`} hidden by filters ·{" "}
            <button type="button" className="link-button" onClick={() => setFilters({})}>
              Show all
            </button>
          </p>
        )}

        <TimeChart
          labels={view.buckets.map((b, i) => axisLabel(b, granularity, i === 0))}
          titles={view.buckets.map((b) => bucketTitle(b, granularity))}
          series={series}
          values={view.values}
          mode={mode}
          format={(v) => (v === 0 ? "nothing spent" : dollars(v))}
          formatTick={(v) => (v === 0 ? "$0" : v >= 1 ? `$${Math.round(v * 100) / 100}` : `$${v.toFixed(2)}`)}
          label={mode === "bars" ? "Costs per period" : "Running total of the costs"}
          emptyHint={mode === "bars" ? "Tap a bar to see its amount." : "Tap the chart to see the running total there."}
        />

        <table className="costs-table">
          <tbody>
            {view.rows.map((row) => {
              const k = view.series.findIndex((s) => s.key === row.key);
              const color = k >= 0 ? colors[k] : "var(--series-other)";
              return (
                <tr key={row.key}>
                  <td className="costs-swatch-cell">
                    <span className="chart-swatch" style={{ background: color }} />
                  </td>
                  <td className="costs-group">{split ? row.label : "Total, as filtered"}</td>
                  <td className="costs-amount">{dollars(row.usd)}</td>
                  <td className="costs-share">{split && view.filtered > 0 ? `${Math.round((row.usd / view.filtered) * 100)}%` : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {view.rows.length === 0 && <p className="costs-empty">{view.total > 0 ? "The filters hide everything spent in this range." : "Nothing was spent in this range."}</p>}
      </section>
    </>
  );
}

// The last 24 hours against the cap, as the Worker counts them (docs/llm.md, "Spending cap").
function SpendingCap({ spent, cap }: { spent: number; cap: number }) {
  const share = Math.min(1, cap > 0 ? spent / cap : 0);
  const state = spent >= cap ? "reached" : share >= 0.8 ? "near" : "";
  return (
    <section className="stats-section">
      <div className="cap-row">
        <span className="cap-label">Last 24 hours</span>
        <span className="cap-amount">{dollars(spent)}</span>
        <span className={`cap-bar ${state}`} role="meter" aria-valuemin={0} aria-valuemax={cap} aria-valuenow={spent} aria-label="Spent in the last 24 hours">
          <span style={{ width: `${share * 100}%` }} />
        </span>
        <span className="cap-max">(max. {dollars(cap)})</span>
      </div>
      <p className="settings-hint">
        {state === "reached"
          ? "The spending cap is reached: paid LLM calls are refused until the last 24 hours cost less. It can be changed in the settings."
          : "The spending cap, set in the settings: paid LLM calls are refused once the last 24 hours reach it."}
      </p>
    </section>
  );
}

function SplitPanel({ split, onChange }: { split: Split; onChange: (split: Split) => void }) {
  const dimension = split?.dimension ?? null;
  return (
    <div className="costs-panel">
      <div className="costs-panel-row">
        <span className="costs-panel-label">Split by</span>
        <Picker
          label="Split by"
          value={dimension ?? "none"}
          options={[{ id: "none", label: "Nothing" }, ...DIMENSIONS]}
          onChange={(id) => onChange(id === "none" ? null : { dimension: id as Dimension, grouping: GROUPINGS[id as Dimension][0].id, byName: false })}
        />
        {split && <span className="muted">grouped by</span>}
        {split && (
          <Picker label="Grouped by" value={split.grouping} options={GROUPINGS[split.dimension]} onChange={(grouping) => onChange({ ...split, grouping })} />
        )}
      </div>
      {split?.dimension === "config" && split.grouping === "config" && (
        <div className="costs-chips">
          <button type="button" className="chip toggle" aria-pressed={split.byName} onClick={() => onChange({ ...split, byName: !split.byName })}>
            Same name together
          </button>
          <span className="settings-hint">An edited config's versions, and configs that share a name, as one.</span>
        </div>
      )}
    </div>
  );
}

// For each dimension, a grouping and its groups as toggles: a group switched off is hidden from the chart and the
// table. The groups listed are those with costs in the range, the most expensive first.
function FilterPanel({ data, range, filters, onChange }: { data: CostData; range: { start: number; end: number }; filters: Filters; onChange: (filters: Filters) => void }) {
  const [groupings, setGroupings] = useState<Record<Dimension, string>>(() => ({ stage: "step", project: "project", config: "config" }));
  return (
    <div className="costs-panel">
      {DIMENSIONS.map(({ id: dimension, label }) => {
        const grouping = groupings[dimension];
        const fid = filterId(dimension, grouping);
        const off = new Set(filters[fid] ?? []);
        const groups = groupsIn(data, range, grouper(data, dimension, grouping));
        const toggle = (key: string) => {
          const next = off.has(key) ? [...off].filter((k) => k !== key) : [...off, key];
          onChange({ ...filters, [fid]: next });
        };
        return (
          <div key={dimension} className="costs-filter">
            <div className="costs-panel-row">
              <span className="costs-panel-label">{label}</span>
              <Picker label={`${label}: grouped by`} value={grouping} options={GROUPINGS[dimension]} onChange={(g) => setGroupings({ ...groupings, [dimension]: g })} />
            </div>
            <div className="costs-chips">
              {groups.map((g) => (
                <button key={g.key} type="button" className="chip" aria-pressed={!off.has(g.key)} onClick={() => toggle(g.key)}>
                  {g.label}
                </button>
              ))}
              {groups.length === 0 && <span className="muted">Nothing in this range.</span>}
            </div>
          </div>
        );
      })}
      {hiddenCount(filters) > 0 && (
        <button type="button" className="link-button" onClick={() => onChange({})}>
          Show all
        </button>
      )}
    </div>
  );
}
