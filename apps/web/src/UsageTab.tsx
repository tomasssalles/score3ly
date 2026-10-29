// The Usage tab of the Statistics page (docs/tasks.md, "Other statistics"), in blocks:
// - its active hours: an hour in which anything happened (usage.ts), for all projects or one picked without a label,
//   in a time range of its own, as bars or the running total per day, week or month, and a one-row table;
// - its projects: current and deleted, the pages processed, and those created in a time range of their own.

import { useEffect, useMemo, useState } from "react";
import { fetchActivity, fetchProjectStats, type ActivityData, type ProjectStats } from "./api";
import { axisLabel, bucketsOf, deletedNote, bucketTitle, defaultGranularity, GRANULARITIES, granularitiesFor, RANGES, rangeOf, type Granularity, type RangeId } from "./costs";
import { ChartModes, Picker, StatHead, type ChartMode } from "./statsParts";
import { TimeChart } from "./TimeChart";
import { activeHours, createdIn, createdNote, hoursView } from "./usage";

const ALL = "";

export function UsageTab() {
  const [data, setData] = useState<ActivityData | null>(null);
  const [projects, setProjects] = useState<ProjectStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchActivity().then(setData, () => setError("The activity couldn't be loaded."));
    fetchProjectStats().then(setProjects, () => setError("The projects couldn't be loaded."));
  }, []);

  return (
    <>
      {error && <p className="settings-error">{error}</p>}
      {data && <ActiveHours data={data} />}
      {projects && <Projects data={projects} />}
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
  const [mode, setMode] = useState<ChartMode>("bars");

  function pickRange(id: RangeId) {
    setRangeId(id);
    const r = rangeOf(id, now, firstActivity);
    setGranularity(defaultGranularity(id, r.start, r.end));
  }

  const buckets = useMemo(() => bucketsOf(range.start, range.end, granularity), [range, granularity]);
  const allHours = useMemo(() => hoursView(activeHours(data, null), buckets, range), [data, buckets, range]);
  const view = useMemo(() => (projectId === ALL ? allHours : hoursView(activeHours(data, projectId), buckets, range)), [data, projectId, buckets, range, allHours]);
  // Newest first, deleted ones marked (their names can be used again).
  const projects = [...data.projects].reverse().map((p) => ({ id: p.id, label: p.name, note: deletedNote(p.deletedAt) }));
  const picked = projects.find((p) => p.id === projectId);

  return (
    <section className="stats-section">
      <StatHead
        title="Activity"
        about={
          <p>
            An hour counts as active if anything happened in it: a request was sent to an LLM, a stage started or ended,
            a result or a manual change was saved, or a project was created. Just looking at a project isn't counted as
            activity and we don't track project navigation.
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
          <ChartModes mode={mode} onChange={setMode} />
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

// The projects: how many there are and how many were deleted, over all time; the pages processed (rasterized), each
// page of a PDF once; and the projects created in a time range of its own, with what became of them.
function Projects({ data }: { data: ProjectStats }) {
  const [now] = useState(() => Date.now());
  const [rangeId, setRangeId] = useState<RangeId>("30d");
  const first = data.projects.length ? Date.parse(data.projects[0].createdAt) : null;
  const created = createdIn(data, rangeOf(rangeId, now, first));
  const deleted = data.projects.filter((p) => p.deleted).length;
  const count = (n: number) => (
    <span className="stat-value">
      <span className="stat-amount">{n}</span>
    </span>
  );

  return (
    <section className="stats-section ruled">
      <h3>Projects</h3>
      <StatHead row title="Current" right={count(data.projects.length - deleted)} />
      <StatHead row title="Deleted" right={count(deleted)} />
      <StatHead
        row
        title="Pages processed"
        about={
          <p>
            This is the total number of pages that have gone through at least the Rasterize stage, even if their
            pipelines didn't finish. Several projects can sometimes use the same original PDF, in which case the pages
            are counted only once. Pages of deleted projects are included.
          </p>
        }
        right={count(data.pagesProcessed)}
      />
      <StatHead
        row
        title="Created"
        right={
          <>
            <Picker label="Time range" value={rangeId} options={RANGES} onChange={setRangeId} />
            <span className="stat-value">
              <span className="stat-amount">{created.total}</span>
              {created.total > 0 && <span className="stat-note">{createdNote(created)}</span>}
            </span>
          </>
        }
      />
    </section>
  );
}
