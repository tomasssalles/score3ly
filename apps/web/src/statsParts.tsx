// What the tabs of the Statistics page share (StatsPage.tsx, UsageTab.tsx): the small picker, a block's head, and the
// toggle between a chart's bars and its running total.

import { useState, type ReactNode } from "react";
import { CheckList, type CheckItem } from "./CheckList";
import { DropdownMenu } from "./DropdownMenu";
import { BarsIcon, ChevronDownIcon, InfoIcon, MoreIcon, RunningTotalIcon } from "./icons";

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

// A small picker: the current choice (its short form, if it has one) and a chevron, opening the list (like the run
// mode).
export function Picker<T extends string>({
  label,
  value,
  options,
  onChange,
  className = "",
}: {
  label: string;
  value: T;
  options: { id: T; label: string; short?: string; note?: string }[];
  onChange: (id: T) => void;
  className?: string;
}) {
  const current = options.find((o) => o.id === value);
  return (
    <DropdownMenu
      className={`mode-picker ${className}`}
      buttonClassName="mode-button"
      icon={
        <>
          {/* One piece of text, so that the name and its note wrap together. */}
          <span>
            {current?.short ?? current?.label}
            {current?.note && !current.short && <span className="menu-note"> {current.note}</span>}
          </span>
          <ChevronDownIcon />
        </>
      }
      label={label}
      groups={[options.map((o) => ({ label: o.label, note: o.note, key: o.id, current: o.id === value, onSelect: () => onChange(o.id) }))]}
    />
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
      isOn={(id) => !out.has(id)}
      setOn={(ids, on) => {
        const next = new Set(out);
        for (const id of ids) {
          if (on) next.delete(id);
          else next.add(id);
        }
        onChange(next);
      }}
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
