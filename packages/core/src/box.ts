// Boxes on pages and images (docs/overview.md §6, "Every box in the app is in our format"): their type, the check that a
// value is one, and the small geometry the stages share. Pure geometry: no crop margins (the web app's `extract`), no
// rule for which system a box is on (the issues').
//
// Numbers here end up in recipes, requests and stored layouts, which are keyed by their bytes: every function keeps the
// arithmetic of the code it replaced, operation for operation.

// A rectangle on a page or an image, as fractions of its width and height from 0 to 1: independent of the image's
// resolution, so it stays valid when the image is made again at another one.
export type Box = { left: number; right: number; top: number; bottom: number };

// A system on a page (docs/stages/layout.md): its box and its bar lines' x positions, fractions of the page, sorted.
export type LayoutSystem = { box: Box; barLines: number[] };

// Why a value isn't a box: `values` when it isn't an object or an edge isn't a number from 0 to 1, `order` when it is
// empty or the wrong way round. `text` says which edge; callers that word it their own way go by `kind`.
export type BoxProblem = { kind: "values" | "order"; text: string };

export function boxProblem(box: unknown): BoxProblem | null {
  if (typeof box !== "object" || box === null) return { kind: "values", text: "not an object" };
  const { left, right, top, bottom } = box as Record<string, unknown>;
  for (const [name, value] of Object.entries({ left, right, top, bottom })) {
    if (typeof value !== "number" || !Number.isFinite(value)) return { kind: "values", text: `"${name}" isn't a number` };
    if (value < 0 || value > 1) return { kind: "values", text: `"${name}" is outside 0 to 1` };
  }
  if ((left as number) >= (right as number)) return { kind: "order", text: '"left" isn\'t less than "right"' };
  if ((top as number) >= (bottom as number)) return { kind: "order", text: '"top" isn\'t less than "bottom"' };
  return null;
}

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

// A number rounded to `digits` decimals: the canonical numbers of what is stored and keyed (5 for layouts and lines,
// 6 for crops' recipes). Changing the digits somewhere changes keys.
export const roundTo = (v: number, digits: number) => Math.round(v * 10 ** digits) / 10 ** digits;

// The area of a box, 0 for one that is empty or the wrong way round.
export const area = (b: Box) => Math.max(0, b.right - b.left) * Math.max(0, b.bottom - b.top);

// Where two boxes meet: the wrong way round when they don't (its area is then 0).
export const intersection = (a: Box, b: Box): Box => ({
  left: Math.max(a.left, b.left),
  right: Math.min(a.right, b.right),
  top: Math.max(a.top, b.top),
  bottom: Math.min(a.bottom, b.bottom),
});

// Whether two boxes share more than an edge.
export const overlaps = (a: Box, b: Box) => Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top);

// A box on an image cut from the page by `crop`, as a box on the page (exact: the crop's box is known).
export function onPage(crop: Box, box: Box): Box {
  const w = crop.right - crop.left;
  const h = crop.bottom - crop.top;
  return { left: crop.left + box.left * w, right: crop.left + box.right * w, top: crop.top + box.top * h, bottom: crop.top + box.bottom * h };
}

// A box on the page, as a box on the image cut from it by `crop` (onPage's inverse); with `clip`, cut at the crop's
// edges.
export function onCrop(crop: Box, box: Box, options: { clip?: boolean } = {}): Box {
  const w = crop.right - crop.left;
  const h = crop.bottom - crop.top;
  const left = (box.left - crop.left) / w;
  const right = (box.right - crop.left) / w;
  const top = (box.top - crop.top) / h;
  const bottom = (box.bottom - crop.top) / h;
  if (!options.clip) return { left, right, top, bottom };
  return { left: Math.max(0, left), right: Math.min(1, right), top: Math.max(0, top), bottom: Math.min(1, bottom) };
}

// The edges of a system's stretches (docs/notation.md, "Stretches"), left to right: its box's left edge, its bar lines,
// its box's right edge. Stretch k (from 1) runs from edge k − 1 to edge k.
export function stretchEdges(box: Box, barLines: number[]): number[] {
  return [box.left, ...barLines, box.right];
}

// The smallest distance, as a fraction of the page's width, between two bar lines of a system, or between a bar line
// and its box's sides: closer, they make a stretch too narrow to hold anything.
export const MIN_BAR_LINE_GAP = 0.005;

// A system's bar lines as a stretch needs them (review B3): sorted, each inside its box by at least `gap` from either
// side (closer ones and those outside dropped), and bar lines closer than `gap` to each other merged into one, at
// their mean. Not used yet: using it changes stored layouts and so requests (the paid release).
export function normalizeBarLines(system: LayoutSystem, gap = MIN_BAR_LINE_GAP): LayoutSystem {
  const { left, right } = system.box;
  const inside = system.barLines.filter((x) => x - left >= gap && right - x >= gap).sort((a, b) => a - b);
  const merged: number[][] = [];
  for (const x of inside) {
    const run = merged[merged.length - 1];
    if (run && x - run[run.length - 1] < gap) run.push(x);
    else merged.push([x]);
  }
  const barLines = merged.map((run) => run.reduce((sum, x) => sum + x, 0) / run.length);
  return { box: system.box, barLines };
}
