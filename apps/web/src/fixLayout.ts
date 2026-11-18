// The `fix_layout` step (docs/stages/layout.md): the system boxes and bar lines of each page, as a person left them. It starts
// with `layout`'s and is stored in the same format. This module has what doesn't need the browser; the editor is
// LayoutEditor.tsx. Everything is in fractions of the straightened page, as in `layout`.

import { clamp, roundTo, type LayoutSystem } from "@score3ly/core";
import type { PageLayout } from "./layout.ts";

// The boxes are edited as any box drawn by hand (editor/boxEdit.ts); re-exported for the geometry snapshots, which
// pin them under this module (geometrySnapshots.test.ts).
export { boxThrough, BOX_HANDLES, MIN_BOX, resizeBox, type BoxHandle } from "./editor/boxEdit.ts";

export const FIX_LAYOUT_VERSION = 1;

type Point = { x: number; y: number }; // fractions of the page

const round = (v: number) => roundTo(v, 5); // as stored (layouts: 5 digits)

// Systems are numbered top to bottom, by their boxes' top edges (then left edges).
export function sortSystems(systems: LayoutSystem[]): LayoutSystem[] {
  return [...systems].sort((a, b) => a.box.top - b.box.top || a.box.left - b.box.left);
}

// The system without the bar lines its box no longer covers (after it was made smaller).
export function withinBox(system: LayoutSystem): LayoutSystem {
  const { left, right } = system.box;
  const barLines = system.barLines.filter((x) => x >= left && x <= right);
  return barLines.length === system.barLines.length ? system : { ...system, barLines };
}

// The system with a bar line added at x (kept within its box), and the new bar line's index.
export function addBarLine(system: LayoutSystem, x: number): { system: LayoutSystem; index: number } {
  const at = round(clamp(x, system.box.left, system.box.right));
  const barLines = [...system.barLines, at].sort((a, b) => a - b);
  return { system: { ...system, barLines }, index: barLines.indexOf(at) };
}

// The system with bar line i moved to x (within its box), and the bar line's index after sorting.
export function moveBarLine(system: LayoutSystem, i: number, x: number): { system: LayoutSystem; index: number } {
  const at = round(clamp(x, system.box.left, system.box.right));
  const others = system.barLines.filter((_, j) => j !== i);
  const barLines = [...others, at].sort((a, b) => a - b);
  return { system: { ...system, barLines }, index: barLines.indexOf(at) };
}

// The system a tap at a point selects: of the boxes under it, the one after the selected one (tapping again where
// boxes overlap goes through them), else the first. Null if no box is under it.
export function systemAt(systems: LayoutSystem[], p: Point, selected: number | null): number | null {
  const under = systems.flatMap((s, i) =>
    p.x >= s.box.left && p.x <= s.box.right && p.y >= s.box.top && p.y <= s.box.bottom ? [i] : [],
  );
  if (under.length === 0) return null;
  const at = selected === null ? -1 : under.indexOf(selected);
  return under[(at + 1) % under.length];
}

// A page's layout as fix_layout stores it: the systems sorted, and not flagged (finishing means checked).
export function fixedLayout(layout: PageLayout): PageLayout {
  return { ...layout, systems: sortSystems(layout.systems), flagged: false };
}

// Whether a page's systems differ from layout's, ignoring their order.
export function systemsChanged(original: LayoutSystem[], fixed: LayoutSystem[]): boolean {
  return JSON.stringify(sortSystems(original)) !== JSON.stringify(sortSystems(fixed));
}

