// The checks of the whole score (DESIGN.md §6, "No `assemble` stage"): on the lens, at the end of `extract` (and
// later of `apply_review`), once every system is checked on its own (lens.ts). They look at what no single system
// shows: what is left open where a piece ends, the repeat structure, and courtesy signatures against the system after
// them. Like the checks per system, they give issues raised by code where the question is about the page, and
// warnings otherwise.

import { describeMark } from "./spans.ts";
import type { CodeIssue, LensSystem, ScoreState, StretchPlace, Warning } from "./lens.ts";

export type CheckedScoreSystem = { number: number; answer: LensSystem; state: ScoreState }; // `state`: what it leaves

export function checkScore(systems: CheckedScoreSystem[], pieceStarts: number[]): { codeIssues: CodeIssue[]; warnings: Warning[] } {
  const codeIssues: CodeIssue[] = [];
  const warnings: Warning[] = [];
  const sorted = [...systems].sort((a, b) => a.number - b.number);
  const pieces: CheckedScoreSystem[][] = [];
  for (const s of sorted) {
    if (pieces.length === 0 || pieceStarts.includes(s.number)) pieces.push([]);
    pieces[pieces.length - 1].push(s);
  }
  for (const piece of pieces) {
    pieceEnd(piece[piece.length - 1], codeIssues, warnings);
    repeats(piece, warnings);
    courtesies(piece, warnings);
  }
  return { codeIssues, warnings };
}

const lastPlace = (s: CheckedScoreSystem): StretchPlace => ({ system: s.number, stretch: s.answer.stretches.length });

// Where a piece ends, nothing may be left open: a measure, marks with two ends, an ending.
function pieceEnd(last: CheckedScoreSystem, codeIssues: CodeIssue[], warnings: Warning[]) {
  const here = lastPlace(last);
  if (last.answer.lastMeasureContinues) {
    codeIssues.push({
      question: `System ${last.number} ends its piece, but its last measure is read as continuing on the next system. Does it end here?`,
      answers: [
        { key: "a", text: "yes, the measure ends with the piece" },
        { key: "b", text: "no, it continues" },
      ],
      applied: "b",
      places: [here],
    });
  }
  for (const m of last.state.open) {
    codeIssues.push({ question: `Where does this end? Code found that ${describeMark(m)} is still open where the piece ends.`, answers: [], applied: null, places: [here] });
  }
  if (last.state.ending) warnings.push({ message: `An ending is still open where the piece ends, on system ${last.number}.`, places: [here] });
}

type Ending = { label: string | null; start: StretchPlace; end: StretchPlace; endBarLine: string; next: number };

// The repeat structure (§6, "No links between items"): an end repeat goes back to the nearest start repeat before it,
// or to the piece's start; repeats don't nest. Endings: one that another ending follows ends at an end repeat (it goes
// back), and an ending is never alone.
function repeats(piece: CheckedScoreSystem[], warnings: Warning[]) {
  const stretches = piece.flatMap((s) => s.answer.stretches.filter((t) => t.class !== "none").map((t) => ({ system: s, stretch: t })));
  let open: StretchPlace | null = null;
  const start = (at: StretchPlace) => {
    if (open) warnings.push({ message: `Two start repeats without an end repeat between them (system ${open.system} and system ${at.system}): repeats don't nest.`, places: [open, at] });
    open = at;
  };
  const endings: Ending[] = [];
  let current: Ending | null = null;
  for (const [i, { system, stretch }] of stretches.entries()) {
    const at = { system: system.number, stretch: stretch.stretch };
    if (stretch.stretch === firstMeasureStretch(system.answer) && system.answer.startRepeat) start(at);
    if (stretch.ending) {
      if (stretch.ending.startsHere || !current) {
        current = { label: stretch.ending.label, start: at, end: at, endBarLine: stretch.rightBarLine, next: -1 };
        endings.push(current);
      }
      current.label = current.label ?? stretch.ending.label;
      current.end = at;
      current.endBarLine = stretch.rightBarLine;
      if (stretch.ending.endsHere) {
        current.next = i + 1;
        current = null;
      }
    }
    if (stretch.rightBarLine === "endRepeat" || stretch.rightBarLine === "bothRepeats") open = null;
    if (stretch.rightBarLine === "startRepeat" || stretch.rightBarLine === "bothRepeats") start(i + 1 < stretches.length ? { system: stretches[i + 1].system.number, stretch: stretches[i + 1].stretch.stretch } : at);
  }
  if (open) {
    const at: StretchPlace = open;
    warnings.push({ message: `The start repeat on system ${at.system} has no end repeat after it in its piece.`, places: [at] });
  }
  const name = (e: Ending) => (e.label ? `The ending "${e.label}"` : "An ending");
  for (const [k, e] of endings.entries()) {
    const followed = endings[k + 1] && sameStretch(endings[k + 1].start, stretches[e.next]);
    const preceded = k > 0 && sameStretch(e.start, stretches[endings[k - 1].next]);
    if (followed && e.endBarLine !== "endRepeat" && e.endBarLine !== "bothRepeats") {
      warnings.push({ message: `${name(e)} is followed by another ending, but doesn't end with an end repeat.`, places: endPlaces(e) });
    }
    if (!followed && !preceded) warnings.push({ message: `${name(e)} stands alone: no other ending comes right before or after it.`, places: endPlaces(e) });
  }
}

const endPlaces = (e: Ending): StretchPlace[] => (e.start.system === e.end.system && e.start.stretch === e.end.stretch ? [e.start] : [e.start, e.end]);

function sameStretch(a: StretchPlace, b: { system: CheckedScoreSystem; stretch: { stretch: number } } | undefined): boolean {
  return !!b && a.system === b.system.number && a.stretch === b.stretch.stretch;
}

function firstMeasureStretch(answer: LensSystem): number {
  return answer.stretches.find((s) => s.class !== "none")?.stretch ?? 1;
}

// A courtesy key or time signature at a system's end (on a stretch of no measure) announces the next system's start.
function courtesies(piece: CheckedScoreSystem[], warnings: Warning[]) {
  for (const [i, system] of piece.entries()) {
    const next = piece[i + 1];
    if (!next) continue;
    const trailing = [...system.answer.stretches].reverse();
    const courtesy = trailing.slice(0, trailing.findIndex((s) => s.class !== "none") === -1 ? trailing.length : trailing.findIndex((s) => s.class !== "none"));
    for (const s of courtesy) {
      for (const c of s.changes) {
        const staff = next.answer.staves.find((x) => x.staff === c.staff);
        if (!staff) continue;
        const firstChange = next.answer.stretches[0]?.changes.find((x) => x.staff === c.staff);
        const places = [{ system: system.number, stretch: s.stretch }, { system: next.number, stretch: 1 }];
        if (c.key !== null && c.key !== (firstChange?.key ?? staff.key)) {
          warnings.push({ message: `The courtesy key signature ${c.key} on staff ${c.staff} at the end of system ${system.number} doesn't match the start of system ${next.number} (${staff.key}).`, places });
        }
        const nextTime = firstChange?.time ?? staff.time;
        if (c.time !== null && c.time !== nextTime) {
          warnings.push({
            message: `The courtesy time signature ${c.time} on staff ${c.staff} at the end of system ${system.number} doesn't match the start of system ${next.number} (${nextTime ?? "none printed"}).`,
            places,
          });
        }
      }
    }
  }
}
