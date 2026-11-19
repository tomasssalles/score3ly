// The checks of the whole score (docs/overview.md §6, "No `assemble` stage"): on the lens, at the end of `extract` (and
// of `apply_review`), once every system is checked on its own (lens.ts). They look at what no single system
// shows: what is left open where a piece ends, the repeat structure, and courtesy signatures against the system after
// them. Like the checks per system, they give issues raised by code where the question is about the page, and
// warnings otherwise.

import { repeatStructure } from "./links.ts";
import { whereEnds } from "./spans.ts";
import type { CheckedSystem, CodeIssue, StretchPlace, Warning } from "./lens.ts";
import { splitPieces, trailingNoneStretches } from "./structure.ts";

// A system as checked on its own (lens.ts): its answer, and what it leaves (`state`).
type ScoreSystem = Pick<CheckedSystem, "number" | "answer" | "state">;

export function checkScore(systems: ScoreSystem[], pieceStarts: number[]): { codeIssues: CodeIssue[]; warnings: Warning[] } {
  const codeIssues: CodeIssue[] = [];
  const warnings: Warning[] = [];
  for (const piece of splitPieces(systems, pieceStarts)) {
    pieceEnd(piece[piece.length - 1], codeIssues, warnings);
    warnings.push(...repeatStructure(piece).warnings); // links.ts works the structure out, for these and for `review`
    courtesies(piece, warnings);
  }
  return { codeIssues, warnings };
}

const lastPlace = (s: ScoreSystem): StretchPlace => ({ system: s.number, stretch: s.answer.stretches.length });

// Where a piece ends, nothing may be left open: a measure, marks with two ends, an ending.
function pieceEnd(last: ScoreSystem, codeIssues: CodeIssue[], warnings: Warning[]) {
  const here = lastPlace(last);
  if (last.answer.lastMeasureContinues) {
    codeIssues.push({
      kind: "piece-end",
      question: `Does the piece end with the measure at the end of system ${last.number}?`,
      answers: [
        { key: "a", text: "Yes, the measure ends with the piece" },
        { key: "b", text: "No, it continues" },
      ],
      applied: "b",
      places: [here],
    });
  }
  for (const m of last.state.open) {
    codeIssues.push({ ...whereEnds(m.kind), answers: [], applied: null, places: [here] });
  }
  if (last.state.ending) warnings.push({ message: `An ending is still open where the piece ends, on system ${last.number}.`, places: [here] });
}

// A courtesy key or time signature at a system's end (on a stretch of no measure) announces the next system's start.
function courtesies(piece: ScoreSystem[], warnings: Warning[]) {
  for (const [i, system] of piece.entries()) {
    const next = piece[i + 1];
    if (!next) continue;
    for (const s of trailingNoneStretches(system.answer)) {
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
