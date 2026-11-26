// The `fix_layout` step (docs/stages/layout.md): the system boxes and bar lines of each page, as a person left them. It starts
// with `layout`'s and is stored in the same format. This module has what doesn't need the browser; the editor is
// LayoutEditor.tsx. Everything is in fractions of the straightened page, as in `layout`.

import { canonicalJson, clamp, MIN_BAR_LINE_GAP, normalizeBarLines, roundTo, type LayoutSystem } from "@score3ly/core";
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

// A system's bar lines as stored (code review B3, core's normalizeBarLines): each inside its box, at least
// MIN_BAR_LINE_GAP from its sides and from each other (closer ones merged), rounded as stored.
function normalized(system: LayoutSystem): LayoutSystem {
  const barLines = normalizeBarLines(system).barLines.map(round);
  const same = barLines.length === system.barLines.length && barLines.every((x, i) => x === system.barLines[i]);
  return same ? system : { ...system, barLines };
}

// Where a bar line can be in a box: the gap away from its sides; null in a box too narrow for one.
function inside(system: LayoutSystem, x: number): number | null {
  const low = system.box.left + MIN_BAR_LINE_GAP;
  const high = system.box.right - MIN_BAR_LINE_GAP;
  return low > high ? null : round(clamp(x, low, high));
}

// The bar line nearest to x (its index), or null for none.
function nearest(barLines: number[], x: number): number | null {
  let best: number | null = null;
  for (const [i, b] of barLines.entries()) if (best === null || Math.abs(b - x) < Math.abs(barLines[best] - x)) best = i;
  return best;
}

// The system without the bar lines its box no longer covers or that are now at its sides (after it was made
// smaller), and with lines closer than the gap merged; the same system when nothing changes.
export function withinBox(system: LayoutSystem): LayoutSystem {
  return normalized(system);
}

// The system with a bar line added at x (kept the gap inside its box), and the new bar line's index. A tap within the
// gap of a line adds nothing and gives that line's index; a box too narrow for a line takes none (index null).
export function addBarLine(system: LayoutSystem, x: number): { system: LayoutSystem; index: number | null } {
  const at = inside(system, x);
  if (at === null) return { system, index: null };
  const close = system.barLines.findIndex((b) => Math.abs(b - at) < MIN_BAR_LINE_GAP);
  if (close >= 0) return { system, index: close };
  const barLines = [...system.barLines, at].sort((a, b) => a - b);
  return { system: { ...system, barLines }, index: barLines.indexOf(at) };
}

// The system with bar line i moved to x (the gap inside its box), and the bar line's index after sorting. While a
// line is dragged it may come close to another; settledBarLine merges them once it is let go.
export function moveBarLine(system: LayoutSystem, i: number, x: number): { system: LayoutSystem; index: number } {
  const at = inside(system, x) ?? system.barLines[i];
  const others = system.barLines.filter((_, j) => j !== i);
  const barLines = [...others, at].sort((a, b) => a - b);
  return { system: { ...system, barLines }, index: barLines.indexOf(at) };
}

// The system once a bar line moved to x is let go: normalized (a line within the gap of another merged with it), and
// the index of the line nearest x.
export function settledBarLine(system: LayoutSystem, x: number): { system: LayoutSystem; index: number | null } {
  const settled = normalized(system);
  return { system: settled, index: nearest(settled.barLines, x) };
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

// Whether a page's systems differ from layout's, ignoring their order (and their keys').
export function systemsChanged(original: LayoutSystem[], fixed: LayoutSystem[]): boolean {
  return canonicalJson(sortSystems(original)) !== canonicalJson(sortSystems(fixed));
}

