// The Usage tab of the Statistics page (docs/tasks.md, "Other statistics"). So far its active hours: an hour in which
// anything happened (usage.ts), per day, week or month of a time range of its own, as bars or the running total, for
// all projects or one picked without a label; a one-row table with the total.

import { useEffect, useMemo, useState } from "react";
import { fetchActivity, type ActivityData } from "./api";
import { axisLabel, bucketsOf, bucketTitle, defaultGranularity, GRANULARITIES, granularitiesFor, RANGES, rangeOf, type Granularity, type RangeId } from "./costs";
import { BarsIcon, RunningTotalIcon } from "./icons";
import { Picker, StatHead } from "./statsParts";
import { TimeChart } from "./TimeChart";
import { activeHours, hoursView } from "./usage";

const ALL = "";

export function UsageTab() {
  const [data, setData] = useState<ActivityData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchActivity().then(setData, () => setError("The activity couldn't be loaded."));
  }, []);

  return (
    <>
      {error && <p className="settings-error">{error}</p>}
      {data && <ActiveHours data={data} />}
    </>
  );
}

const hoursText = (n: number) => (n === 1 ? "1 hour" : `${n} hours`);

function ActiveHours({ data }: { data: ActivityData }) {
  const [now] = useState(() => Date.now());
  const [rangeId, setRangeId] = useState<RangeId>("30d");
  const [projectId, setProjectId] = useState(ALL);
  const firstActivity = data.quarters.length ? data.quarters[0][1] : null;
  const range = useMemo(() => rangeOf(rangeId, now, firstActivity), [rangeId, now, firstActivity]);
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [mode, setMode] = useState<"bars" | "line">("bars");

  function pickRange(id: RangeId) {
    setRangeId(id);
    const r = rangeOf(id, now, firstActivity);
    setGranularity(defaultGranularity(id, r.start, r.end));
  }

  const buckets = useMemo(() => bucketsOf(range.start, range.end, granularity), [range, granularity]);
  const allHours = useMemo(() => hoursView(activeHours(data, null), buckets, range), [data, buckets, range]);
  const view = useMemo(() => (projectId === ALL ? allHours : hoursView(activeHours(data, projectId), buckets, range)), [data, projectId, buckets, range, allHours]);
  // Newest first, deleted ones marked (their names can be used again).
  const projects = [...data.projects].reverse().map((p) => ({ id: p.id, label: p.name, note: p.deletedAt ? "(deleted)" : undefined }));
  const picked = projects.find((p) => p.id === projectId);

  return (
    <section className="stats-section">
      <StatHead
        title="Activity"
        about={
          <p>
            An hour counts as active if anything happened in it: a model was being asked, a stage started or ended, a
            result or a manual change was saved, or a project was created. Only looking at a project leaves no trace.
            Hours are counted once, however much happened in them.
          </p>
        }
        right={
          <>
            <Picker label="Time range" value={rangeId} options={RANGES} onChange={pickRange} />
            <span className="stat-value">
              <span className="stat-amount">
                {allHours.total}
                <span className="stat-unit"> {allHours.total === 1 ? "hour" : "hours"}</span>
              </span>
              <span className="stat-note">on {allHours.days === 1 ? "1 day" : `${allHours.days} days`}</span>
            </span>
          </>
        }
      />
      <div className="costs-chart">
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
          <Picker label="Project" value={projectId} options={[{ id: ALL, label: "All projects" }, ...projects]} onChange={setProjectId} className="project-select" />
        </div>
        <TimeChart
          labels={buckets.map((b, i) => axisLabel(b, granularity, i === 0))}
          titles={buckets.map((b) => bucketTitle(b, granularity))}
          series={[{ key: "hours", label: "Active hours", color: "var(--chart)" }]}
          values={[view.values]}
          mode={mode}
          format={(v) => (v === 0 ? "no activity" : hoursText(v))}
          formatTick={(v) => `${v} h`}
          label={mode === "bars" ? "Active hours per period" : "Running total of the active hours"}
          emptyHint={mode === "bars" ? "Tap a bar to see its hours." : "Tap the chart to see the running total there."}
        />
        <table className="costs-table">
          <tbody>
            <tr>
              <td className="costs-swatch-cell">
                <span className="chart-swatch" style={{ background: "var(--chart)" }} />
              </td>
              <td className="costs-group">
                {picked ? picked.label : "All projects"}
                {picked?.note && <span className="menu-note"> {picked.note}</span>}
              </td>
              <td className="costs-amount">{hoursText(view.total)}</td>
            </tr>
          </tbody>
        </table>
        {view.total === 0 && <p className="costs-empty">No activity in this time range.</p>}
      </div>
    </section>
  );
}
