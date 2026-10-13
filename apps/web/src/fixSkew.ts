// The `fix_skew` step (DESIGN.md §6): per page, the lines that should be horizontal, as a person left them. It starts
// with the lines `skew_analysis` found; the person deletes, draws and moves lines. Lines are the official requests for
// deskewing: a page left without lines isn't straightened. This module has what doesn't need the browser.

import type { SkewLine } from "@score3ly/imaging";

export const FIX_SKEW_VERSION = 1;

// Drawn lines may be this steep, either way: the person sees the page, so any angle short of vertical is taken.
export const MAX_FIX_ANGLE = 89.9;

// What is stored for a page: only its lines, in fractions of the page's width and height (as skew_analysis's).
export type PageLines = { lines: SkewLine[] };

const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;

// A line through two points, given in pixels of a page `width` × `height`, as stored: from left to right, in
// fractions of the page, with its angle in degrees (positive when it descends to the right). Null when it is too
// steep (or the two points are the same).
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
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return {
    x0: round(clamp(left.x / width), 5),
    y0: round(clamp(left.y / height), 5),
    x1: round(clamp(right.x / width), 5),
    y1: round(clamp(right.y / height), 5),
    angle: round(angle, 3),
  };
}

// What a page's lines mean, shown under it (§6): `angle` is the deskew decision for them (deskewAngle).
export function linesStatus(lines: SkewLine[], angle: number | null): string {
  if (lines.length === 0) return "No lines: left as it is";
  if (angle === null) return "Too small to matter";
  return `Straightened by ${Math.abs(angle).toFixed(2)}°`;
}

// The card's short result, e.g. "lines changed on 2 of 10 pages".
export function fixSkewNote(changed: number, pages: number): string {
  if (changed === 0) return "no changes";
  return pages === 1 ? "lines changed" : `lines changed on ${changed} of ${pages} pages`;
}
