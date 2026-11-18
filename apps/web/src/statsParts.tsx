// What the tabs of the Statistics page share (StatsPage.tsx, UsageTab.tsx, RunTimesTab.tsx, EffortTab.tsx): a block's
// head, the toggle between a chart's bars and its running total, and the list of projects to select.

import { useState, type ReactNode } from "react";
import { CheckList, type CheckItem } from "./ui/CheckList";
import { createdBefore } from "./costs";
import { count, deletedNote, shortDate } from "./format";
import { DropdownMenu } from "./DropdownMenu";
import { BarsIcon, FilterIcon, InfoIcon, MoreIcon, RunningTotalIcon } from "./icons";

export type ChartMode = "bars" | "line";

// Bars per period, or the running total as a line.
export function ChartModes({ mode, onChange }: { mode: ChartMode; onChange: (mode: ChartMode) => void }) {
  return (
    <div className="editor-tools editor-modes" role="radiogroup" aria-label="Chart">
      {(
        [
          ["bars", "Amounts", <BarsIcon key="b" />],
          ["line", "Running total", <RunningTotalIcon key="l" />],
        ] as const
      ).map(([m, title, icon]) => (
        <button key={m} type="button" role="radio" aria-checked={mode === m} className="editor-mode" aria-label={title} title={title} onClick={() => onChange(m)}>
          {icon}
        </button>
      ))}
    </div>
  );
}

// The head of a block of the page: its title and an "i" that shows or hides what the block means, on the left; its
// value (and the controls that change it) on the right, on a line of their own on a phone. A row of a block (`row`)
// is the same, smaller, and may go without the "i".
export function StatHead({ title, about, right, row = false }: { title: string; about?: ReactNode; right: ReactNode; row?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className={row ? "stat-line stat-row" : "stat-line"}>
        {row ? <span className="stat-row-title">{title}</span> : <h3>{title}</h3>}
        {about && (
          <button type="button" className="icon-button stat-info" aria-expanded={open} aria-label={`About: ${title}`} title={`About: ${title}`} onClick={() => setOpen(!open)}>
            <InfoIcon />
          </button>
        )}
        <span className="stat-right">{right}</span>
      </div>
      {open && about && <div className="settings-hint stat-about">{about}</div>}
    </>
  );
}

// A list of projects to select (the average cost per page, the run times): all selected at first, a box above them for
// all or none, and a menu of actions that take projects out of the selection (not settings that stay selected: once
// projects are picked by hand, a setting would stop meaning anything). `out` holds the projects taken out.
export function ProjectChecks({
  items,
  out,
  onChange,
  actions,
}: {
  items: CheckItem[];
  out: Set<string>;
  onChange: (out: Set<string>) => void;
  actions: { label: string; ids: string[] }[][];
}) {
  return (
    <CheckList
      allLabel="All projects"
      items={items}
      out={out}
      onOut={onChange}
      menu={
        <DropdownMenu
          icon={<MoreIcon />}
          label="Remove projects"
          groups={actions.map((group) => group.map((a) => ({ label: a.label, onSelect: () => onChange(new Set([...out, ...a.ids])) })))}
        />
      }
    />
  );
}

type ListedProject = { id: string; name: string; createdAt: string; deletedAt: string | null; pages: unknown[] };

// A project in a list to select: its name (marked if deleted), the day it was created and its pages, and `more` facts
// and amounts.
export function projectItem(p: ListedProject, now: number, more: { facts?: (string | null)[]; amounts?: string[] } = {}): CheckItem {
  const facts = [shortDate(p.createdAt, now), count(p.pages.length, "page"), ...(more.facts ?? [])];
  return { key: p.id, name: p.name, note: deletedNote(p.deletedAt), facts: facts.filter(Boolean).join(" · "), ...(more.amounts ? { amounts: more.amounts } : {}) };
}

// The actions that take the older projects out of a selection.
const AGE_ACTIONS = [
  ["30d", "30 days"],
  ["3m", "3 months"],
  ["12m", "12 months"],
] as const;

export function ageActions(projects: { id: string; createdAt: string }[], now: number): { label: string; ids: string[] }[] {
  return AGE_ACTIONS.map(([age, words]) => ({ label: `Remove projects created more than ${words} ago`, ids: createdBefore(projects, age, now) }));
}

// The filter of the tabs that work on finished projects only (Run times, Effort): no title of its own, so it doesn't
// read as a block, since it applies to the whole tab. On the right, an "i" and the filter button, and under them how
// many projects are selected; the list opens below (the same check list and actions as the average cost per page's,
// without the action on unfinished pipelines: none is listed).
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
      <p className="stat-note run-times-selected">{count(selected, "project")} selected</p>
      {about && (
        <div className="settings-hint stat-about">
          <p>Only projects whose pipeline is finished are listed.</p>
        </div>
      )}
      {open && (
        <div className="costs-panel per-page-panel">
          <ProjectChecks
            items={[...projects].reverse().map((p) => projectItem(p, now))}
            out={out}
            onChange={onChange}
            actions={[ageActions(projects, now)]}
          />
        </div>
      )}
    </section>
  );
}
