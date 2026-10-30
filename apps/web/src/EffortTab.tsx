// The Effort tab of the Statistics page (docs/tasks.md, "Other statistics"): how much the user had to step in, over the
// finished projects the user selects: the manual work per page, per manual step with how many projects used it, and the
// extra reviews per project. The computations are in effort.ts.

import { useEffect, useMemo, useState } from "react";
import { fetchRunTimes, type RunTimeData } from "./api";
import { effortView, share } from "./effort";
import { FinishedProjectsFilter } from "./ProjectFilter";
import { duration } from "./runTimes";
import { StatHead } from "./statsParts";

export function EffortTab() {
  const [data, setData] = useState<RunTimeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRunTimes().then(setData, () => setError("The projects couldn't be loaded."));
  }, []);

  return (
    <>
      <p className="stats-intro">This page is about how often the automated pipeline wasn't good enough and you had to swoop in and save the day.</p>
      {error && <p className="settings-error">{error}</p>}
      {data && <Effort data={data} />}
    </>
  );
}

const value = (text: string, note?: string) => (
  <span className="stat-value">
    <span className="stat-amount">{text}</span>
    {note && <span className="stat-note">{note}</span>}
  </span>
);

function Effort({ data }: { data: RunTimeData }) {
  const [out, setOut] = useState<Set<string>>(new Set()); // the projects taken out
  const selected = useMemo(() => new Set(data.projects.filter((p) => !out.has(p.id)).map((p) => p.id)), [data, out]);
  const view = useMemo(() => effortView(data, selected), [data, selected]);
  const time = (ms: number | null) => (ms === null ? "–" : duration(ms));

  if (data.projects.length === 0) return <p className="costs-empty">No finished projects yet.</p>;

  return (
    <>
      <FinishedProjectsFilter projects={data.projects} out={out} onChange={setOut} />
      <section className="stats-section">
        <StatHead
          title="Average manual work per page"
          about={
            <p>
              The time you spent in manual stages, per page of the selected projects: every quarter of an hour in which you saved changes in a
              manual stage, and a quarter between two of those. Only the manual stages in the final version of each pipeline count, together
              with the earlier versions they were edited from; manual stages that were later discarded don't. Below, the same for each manual
              step, and how many of the projects used it.
            </p>
          }
          right={value(time(view.perPageMs))}
        />
        {view.rows.map((r) => (
          <StatHead key={r.step} row title={r.label} right={value(time(r.perPageMs), view.projects ? `used in ${share(r.usedIn, view.projects)} of projects` : undefined)} />
        ))}
      </section>
      <section className="stats-section">
        <StatHead
          title="Extra reviews per project"
          about={
            <p>
              How many reviews (by LLMs) you added beyond the standard one, on average per project, counting only those kept in the final
              version of each pipeline.
            </p>
          }
          right={value(view.extraReviews === null ? "–" : String(Math.round(view.extraReviews * 10) / 10))}
        />
      </section>
    </>
  );
}
