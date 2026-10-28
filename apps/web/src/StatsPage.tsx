// The Statistics page (docs/llm.md, "The costs view"). For now its costs: the spending cap's last 24 hours and the
// average cost per page at the top; then a range and what it cost in all, unfiltered; then, apart, the chart (bars per
// day, week or month, or the running total), split into groups and filtered by them, and a table of the totals. It
// opens on the plainest view: the last 30 days, per day, nothing split or filtered.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchCosts, type CostData } from "./api";
import {
  averagePerPage,
  axisLabel,
  bucketTitle,
  costView,
  createdBefore,
  defaultGranularity,
  DIMENSIONS,
  GRANULARITIES,
  granularitiesFor,
  grouper,
  GROUPINGS,
  groupsIn,
  hiddenCount,
  OTHER,
  perPage,
  RANGES,
  rangeOf,
  type Dimension,
  type Filters,
  type Granularity,
  type RangeId,
  type CostProject,
  type Split,
  unfinished,
} from "./costs";
import { DropdownMenu } from "./DropdownMenu";
import { BarsIcon, CheckIcon, ChevronDownIcon, FilterIcon, InfoIcon, MoreIcon, RunningTotalIcon, SplitIcon } from "./icons";
import { dollars } from "./money";
import { shortDate } from "./time";
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

// A small picker: the current choice (its short form, if it has one) and a chevron, opening the list (like the run
// mode).
function Picker<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string; short?: string }[];
  onChange: (id: T) => void;
}) {
  const current = options.find((o) => o.id === value);
  return (
    <DropdownMenu
      className="mode-picker"
      buttonClassName="mode-button"
      icon={
        <>
          {current?.short ?? current?.label}
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
      <CostPerPage projects={data.projects} now={now} />

      <section className="stats-section">
        <StatHead
          title="Detailed overview"
          about={<p>Estimates in US dollars, from the providers' list prices. Free-tier calls aren't counted.</p>}
          right={
            <>
              <Picker label="Time range" value={rangeId} options={RANGES} onChange={pickRange} />
              <span className="stat-value">
                <span className="stat-amount">{dollars(view.total)}</span>
                <span className="stat-note">unfiltered total</span>
              </span>
            </>
          }
        />
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
            {hidden > 0 && <span className="toggle-dot" />}
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
          formatTick={(v) => (Number.isInteger(v) ? `$${v}` : `$${v.toFixed(2)}`)}
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
        {view.rows.length === 0 && <p className="costs-empty">{view.total > 0 ? "The filters hide everything spent in this time range." : "Nothing was spent in this time range."}</p>}
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
      <StatHead
        title="Last 24 hours"
        about={<p>The spending cap, set in the settings: paid LLM calls are refused once the costs of the last 24 hours reach it.</p>}
        right={
          <span className="stat-value">
            <span className="cap-top">
              <span className={`cap-bar ${state}`} role="meter" aria-valuemin={0} aria-valuemax={cap} aria-valuenow={spent} aria-label="Spent in the last 24 hours">
                <span style={{ width: `${share * 100}%` }} />
              </span>
              <span className="stat-amount">{dollars(spent)}</span>
            </span>
            <span className="stat-note">max. {dollars(cap)}</span>
          </span>
        }
      />
      {/* Urgent: said where it is seen, not behind the "i". */}
      {state === "reached" && (
        <p className="cap-reached">The spending cap has been reached: paid LLM calls are refused until the last 24 hours cost less. It can be changed in the settings.</p>
      )}
    </section>
  );
}

// The head of a block of the page: its title and an "i" that shows or hides what the block means, on the left; its
// value (and the controls that change it) on the right, on a line of their own on a phone.
function StatHead({ title, about, right }: { title: string; about: ReactNode; right: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="stat-line">
        <h3>{title}</h3>
        <button type="button" className="icon-button stat-info" aria-expanded={open} aria-label={`About: ${title}`} title={`About: ${title}`} onClick={() => setOpen(!open)}>
          <InfoIcon />
        </button>
        <span className="stat-right">{right}</span>
      </div>
      {open && <div className="settings-hint stat-about">{about}</div>}
    </>
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

// For each dimension, a grouping (none at first: each step, project or config) and its groups as toggles: a group
// switched off is hidden from the chart and the table. Another grouping starts with nothing hidden. The groups listed
// are those with costs in the range, the most expensive first.
function FilterPanel({ data, range, filters, onChange }: { data: CostData; range: { start: number; end: number }; filters: Filters; onChange: (filters: Filters) => void }) {
  return (
    <div className="costs-panel">
      {DIMENSIONS.map(({ id: dimension, label }) => {
        const filter = filters[dimension] ?? { grouping: GROUPINGS[dimension][0].id, hidden: [] };
        const off = new Set(filter.hidden);
        const groups = groupsIn(data, range, grouper(data, dimension, filter.grouping));
        const toggle = (key: string) =>
          onChange({ ...filters, [dimension]: { ...filter, hidden: off.has(key) ? filter.hidden.filter((k) => k !== key) : [...filter.hidden, key] } });
        return (
          <div key={dimension} className="costs-filter">
            <div className="costs-panel-row">
              <span className="costs-panel-label">{label}</span>
              <span className="muted">grouped by</span>
              <Picker
                label={`${label}: grouped by`}
                value={filter.grouping}
                options={GROUPINGS[dimension]}
                onChange={(grouping) => onChange({ ...filters, [dimension]: { grouping, hidden: [] } })}
              />
            </div>
            <div className="costs-chips">
              {groups.map((g) => (
                <button key={g.key} type="button" className="chip" aria-pressed={!off.has(g.key)} onClick={() => toggle(g.key)}>
                  {g.label}
                </button>
              ))}
              {groups.length === 0 && <span className="muted">Nothing in this time range.</span>}
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

// The average cost per page (docs/llm.md, "The average cost per page"): one line, the number on the right, and a filter
// button that opens the list of projects to take it over, all of them at first. The list's "⋮" takes out the
// unfinished ones or the older ones; a box above the list selects all or none. The selection is forgotten when the
// page is left.
function CostPerPage({ projects, now }: { projects: CostProject[]; now: number }) {
  const [out, setOut] = useState<Set<string>>(new Set()); // the projects taken out
  const [open, setOpen] = useState(false);
  const chosen = projects.filter((p) => !out.has(p.id));
  const { average, projects: counted } = averagePerPage(chosen);
  const takeOut = (ids: string[]) => setOut(new Set([...out, ...ids]));
  const all = out.size === 0;
  const none = projects.length > 0 && chosen.length === 0;
  const summary =
    projects.length === 0
      ? "no projects yet"
      : none
        ? "no projects selected"
        : counted === 0
          ? "no selected project has pages"
          : `taken over ${counted === 1 ? "1 project" : `${counted} projects`}`;

  return (
    <section className="stats-section per-page">
      <StatHead
        title="Average per page"
        about={
          <>
            <p>
              You can use this value to <em>very roughly</em> estimate the expected cost of a new project based on the number of pages you want to
              transcribe. To get a better estimate, use the project filter on the right to select only projects similar to the one you have in mind
              (e.g. similar scan quality, music genre, old vs. modern edition, instrumentation, musical density and complexity).
            </p>
            <p>
              This calculation is complicated by the fact that multiple projects can use the same original PDF, that the app uses a hierarchical
              caching mechanism to avoid unnecessary costs to you, and that only you can tell whether a project is truly finished (there's always the
              possibility of adjusting the pipeline further to try and improve the transcription accuracy). So this is a best-effort estimate, with no
              guarantees.
            </p>
          </>
        }
        right={
          <>
            <span className="stat-value">
              <span className="stat-amount">{average === null ? "–" : dollars(average)}</span>
              <span className="stat-note">{summary}</span>
            </span>
            <button
              type="button"
              className="editor-mode"
              aria-pressed={open}
              aria-label="Select the projects"
              title="Select the projects"
              onClick={() => setOpen(!open)}
            >
              <FilterIcon />
              {!all && <span className="toggle-dot" />}
            </button>
          </>
        }
      />
      {open && (
        <div className="costs-panel per-page-panel">
          {projects.length === 0 ? (
            <span className="muted">No projects yet.</span>
          ) : (
            <>
              <div className="per-page-tools">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={all ? true : none ? false : "mixed"}
                  className="per-page-row per-page-all"
                  onClick={() => setOut(all ? new Set(projects.map((p) => p.id)) : new Set())}
                >
                  <span className="per-page-check">{all ? <CheckIcon /> : none ? null : <span className="per-page-mixed" />}</span>
                  <span className="per-page-name">All projects</span>
                </button>
                <DropdownMenu
                  icon={<MoreIcon />}
                  label="Take projects out"
                  groups={[
                    [{ label: "Remove projects with unfinished pipelines", onSelect: () => takeOut(unfinished(projects)) }],
                    [
                      { label: "Remove projects created more than 30 days ago", onSelect: () => takeOut(createdBefore(projects, "30d", now)) },
                      { label: "Remove projects created more than 3 months ago", onSelect: () => takeOut(createdBefore(projects, "3m", now)) },
                      { label: "Remove projects created more than 12 months ago", onSelect: () => takeOut(createdBefore(projects, "12m", now)) },
                    ],
                  ]}
                />
              </div>
              <ul className="per-page-list">
                {[...projects].reverse().map((p) => {
                  const on = !out.has(p.id);
                  const own = perPage(p);
                  const facts = [shortDate(p.createdAt, now), `${p.pages.length} ${p.pages.length === 1 ? "page" : "pages"}`, p.finished ? null : "unfinished pipeline", p.deletedAt ? "deleted" : null];
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        className="per-page-row"
                        onClick={() => {
                          const next = new Set(out);
                          if (on) next.add(p.id);
                          else next.delete(p.id);
                          setOut(next);
                        }}
                      >
                        <span className="per-page-check">{on && <CheckIcon />}</span>
                        <span className="per-page-name">
                          {p.name}
                          <span className="per-page-facts">{facts.filter(Boolean).join(" · ")}</span>
                        </span>
                        <span className="per-page-cost">{dollars(p.costUsd)}</span>
                        <span className="per-page-cost muted">{own === null ? "–" : `${dollars(own)}/page`}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
