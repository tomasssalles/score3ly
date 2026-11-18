// The score's structure as every reader of the whole score needs it (docs/notation.md, "Bar lines, stretches and
// measures"): the systems grouped into pieces, the stretches that are part of a measure at a system's start and end.
// One rule each, for the checks (lens.ts, scoreChecks.ts), the links (links.ts), the score model (score.ts) and the
// MEI (mei.ts).

import type { LensStretch, LensSystem, StretchPlace } from "./lens.ts";
import type { Event } from "./symbolic.ts";

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

// What a stretch does to the measures (docs/notation.md, "Bar lines, stretches and measures"): a "none" stretch is
// part of no measure, a "new" one starts a measure, a "continues" one adds to the measure open before it, or, with
// none open (a mismatch code asks about), starts one of unknown kind. The checks follow it system by system (lens.ts),
// the score model piece by piece (score.ts).
export function measureStep(stretch: Pick<LensStretch, "class">, open: boolean): "none" | "start" | "continue" {
  if (stretch.class === "none") return "none";
  return stretch.class === "new" || !open ? "start" : "continue";
}

type MeasureRest = Extract<Event, { e: "measureRest" }>;

// What takes time in a voice, or holds what does: notes, chords, rests and the groups of them. Everything else is a
// command or a mark printed where it stands (a clef, a tempo mark, a segno, a change of staff), which takes none.
const NOTES_AND_RESTS: readonly Event["e"][] = ["note", "chord", "rest", "measureRest", "tuplet", "grace", "tremolo"];

// A voice's whole-measure or multi-measure rest: its only note or rest is a measure rest (`R1`, `R1*4`), whatever
// commands stand beside it; else null.
export function multiRest(events: Event[]): MeasureRest | null {
  const timed = events.filter((e) => NOTES_AND_RESTS.includes(e.e));
  return timed.length === 1 && timed[0].e === "measureRest" ? timed[0] : null;
}

// A stretch's multi-measure rest, from its voices' events: the rest of the first voice that is one of more than one
// measure (the checks make every voice the same), else null.
export function stretchRest(voices: Event[][]): MeasureRest | null {
  return voices.map(multiRest).find((r) => r !== null && r.count > 1) ?? null;
}

// An ending ("1.", "2.") over a piece's stretches: where it starts and ends (its last stretch may be part of no measure,
// a stretch of courtesy signatures after the system's last bar line that the ending runs on to), the last of its
// stretches that is part of a measure, the bar line at that stretch's right, its label (the first given, on any of its
// stretches), and whether it follows the ending before it (only stretches of no measure between them).
export type EndingRun = {
  label: string | null;
  start: StretchPlace;
  end: StretchPlace;
  places: StretchPlace[];
  lastMeasure: StretchPlace | null;
  endBarLine: LensStretch["rightBarLine"];
  followsPrevious: boolean;
};

// The endings of a piece, from one walk over all its stretches, "none" ones too (the checks, lens.ts, make an ending
// contiguous over them): what the links (links.ts) and the MEI (mei.ts) read.
export function pieceEndings(piece: { number: number; answer: LensSystem }[]): EndingRun[] {
  const endings: EndingRun[] = [];
  let current: EndingRun | null = null;
  let measuresSinceEnd = true; // a stretch of a measure since the last ending ended (or the piece's start)
  for (const system of piece) {
    for (const stretch of system.answer.stretches) {
      const at: StretchPlace = { system: system.number, stretch: stretch.stretch };
      const e = stretch.ending;
      if (!e) {
        if (current || stretch.class !== "none") measuresSinceEnd = true;
        current = null; // an ending left open where the next stretch has none (the checks refuse it) ends there
        continue;
      }
      if (e.startsHere || !current) {
        current = { label: null, start: at, end: at, places: [], lastMeasure: null, endBarLine: stretch.rightBarLine, followsPrevious: endings.length > 0 && !measuresSinceEnd };
        endings.push(current);
      }
      current.places.push(at);
      current.end = at;
      if (current.label === null && e.label?.trim()) current.label = e.label;
      if (stretch.class !== "none" || current.lastMeasure === null) current.endBarLine = stretch.rightBarLine;
      if (stretch.class !== "none") current.lastMeasure = at;
      if (e.endsHere) {
        current = null;
        measuresSinceEnd = false;
      }
    }
  }
  return endings;
}
