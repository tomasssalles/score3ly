// The app's picker (docs/style.md, "Pickers"): the current choice and a chevron, opening the app's own menu (which can
// dim choices), like the run mode's. One component for every picker; `OptionPicker` takes a list of options.

import type { ReactNode } from "react";
import { DropdownMenu, type MenuItem } from "../DropdownMenu";
import { FittedText } from "../FittedText";
import { ChevronDownIcon } from "../icons";
import { optionGroups, type PickerOption } from "./pickerOptions";

export function Picker({
  value,
  label,
  groups,
  headings,
  className = "",
  fitted = false,
}: {
  value: ReactNode; // what the button shows: the current choice
  label: string; // the button's accessible name
  groups: MenuItem[][];
  headings?: string[];
  className?: string;
  // The value (a text) on one line, shortened in the middle when it doesn't fit (docs/style.md); its width is set by CSS.
  fitted?: boolean;
}) {
  return (
    <DropdownMenu
      className={className ? `mode-picker ${className}` : "mode-picker"}
      buttonClassName="mode-button"
      icon={
        <>
          {fitted ? <FittedText className="picker-value" text={String(value)} lines={1} /> : value}
          <ChevronDownIcon />
        </>
      }
      label={label}
      groups={groups}
      headings={headings}
    />
  );
}

// A picker of options (the statistics' ranges, groupings, projects): the current one's short form, if it has one, in
// the button; a new group number starts a group of the menu, with a heading where `headings` has one.
export function OptionPicker<T extends string>({
  label,
  value,
  options,
  onChange,
  className = "",
  headings,
}: {
  label: string;
  value: T;
  options: PickerOption<T>[];
  headings?: Record<number, string>;
  onChange: (id: T) => void;
  className?: string;
}) {
  const current = options.find((o) => o.id === value);
  const menu = optionGroups(options, value, onChange, headings);
  return (
    <Picker
      className={className}
      label={label}
      value={
        // One piece of text, so that the name and its note wrap together.
        <span>
          {current?.short ?? current?.label}
          {current?.note && !current.short && <span className="menu-note"> {current.note}</span>}
        </span>
      }
      groups={menu.groups}
      headings={menu.headings}
    />
  );
}
