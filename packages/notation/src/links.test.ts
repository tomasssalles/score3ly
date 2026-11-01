import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSystem, pieceStart, type LensStretch, type LensSystem, type ScoreState } from "./lens.ts";
import { systemLinks, type LinkedSystem } from "./links.ts";

function stretch(i: number, first: boolean, over: Partial<LensStretch> = {}): LensStretch {
  return {
    stretch: i,
    class: "new",
    kind: "normal",
    printedNumber: null,
    measureNumber: null,
    changes: [],
    ending: null,
    voices: [{ voice: 1, staff: 1, description: first && i === 1 ? "melody" : null, music: "c''1" }],
    rightBarLine: "single",
    ...over,
  };
}

function system(n: number, first: boolean, stretches?: (i: number) => Partial<LensStretch>, over: Partial<LensSystem> = {}): LensSystem {
  return {
    startRepeat: false,
    staves: [{ staff: 1, description: first ? "voice" : null, label: null, clef: "treble", key: "0", time: first ? "4/4" : null }],
    groups: [],
    stretches: Array.from({ length: n }, (_, i) => stretch(i + 1, first, stretches?.(i + 1) ?? {})),
    lastMeasureContinues: false,
    issues: [],
    ...over,
  };
}

function linked(answers: LensSystem[], pieces: number[]): LinkedSystem[] {
  let state: ScoreState = pieceStart();
  return answers.map((answer, i) => {
    const number = i + 1;
    if (pieces.includes(number)) state = pieceStart();
    const result = checkSystem(answer, { system: number, stretches: answer.stretches.length, firstOfPiece: pieces.includes(number), images: [] }, state);
    if ("problem" in result) assert.fail(result.problem);
    state = result.state;
    return { number, answer, state, closed: result.closed };
  });
}

test("end repeats go back to a start repeat, after an earlier end repeat, or to the piece's start", () => {
  const first = system(3, true, (i) => (i === 1 ? { rightBarLine: "endRepeat" } : i === 2 ? { rightBarLine: "endRepeat" } : {}));
  const second = system(2, false, (i) => (i === 2 ? { rightBarLine: "endRepeat" } : {}), { startRepeat: true });
  const links = systemLinks(linked([first, second], [1]), [1]);
  assert.deepEqual(links.get(1), [
    "The end repeat at the right of system 1, stretch 1 goes back to the piece's start (system 1, stretch 1).",
    "The end repeat at the right of system 1, stretch 2 goes back to system 1, stretch 2, after the previous end repeat.",
  ]);
  assert.deepEqual(links.get(2), ["The end repeat at the right of system 2, stretch 2 goes back to the start repeat at system 2, stretch 1."]);
});

test("endings are linked to their neighbours, on every system they cover", () => {
  const first = system(2, true, (i) => (i === 2 ? { ending: { startsHere: true, endsHere: false, label: "1." } } : {}));
  const second = system(2, false, (i) =>
    i === 1 ? { ending: { startsHere: false, endsHere: true, label: null }, rightBarLine: "endRepeat" } : { ending: { startsHere: true, endsHere: true, label: "2." } },
  );
  const links = systemLinks(linked([first, second], [1]), [1]);
  const one = 'The ending "1." runs from system 1, stretch 2 to system 2, stretch 1; the ending "2." follows it at system 2, stretch 2.';
  assert.ok(links.get(1)!.includes(one));
  assert.ok(links.get(2)!.includes(one));
  assert.ok(links.get(2)!.includes('The ending "2." runs from system 2, stretch 2 to system 2, stretch 2; it follows the ending "1." from system 1, stretch 2.'));
});

test("marks across a system break are told to both systems, and one never closed to every system it is open on", () => {
  const first = system(2, true, (i) => (i === 2 ? { voices: [{ voice: 1, staff: 1, description: null, music: "c''2 d''2\\=1(" }] } : {}));
  const second = system(2, false, (i) => (i === 1 ? { voices: [{ voice: 1, staff: 1, description: null, music: "e''1\\=1)" }] } : { voices: [{ voice: 1, staff: 1, description: null, music: "c2\\sustainOn g2" }] }));
  const third = system(1, false);
  const links = systemLinks(linked([first, second, third], [1]), [1]);
  const curve = "Curve 1 in voice 1 opens at system 1, stretch 2 and closes at system 2, stretch 1.";
  assert.deepEqual(links.get(1), [curve]);
  const pedal = "The pedal on staff 1 opens at system 2, stretch 2 and is still open where the piece ends.";
  assert.deepEqual(links.get(2), [curve, pedal]);
  assert.deepEqual(links.get(3), [pedal]);
});

test("pieces are linked apart", () => {
  const links = systemLinks(linked([system(1, true, () => ({ rightBarLine: "endRepeat" })), system(1, true, () => ({ rightBarLine: "endRepeat" }))], [1, 2]), [1, 2]);
  assert.deepEqual(links.get(2), ["The end repeat at the right of system 2, stretch 1 goes back to the piece's start (system 2, stretch 1)."]);
});
