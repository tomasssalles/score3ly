// The `fix_layout` step (DESIGN.md §6): the system boxes and bar lines of each page, as a person left them. It starts
// with `layout`'s and is stored in the same format. This module has what doesn't need the browser; the editor is
// LayoutEditor.tsx. Everything is in fractions of the straightened page, as in `layout`.

import type { LayoutSystem } from "@score3ly/prompts";
import type { PageLayout } from "./layout.ts";

export const FIX_LAYOUT_VERSION = 1;

export type Box = LayoutSystem["box"];
type Point = { x: number; y: number }; // fractions of the page

// A box smaller than this either way (a fraction of the page) isn't a system: a slip.
export const MIN_BOX = 0.01;

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const round = (v: number) => Math.round(v * 1e5) / 1e5;

// Systems are numbered top to bottom, by their boxes' top edges (then left edges).
export function sortSystems(systems: LayoutSystem[]): LayoutSystem[] {
  return [...systems].sort((a, b) => a.box.top - b.box.top || a.box.left - b.box.left);
}

// The box with two opposite corners at these points, or null if it is too small to be a system.
export function boxThrough(a: Point, b: Point): Box | null {
  const box = {
    left: round(clamp(Math.min(a.x, b.x))),
    right: round(clamp(Math.max(a.x, b.x))),
    top: round(clamp(Math.min(a.y, b.y))),
    bottom: round(clamp(Math.max(a.y, b.y))),
  };
  return box.right - box.left < MIN_BOX || box.bottom - box.top < MIN_BOX ? null : box;
}

// A box's handle: a corner moves two edges, the middle of an edge moves one.
export type BoxHandle = { x: "left" | "right" | null; y: "top" | "bottom" | null };

export const BOX_HANDLES: BoxHandle[] = [
  { x: "left", y: "top" },
  { x: null, y: "top" },
  { x: "right", y: "top" },
  { x: "right", y: null },
  { x: "right", y: "bottom" },
  { x: null, y: "bottom" },
  { x: "left", y: "bottom" },
  { x: "left", y: null },
];

export function handlePoint(box: Box, handle: BoxHandle): Point {
  return {
    x: handle.x === null ? (box.left + box.right) / 2 : box[handle.x],
    y: handle.y === null ? (box.top + box.bottom) / 2 : box[handle.y],
  };
}

// The box with a handle moved to a point. An edge can't pass the opposite one: the box keeps at least MIN_BOX.
export function resizeBox(box: Box, handle: BoxHandle, p: Point): Box {
  const next = { ...box };
  if (handle.x === "left") next.left = round(clamp(p.x, 0, box.right - MIN_BOX));
  if (handle.x === "right") next.right = round(clamp(p.x, box.left + MIN_BOX, 1));
  if (handle.y === "top") next.top = round(clamp(p.y, 0, box.bottom - MIN_BOX));
  if (handle.y === "bottom") next.bottom = round(clamp(p.y, box.top + MIN_BOX, 1));
  return next;
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

// The number of the first system on each page: numbers continue from page to page.
export function firstNumbers(counts: number[]): number[] {
  let next = 1;
  return counts.map((count) => {
    const first = next;
    next += count;
    return first;
  });
}

// The card's short result, e.g. "layout changed on 2 of 10 pages".
export function fixLayoutNote(changed: number, pages: number): string {
  if (changed === 0) return "no changes";
  return pages === 1 ? "layout changed" : `layout changed on ${changed} of ${pages} pages`;
}
