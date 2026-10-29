// What the tabs of the Statistics page share (StatsPage.tsx, UsageTab.tsx): the small picker, a block's head, and the
// toggle between a chart's bars and its running total.

import { useState, type ReactNode } from "react";
import { DropdownMenu } from "./DropdownMenu";
import { BarsIcon, ChevronDownIcon, InfoIcon, RunningTotalIcon } from "./icons";

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
          {current?.short ?? current?.label}
          {current?.note && !current.short && <span className="menu-note">&nbsp;{current.note}</span>}
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
