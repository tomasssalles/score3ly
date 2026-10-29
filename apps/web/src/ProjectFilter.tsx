// The filter of the tabs that work on finished projects only (Run times, Effort): no title of its own, so it doesn't
// read as a block, since it applies to the whole tab. On the right, an "i" and the filter button, and under them how
// many projects are selected; the list opens below (the same check list and actions as the average cost per page's,
// without the action on unfinished pipelines: none is listed).

import { useState } from "react";
import { createdBefore, deletedNote } from "./costs";
import { FilterIcon, InfoIcon } from "./icons";
import { ProjectChecks } from "./statsParts";
import { shortDate } from "./time";

export function FinishedProjectsFilter({
  projects,
  out,
  onChange,
}: {
  projects: { id: string; name: string; createdAt: string; deletedAt: string | null; pages: number[] }[];
  out: Set<string>; // the projects taken out
  onChange: (out: Set<string>) => void;
}) {
  const [now] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const [about, setAbout] = useState(false);
  const selected = projects.filter((p) => !out.has(p.id)).length;
  return (
    <section className="run-times-filter">
      <div className="run-times-filter-line">
        <button type="button" className="icon-button stat-info" aria-expanded={about} aria-label="About: the projects" title="About: the projects" onClick={() => setAbout(!about)}>
          <InfoIcon />
        </button>
        <button type="button" className="editor-mode" aria-pressed={open} aria-label="Select the projects" title="Select the projects" onClick={() => setOpen(!open)}>
          <FilterIcon />
          {out.size > 0 && <span className="toggle-dot" />}
        </button>
      </div>
      <p className="stat-note run-times-selected">{selected === 1 ? "1 project selected" : `${selected} projects selected`}</p>
      {about && (
        <div className="settings-hint stat-about">
          <p>Only projects whose pipeline is finished are listed.</p>
        </div>
      )}
      {open && (
        <div className="costs-panel per-page-panel">
          <ProjectChecks
            items={[...projects].reverse().map((p) => ({
              key: p.id,
              name: p.name,
              note: deletedNote(p.deletedAt),
              facts: `${shortDate(p.createdAt, now)} · ${p.pages.length} ${p.pages.length === 1 ? "page" : "pages"}`,
            }))}
            out={out}
            onChange={onChange}
            actions={[
              [
                { label: "Remove projects created more than 30 days ago", ids: createdBefore(projects, "30d", now) },
                { label: "Remove projects created more than 3 months ago", ids: createdBefore(projects, "3m", now) },
                { label: "Remove projects created more than 12 months ago", ids: createdBefore(projects, "12m", now) },
              ],
            ]}
          />
        </div>
      )}
    </section>
  );
}
