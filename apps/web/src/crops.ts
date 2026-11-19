// The crops cut from the straightened pages for the music stages (docs/stages/music.md, `extract`): a system's, and
// its stretches', with the margins code adds to the layout's tight boxes. Their boxes are part of the crops' recipes
// (recipes.ts), so of every request's key.

import { clamp, roundTo, stretchEdges, type Box, type LayoutSystem } from "@score3ly/core";

// The margins code adds to the tight boxes of the layout (§6, `layout`: "margins are code's"), in one place.
// Horizontally a fraction of the page's width, vertically of the system's height (at least a little of the page's).
// Stretch crops get half the neighbouring stretch on each side, so that a slur crossing a bar line shows where it ends.
export const MARGINS = { version: 1, x: 0.01, y: 0.15, minY: 0.005 };

const round = (v: number) => roundTo(v, 6); // canonical numbers for the crop's recipe (§8.6)

function margined(left: number, right: number, box: Box): Box {
  const y = Math.max(MARGINS.y * (box.bottom - box.top), MARGINS.minY);
  return { left: round(clamp(left)), right: round(clamp(right)), top: round(clamp(box.top - y)), bottom: round(clamp(box.bottom + y)) };
}

// The edges of a system's stretches, left to right: its box's edges and its bar lines.
const edges = (system: LayoutSystem) => stretchEdges(system.box, system.barLines);

// The system's crop: its box with margins.
export function systemCropBox(system: LayoutSystem): Box {
  return margined(system.box.left - MARGINS.x, system.box.right + MARGINS.x, system.box);
}

// Each stretch's crop: the stretch with half of each neighbouring stretch (the system's margin at its ends).
export function stretchCropBoxes(system: LayoutSystem): Box[] {
  const x = edges(system);
  return x.slice(0, -1).map((left, i) => {
    const right = x[i + 1];
    const before = i === 0 ? MARGINS.x : (left - x[i - 1]) / 2;
    const after = i === x.length - 2 ? MARGINS.x : (x[i + 2] - right) / 2;
    return margined(left - before, right + after, system.box);
  });
}

// A stretch's own box on the page, without margins: what issues raised by code and warnings point at.
export function stretchBox(system: LayoutSystem, stretch: number): Box {
  const x = stretchEdges(system.box, system.barLines);
  const i = Math.min(Math.max(stretch, 1), x.length - 1) - 1;
  return { left: x[i], right: x[i + 1], top: system.box.top, bottom: system.box.bottom };
}
