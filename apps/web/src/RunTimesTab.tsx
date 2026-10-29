// The Run times tab of the Statistics page (docs/tasks.md, "Other statistics"), over the finished projects the user
// selects (all at first; no time range): how long a project took, each step's work time per page (split by model
// config if wanted), and an estimate per page for a new score. The computations are in runTimes.ts.

import { useEffect, useMemo, useState } from "react";
import { fetchActivity, fetchRunTimes, type ActivityData, type RunTimeData } from "./api";
import { createdBefore, deletedNote } from "./costs";
import { FilterIcon, InfoIcon } from "./icons";
import { duration, estimatePerPage, perProject, stepTimes } from "./runTimes";
import { Picker, ProjectChecks, StatHead } from "./statsParts";
import { shortDate } from "./time";

export function RunTimesTab() {
  const [data, setData] = useState<RunTimeData | null>(null);
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRunTimes().then(setData, () => setError("The run times couldn't be loaded."));
    fetchActivity().then(setActivity, () => setError("The activity couldn't be loaded."));
  }, []);

  return (
    <>
      {error && <p className="settings-error">{error}</p>}
      {data && activity && <RunTimes data={data} activity={activity} />}
    </>
  );
}

const value = (text: string, note?: string) => (
  <span className="stat-value">
    <span className="stat-amount">{text}</span>
    {note && <span className="stat-note">{note}</span>}
  </span>
);

function RunTimes({ data, activity }: { data: RunTimeData; activity: ActivityData }) {
  const [now] = useState(() => Date.now());
  const [out, setOut] = useState<Set<string>>(new Set()); // the projects taken out
  const [open, setOpen] = useState(false);
  const [about, setAbout] = useState(false);
  const [split, setSplit] = useState<"none" | "config">("none");
  const selected = useMemo(() => new Set(data.projects.filter((p) => !out.has(p.id)).map((p) => p.id)), [data, out]);
  const project = useMemo(() => perProject(data, selected, activity), [data, selected, activity]);
  const rows = useMemo(() => stepTimes(data, selected, split === "config"), [data, selected, split]);
  const estimate = estimatePerPage(rows, data.recipe);
  const total = data.projects.length;

  if (total === 0) return <p className="costs-empty">No finished projects yet.</p>;

  return (
    <>
      {/* The filter applies to the whole tab: no title of its own, so it doesn't read as a block. */}
      <section className="run-times-filter">
        <div className="run-times-filter-line">
          <button type="button" className="icon-button stat-info" aria-expanded={about} aria-label="About: the projects" title="About: the projects" onClick={() => setAbout(!about)}>
            <InfoIcon />
          </button>
          <button
            type="button"
            className="editor-mode"
            aria-pressed={open}
            aria-label="Select the projects"
            title="Select the projects"
            onClick={() => setOpen(!open)}
          >
            <FilterIcon />
            {out.size > 0 && <span className="toggle-dot" />}
          </button>
        </div>
        <p className="stat-note run-times-selected">{selected.size === 1 ? "1 project selected" : `${selected.size} projects selected`}</p>
        {about && (
          <div className="settings-hint stat-about">
            <p>Only projects whose pipeline is finished are listed.</p>
          </div>
        )}
        {open && (
          <div className="costs-panel per-page-panel">
            <ProjectChecks
              items={[...data.projects].reverse().map((p) => ({
                key: p.id,
                name: p.name,
                note: deletedNote(p.deletedAt),
                facts: `${shortDate(p.createdAt, now)} · ${p.pages.length} ${p.pages.length === 1 ? "page" : "pages"}`,
              }))}
              out={out}
              onChange={setOut}
              actions={[
                [
                  { label: "Remove projects created more than 30 days ago", ids: createdBefore(data.projects, "30d", now) },
                  { label: "Remove projects created more than 3 months ago", ids: createdBefore(data.projects, "3m", now) },
                  { label: "Remove projects created more than 12 months ago", ids: createdBefore(data.projects, "12m", now) },
                ],
              ]}
            />
          </div>
        )}
      </section>

      <section className="stats-section">
        <StatHead
          title="Average total time per project"
          about={
            <p>
              The average time from a project's creation to the last time its pipeline finished, with everything that happened in between:
              re-runs, fixes by hand, and periods of inactivity. Under it, the average number of active hours per project (the hours in which work
              was actually done).
            </p>
          }
          right={value(
            project.spanMs === null ? "–" : duration(project.spanMs),
            project.activeHours === null ? undefined : `${formatHours(project.activeHours)} active ${project.activeHours === 1 ? "hour" : "hours"}`,
          )}
        />
      </section>

      <section className="stats-section">
        <StatHead
          title="Average work time per page"
          about={
            <p>
              How long each step works on one page, on average. Real work only: cached results do not count. Manual steps are timed from when
              they were added to when they were finished, including inactive periods.
            </p>
          }
          right={
            <>
              <span className="muted">split by</span>
              <Picker
                label="Split by"
                value={split}
                options={[
                  { id: "none", label: "No split", short: "–" },
                  { id: "config", label: "Model config" },
                ]}
                onChange={setSplit}
              />
            </>
          }
        />
        {rows.map((row) => (
          <div key={row.step}>
            <StatHead row title={row.label} right={value(row.ms === null ? "–" : duration(row.ms))} />
            {row.configs.map((c) => (
              <div key={c.id} className="stat-subrow">
                <span className="stat-row-title">
                  {c.label}
                  {c.note && <span className="menu-note"> {c.note}</span>}
                </span>
                <span className="stat-subrow-value">{c.ms === null ? "–" : duration(c.ms)}</span>
              </div>
            ))}
          </div>
        ))}
      </section>

      <section className="stats-section">
        <StatHead
          title="Estimated time per page for new scores"
          about={
            <p>
              This is a best-effort estimate of how long a full, standard pipeline would take per page of a new score. If you have a new project
              in mind, multiplying this by the number of pages you want to transcribe should be close to the time it would take for the automated
              pipeline to run through once, without any added manual stages or additional review stages. In the filter at the top of this tab, you
              can restrict the reference data to projects similar to your new one (similar genre, instrumentation, complexity, scan quality, etc.),
              which should make this estimate more accurate.
            </p>
          }
          right={value(estimate === null ? "–" : duration(estimate), estimate === null && selected.size > 0 ? "insufficient data" : undefined)}
        />
      </section>
    </>
  );
}

// Hours with at most one decimal: "6", "6.5".
const formatHours = (h: number) => (Number.isInteger(Math.round(h * 10) / 10) ? `${Math.round(h)}` : (Math.round(h * 10) / 10).toFixed(1));
