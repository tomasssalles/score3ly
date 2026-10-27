// The whole score as code builds it from the lens (docs/notation.md, "Bar lines, stretches and measures"): the systems'
// answers, in the score's order, grouped into pieces (the `pieces` output), each piece with its staves and voices and
// its measures, built from the stretches' classification and numbered per piece (0 or 1 for a pickup, whichever
// matches the printed numbers better). The MEI builder (mei.ts) and the checks of the whole score (scoreChecks.ts)
// start from it.

import { add, fraction, less, mul, ZERO, type Fraction } from "./fraction.ts";
import { eventsDuration } from "./durations.ts";
import type { Box, LensStretch, LensSystem } from "./lens.ts";
import { parseVoice, type Event } from "./symbolic.ts";

// A system of the score: its number in the whole score, its page, its box on the (straightened) page and its inner
// bar lines (fractions of the page, for the facsimile; null box when unknown), and its checked answer.
export type ScoreSystemInput = { number: number; page: number; box: Box | null; barLines: number[]; answer: LensSystem };

// A voice in one stretch: its string parsed, the staff it starts on, and the prefix of its events' ids.
export type Run = { system: number; stretch: number; voice: number; staff: number; events: Event[]; id: string };

export type ScoreStretch = { system: number; stretch: LensStretch; length: Fraction; runs: Run[] };

// A measure: where it is (one part per system it is on, a measure split across a system break has two), its number,
// how many measures it stands for (a multi-measure rest), its kind, and the time in effect at its start.
export type MeasurePart = { system: number; stretches: number[] };
export type ScoreMeasure = {
  index: number; // in the piece, from 0
  n: number;
  count: number;
  kind: LensStretch["kind"];
  parts: MeasurePart[];
  time: string | null;
};

export type PieceStaff = { staff: number; description: string; label: string | null; abbr: string | null };

export type ScorePiece = {
  index: number; // from 0, in the score's order
  systems: ScoreSystemInput[];
  staves: PieceStaff[]; // top to bottom, as the systems show them
  voices: { voice: number; description: string }[];
  measures: ScoreMeasure[];
};

export type Score = {
  pieces: ScorePiece[];
  system: (n: number) => ScoreSystemInput;
  stretch: (system: number, stretch: number) => ScoreStretch;
  pieceOf: (system: number) => ScorePiece;
};

const stretchKey = (system: number, stretch: number) => `${system}/${stretch}`;

export function buildScore(input: ScoreSystemInput[], pieceStarts: number[]): Score {
  const systems = [...input].sort((a, b) => a.number - b.number);
  const starts = new Set([systems[0]?.number ?? 1, ...pieceStarts]);
  const stretches = new Map<string, ScoreStretch>();
  const pieces: ScorePiece[] = [];
  for (const system of systems) {
    if (starts.has(system.number) || pieces.length === 0) pieces.push({ index: pieces.length, systems: [], staves: [], voices: [], measures: [] });
    pieces[pieces.length - 1].systems.push(system);
    for (const s of system.answer.stretches) {
      const runs = s.voices.map((v) => {
        const parsed = parseVoice(v.music);
        if ("problem" in parsed) throw new Error(`System ${system.number}, stretch ${s.stretch}, voice ${v.voice}: ${parsed.problem}`);
        return { system: system.number, stretch: s.stretch, voice: v.voice, staff: v.staff, events: parsed.events, id: `s${system.number}t${s.stretch}v${v.voice}` };
      });
      const length = runs.reduce((max, r) => {
        const d = eventsDuration(r.events);
        return less(max, d) ? d : max;
      }, ZERO);
      stretches.set(stretchKey(system.number, s.stretch), { system: system.number, stretch: s, length, runs });
    }
  }
  for (const piece of pieces) {
    piece.staves = pieceStaves(piece.systems);
    piece.voices = pieceVoices(piece.systems);
    piece.measures = pieceMeasures(piece.systems);
  }
  const bySystem = new Map(systems.map((s) => [s.number, s]));
  const pieceOf = new Map(pieces.flatMap((p) => p.systems.map((s) => [s.number, p] as const)));
  return {
    pieces,
    system: (n) => bySystem.get(n)!,
    stretch: (system, stretch) => stretches.get(stretchKey(system, stretch))!,
    pieceOf: (n) => pieceOf.get(n)!,
  };
}

// The piece's staves top to bottom: each system's order merged in, a staff new on a system placed after the staff
// above it there (or first). Its description from where it is new, its labels as first printed: the first label is the
// full name, a later different one the abbreviation.
function pieceStaves(systems: ScoreSystemInput[]): PieceStaff[] {
  const order: PieceStaff[] = [];
  for (const system of systems) {
    let above: number | null = null;
    for (const s of system.answer.staves) {
      let staff = order.find((x) => x.staff === s.staff);
      if (!staff) {
        staff = { staff: s.staff, description: s.description?.trim() || `staff ${s.staff}`, label: null, abbr: null };
        const at = above === null ? 0 : order.findIndex((x) => x.staff === above) + 1;
        order.splice(at, 0, staff);
      }
      const label = s.label?.trim();
      if (label) {
        if (staff.label === null) staff.label = label;
        else if (staff.abbr === null && label !== staff.label) staff.abbr = label;
      }
      above = s.staff;
    }
  }
  return order;
}

function pieceVoices(systems: ScoreSystemInput[]): { voice: number; description: string }[] {
  const voices = new Map<number, string>();
  for (const system of systems) {
    for (const s of system.answer.stretches) {
      for (const v of s.voices) if (!voices.has(v.voice)) voices.set(v.voice, v.description?.trim() || `voice ${v.voice}`);
    }
  }
  return [...voices.entries()].sort((a, b) => a[0] - b[0]).map(([voice, description]) => ({ voice, description }));
}

// The multi-measure rest's count in a stretch, else 1.
function restCount(s: LensStretch): number {
  for (const v of s.voices) {
    const parsed = parseVoice(v.music);
    if ("events" in parsed) {
      const rest = parsed.events.find((e) => e.e === "measureRest");
      if (rest && rest.e === "measureRest") return rest.count;
    }
  }
  return 1;
}

// The measures, from the classification: a "new" stretch starts one, "continues" adds to the one before (also across
// a system break), "none" is part of none. A "continues" with no measure before it starts one of unknown kind (a
// mismatch code raises as an issue).
function pieceMeasures(systems: ScoreSystemInput[]): ScoreMeasure[] {
  const measures: ScoreMeasure[] = [];
  const times = new Map<number, string | null>();
  let current: ScoreMeasure | null = null;
  const printed: { index: number; number: number }[] = [];
  for (const system of systems) {
    const { answer } = system;
    for (const s of answer.staves) times.set(s.staff, s.time ?? times.get(s.staff) ?? null);
    const top = answer.staves[0].staff;
    for (const s of answer.stretches) {
      for (const c of s.changes) if (c.time) times.set(c.staff, c.time);
      if (s.class === "none") continue;
      if (s.class === "new" || current === null) {
        current = { index: measures.length, n: 0, count: s.class === "new" ? restCount(s) : 1, kind: s.class === "new" ? s.kind : null, parts: [{ system: system.number, stretches: [s.stretch] }], time: times.get(top) ?? null };
        measures.push(current);
        if (s.measureNumber !== null) printed.push({ index: current.index, number: s.measureNumber });
      } else {
        const part = current.parts[current.parts.length - 1];
        if (part.system === system.number) part.stretches.push(s.stretch);
        else current.parts.push({ system: system.number, stretches: [s.stretch] });
      }
    }
  }
  // Numbering: from 1, or from 0 when the piece begins with an incomplete measure and that matches the printed numbers
  // at least as well (a pickup is usually not counted).
  const numbered = (start: number) => {
    const n: number[] = [];
    let next = start;
    for (const m of measures) {
      n.push(next);
      next += m.count;
    }
    return n;
  };
  let start = 1;
  if (measures[0]?.kind === "incomplete") {
    const matches = (n: number[]) => printed.filter((p) => n[p.index] === p.number).length;
    start = matches(numbered(0)) >= matches(numbered(1)) ? 0 : 1;
  }
  numbered(start).forEach((n, i) => (measures[i].n = n));
  return measures;
}

// Where a stretch starts within its measure, as a fraction of a whole note: the lengths of the measure's stretches
// before it.
export function stretchOffsets(score: Score, measure: ScoreMeasure): Map<string, Fraction> {
  const offsets = new Map<string, Fraction>();
  let at = ZERO;
  for (const part of measure.parts) {
    for (const stretch of part.stretches) {
      offsets.set(stretchKey(part.system, stretch), at);
      at = add(at, score.stretch(part.system, stretch).length);
    }
  }
  return offsets;
}

export const measureLengthOf = (score: Score, measure: ScoreMeasure): Fraction =>
  measure.parts.reduce((t, p) => p.stretches.reduce((u, s) => add(u, score.stretch(p.system, s).length), t), ZERO);

// A beat position as MEI's @tstamp: 1 at the measure's start, in units of the time signature's denominator.
export function tstamp(onset: Fraction, unit: number): number {
  const beats = mul(onset, fraction(unit));
  return Math.round((1 + beats.n / beats.d) * 1e4) / 1e4;
}
