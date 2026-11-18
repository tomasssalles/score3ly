// The `fix_skew` step (docs/stages/pages.md): per page, the lines that should be horizontal, as a person left them. It starts
// with the lines `skew_analysis` found; the person deletes, draws and moves lines. Lines are the official requests for
// deskewing: a page left without lines isn't straightened. This module has what doesn't need the browser.

import { clamp, roundTo as round } from "@score3ly/core";
import type { SkewLine } from "@score3ly/imaging";

export const FIX_SKEW_VERSION = 1;

// Drawn lines may be this steep, either way: the person sees the page, so any angle short of vertical is taken.
export const MAX_FIX_ANGLE = 89.9;

// What is stored for a page: only its lines, in fractions of the page's width and height (as skew_analysis's).
export type PageLines = { lines: SkewLine[] };

// A line through two points, given in pixels of a page `width` × `height`, as stored: from left to right, in
// fractions of the page, with its angle in degrees (positive when it descends to the right). An end off the page is
// brought back along the line to where it leaves the page, so the stored ends keep the angle drawn. Null when it is
// too steep, the two points are the same, or no part of it is on the page.
export function lineThrough(
  a: { x: number; y: number },
  b: { x: number; y: number },
  width: number,
  height: number,
): SkewLine | null {
  const [left, right] = a.x <= b.x ? [a, b] : [b, a];
  if (right.x === left.x) return null;
  const angle = (Math.atan2(right.y - left.y, right.x - left.x) * 180) / Math.PI;
  if (Math.abs(angle) > MAX_FIX_ANGLE) return null;
  // The part of the segment on the page (Liang–Barsky): the points left + t (right − left) inside it, t from t0 to t1.
  const dx = right.x - left.x;
  const dy = right.y - left.y;
  let t0 = 0;
  let t1 = 1;
  for (const [p, q] of [
    [-dx, left.x],
    [dx, width - left.x],
    [-dy, left.y],
    [dy, height - left.y],
  ]) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
  }
  if (t0 >= t1) return null;
  return {
    x0: round(clamp((left.x + t0 * dx) / width), 5),
    y0: round(clamp((left.y + t0 * dy) / height), 5),
    x1: round(clamp((left.x + t1 * dx) / width), 5),
    y1: round(clamp((left.y + t1 * dy) / height), 5),
    angle: round(angle, 3),
  };
}

// The card's short result, e.g. "lines changed on 2 of 10 pages".
export function fixSkewNote(changed: number, pages: number): string {
  if (changed === 0) return "no changes";
  return pages === 1 ? "lines changed" : `lines changed on ${changed} of ${pages} pages`;
}
