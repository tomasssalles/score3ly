// The score's structure as every reader of the whole score needs it (docs/notation.md, "Bar lines, stretches and
// measures"): the systems grouped into pieces, the stretches that are part of a measure at a system's start and end.
// One rule each, for the checks (lens.ts, scoreChecks.ts), the links (links.ts), the score model (score.ts) and the
// MEI (mei.ts).

import type { LensStretch, LensSystem } from "./lens.ts";

// The systems grouped into pieces, in the score's order: a piece starts at each of `starts` (the `pieces` output, the
// first system of every piece), and at the first system in any case.
export function splitPieces<T extends { number: number }>(systems: T[], starts: number[]): T[][] {
  const pieces: T[][] = [];
  for (const s of [...systems].sort((a, b) => a.number - b.number)) {
    if (pieces.length === 0 || starts.includes(s.number)) pieces.push([]);
    pieces[pieces.length - 1].push(s);
  }
  return pieces;
}

// The first stretch of a system that is part of a measure (a system's own start repeat is there), or 1.
export function firstMeasureStretch(answer: LensSystem): number {
  return answer.stretches.find((s) => s.class !== "none")?.stretch ?? 1;
}

// The stretches at a system's end that are part of no measure (courtesy signatures after the last bar line), last
// first; every stretch when none is part of a measure.
export function trailingNoneStretches(answer: LensSystem): LensStretch[] {
  const reversed = [...answer.stretches].reverse();
  const last = reversed.findIndex((s) => s.class !== "none");
  return last === -1 ? reversed : reversed.slice(0, last);
}
