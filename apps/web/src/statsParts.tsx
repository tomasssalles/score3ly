// What the tabs of the Statistics page share (StatsPage.tsx, UsageTab.tsx): the small picker, and a block's head.

import { useState, type ReactNode } from "react";
import { DropdownMenu } from "./DropdownMenu";
import { ChevronDownIcon, InfoIcon } from "./icons";

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
  options: { id: T; label: string; short?: string }[];
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
          <ChevronDownIcon />
        </>
      }
      label={label}
      groups={[options.map((o) => ({ label: o.label, current: o.id === value, onSelect: () => onChange(o.id) }))]}
    />
  );
}

// The head of a block of the page: its title and an "i" that shows or hides what the block means, on the left; its
// value (and the controls that change it) on the right, on a line of their own on a phone.
export function StatHead({ title, about, right }: { title: string; about: ReactNode; right: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="stat-line">
        <h3>{title}</h3>
        <button type="button" className="icon-button stat-info" aria-expanded={open} aria-label={`About: ${title}`} title={`About: ${title}`} onClick={() => setOpen(!open)}>
          <InfoIcon />
        </button>
        <span className="stat-right">{right}</span>
      </div>
      {open && <div className="settings-hint stat-about">{about}</div>}
    </>
  );
}
