// A picker's options as the menu's groups (ui/Picker.tsx, `OptionPicker`): consecutive options of the same group number
// form a group of the menu (a line between groups), with the heading given for its number, if any.

import type { MenuItem } from "./DropdownMenu";

export type PickerOption<T extends string> = { id: T; label: string; short?: string; note?: string; group?: number };

export function optionGroups<T extends string>(
  options: PickerOption<T>[],
  value: T,
  onChange: (id: T) => void,
  headings?: Record<number, string>,
): { groups: MenuItem[][]; headings?: string[] } {
  const grouped: { group: number; items: MenuItem[] }[] = [];
  for (const o of options) {
    const item: MenuItem = { label: o.label, note: o.note, key: o.id, current: o.id === value, onSelect: () => onChange(o.id) };
    const last = grouped[grouped.length - 1];
    if (last && last.group === (o.group ?? 0)) last.items.push(item);
    else grouped.push({ group: o.group ?? 0, items: [item] });
  }
  return { groups: grouped.map((g) => g.items), headings: headings ? grouped.map((g) => headings[g.group] ?? "") : undefined };
}
