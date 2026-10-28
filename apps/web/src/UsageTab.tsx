// The Usage tab of the Statistics page (docs/tasks.md, "Other statistics"), in blocks, each with a time range of its
// own, a chart of bars or the running total per day, week or month, and a small table:
// - its active hours: an hour in which anything happened (usage.ts), for all projects or one picked without a label;
// - its pages transcribed: each page of a PDF once, when the first project with it was finished, and the projects
//   created, finished and unfinished.

import { useEffect, useMemo, useState } from "react";
import { fetchActivity, fetchTranscribed, type ActivityData, type TranscribedData } from "./api";
import { axisLabel, bucketsOf, deletedNote, bucketTitle, defaultGranularity, GRANULARITIES, granularitiesFor, RANGES, rangeOf, type Granularity, type RangeId } from "./costs";
import { ChartModes, Picker, StatHead, type ChartMode } from "./statsParts";
import { TimeChart } from "./TimeChart";
import { activeHours, firstTranscribed, hoursView, pagesView } from "./usage";

const ALL = "";

export function UsageTab() {
  const [data, setData] = useState<ActivityData | null>(null);
  const [transcribed, setTranscribed] = useState<TranscribedData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchActivity().then(setData, () => setError("The activity couldn't be loaded."));
    fetchTranscribed().then(setTranscribed, () => setError("The pages transcribed couldn't be loaded."));
  }, []);

  return (
    <>
      {error && <p className="settings-error">{error}</p>}
      {data && <ActiveHours data={data} />}
      {transcribed && <PagesTranscribed data={transcribed} />}
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

const pagesText = (n: number) => (n === 1 ? "1 page" : `${n} pages`);

// What the app has produced: the pages of finished pipelines, each page of a PDF once (a PDF is a score), on the day
// the first project with it was finished; and the projects created in the range, how many were finished, and how
// many are still unfinished (deleted ones too: an abandoned try).
function PagesTranscribed({ data }: { data: TranscribedData }) {
  const [now] = useState(() => Date.now());
  const [rangeId, setRangeId] = useState<RangeId>("30d");
  const first = useMemo(() => {
    const times = [...firstTranscribed(data).map((p) => p.t), ...data.projects.map((p) => Date.parse(p.createdAt))];
    return times.length ? Math.min(...times) : null;
  }, [data]);
  const range = useMemo(() => rangeOf(rangeId, now, first), [rangeId, now, first]);
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [mode, setMode] = useState<ChartMode>("bars");

  function pickRange(id: RangeId) {
    setRangeId(id);
    const r = rangeOf(id, now, first);
    setGranularity(defaultGranularity(id, r.start, r.end));
  }

  const buckets = useMemo(() => bucketsOf(range.start, range.end, granularity), [range, granularity]);
  const view = useMemo(() => pagesView(data, buckets, range), [data, buckets, range]);
  const rows: [string, number][] = [
    ["Projects created", view.created],
    ["Projects finished", view.finished],
    ["Created and still unfinished", view.unfinished],
  ];

  return (
    <section className="stats-section ruled">
      <StatHead
        title="Pages transcribed"
        about={
          <p>
            A page counts once a project with it has run its whole pipeline. Projects on the same PDF are one score:
            each of its pages counts once, when the first project with it was finished.
          </p>
        }
        right={
          <>
            <Picker label="Time range" value={rangeId} options={RANGES} onChange={pickRange} />
            <span className="stat-value">
              <span className="stat-amount">
                {view.total}
                <span className="stat-unit"> {view.total === 1 ? "page" : "pages"}</span>
              </span>
              <span className="stat-note">in {view.scores === 1 ? "1 score" : `${view.scores} scores`}</span>
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
        </div>
        <TimeChart
          labels={buckets.map((b, i) => axisLabel(b, granularity, i === 0))}
          titles={buckets.map((b) => bucketTitle(b, granularity))}
          series={[{ key: "pages", label: "Pages transcribed", color: "var(--chart)" }]}
          values={[view.values]}
          mode={mode}
          format={(v) => (v === 0 ? "no pages" : pagesText(v))}
          formatTick={(v) => `${v}`}
          label={mode === "bars" ? "Pages transcribed per period" : "Running total of the pages transcribed"}
          emptyHint={mode === "bars" ? "Tap a bar to see its pages." : "Tap the chart to see the running total there."}
        />
        <table className="costs-table">
          <tbody>
            {rows.map(([label, n]) => (
              <tr key={label}>
                <td className="costs-group">{label}</td>
                <td className="costs-amount">{n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
