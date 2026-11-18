// Editing a box by hand (docs/stages/layout.md, `fix_layout`; one's own issues in a human review, docs/stages/music.md):
// drawn by two opposite corners, resized by its handles. A box and the points are fractions of whatever they are drawn
// on, the same for both, and the result is rounded as layouts are stored (5 digits) and kept within it (0 to 1):
// - `fix_layout` (LayoutEditor.tsx): fractions of the straightened page;
// - a human review's clarifications (HumanReviewCards' `DrawLayer`): `boxThrough` in fractions of the crop, made into
//   the page's by `onPage` after rounding (so stored clarification boxes aren't rounded), and `resizeBox` in fractions
//   of the page, kept within the page, not the crop.
// Apart from the editors, so that the tests can import it without React.

import { clamp, roundTo, type Box } from "@score3ly/core";

type Point = { x: number; y: number }; // fractions of what the box is drawn on

// A box smaller than this either way, a fraction of what it is drawn on, is a slip (on a page, it isn't a system; on a
// crop, it means 1% of the crop).
export const MIN_BOX = 0.01;

const round = (v: number) => roundTo(v, 5); // as layouts are stored (5 digits)

// The box with two opposite corners at these points, or null if it is too small to be meant.
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
