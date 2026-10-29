// The Effort tab of the Statistics page (docs/tasks.md, "Other statistics"): how often the automated pipeline wasn't
// good enough and the user stepped in, over the finished projects the user selects. The computations are in effort.ts.

import { useEffect, useMemo, useState } from "react";
import { fetchRunTimes, type RunTimeData } from "./api";
import { effortView, share } from "./effort";
import { FinishedProjectsFilter } from "./ProjectFilter";
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

  if (data.projects.length === 0) return <p className="costs-empty">No finished projects yet.</p>;

  return (
    <>
      <FinishedProjectsFilter projects={data.projects} out={out} onChange={setOut} />
      <section className="stats-section">
        <StatHead
          title="Projects that needed a hand"
          about={
            <p>
              The share of the selected projects in which you stepped in at least once: a manual stage you finished, a review added beyond the
              standard one, or a stage run again after a change (another model config, a dropped stage, a stop). Below, how often each of them
              happened, as a share of the selected projects.
            </p>
          }
          right={value(share(view.helped, view.projects), view.projects ? `${view.helped} of ${view.projects === 1 ? "1 project" : `${view.projects} projects`}` : undefined)}
        />
        {view.rows.map((r) => (
          <StatHead key={r.key} row title={r.label} right={value(r.projects === null ? "–" : share(r.projects, view.projects))} />
        ))}
      </section>
    </>
  );
}
