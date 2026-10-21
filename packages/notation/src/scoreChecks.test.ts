import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSystem, pieceStart, type LensStretch, type LensSystem, type ScoreState } from "./lens.ts";
import { checkScore, type CheckedScoreSystem } from "./scoreChecks.ts";

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

function system(n: number, first: boolean, over: Partial<LensSystem> = {}, stretches?: (i: number) => Partial<LensStretch>): LensSystem {
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

// The systems checked one after the other, as `extract` does, with the pieces' starts.
function checked(answers: LensSystem[], pieces: number[]): CheckedScoreSystem[] {
  let state: ScoreState = pieceStart();
  return answers.map((answer, i) => {
    const number = i + 1;
    if (pieces.includes(number)) state = pieceStart();
    const result = checkSystem(answer, { system: number, stretches: answer.stretches.length, firstOfPiece: pieces.includes(number), images: [] }, state);
    if ("problem" in result) assert.fail(result.problem);
    state = result.state;
    return { number, answer, state };
  });
}

test("a clean score has nothing to say", () => {
  const result = checkScore(checked([system(3, true), system(3, false)], [1]), [1]);
  assert.deepEqual(result, { codeIssues: [], warnings: [] });
});

test("a piece that ends with a measure read as continuing, or with a curve still open, raises issues", () => {
  const last = system(2, false, { lastMeasureContinues: true }, (i) => (i === 2 ? { voices: [{ voice: 1, staff: 1, description: null, music: "c''1\\=1(" }] } : {}));
  const { codeIssues } = checkScore(checked([system(2, true), last, system(1, true)], [1, 3]), [1, 3]);
  assert.equal(codeIssues.length, 2);
  assert.match(codeIssues[0].question, /System 2 ends its piece/);
  assert.deepEqual(codeIssues[0].places, [{ system: 2, stretch: 2 }]);
  assert.match(codeIssues[1].question, /curve 1 in voice 1 is still open/);
});

test("repeats: two start repeats in a row, and one never closed, are warnings", () => {
  const a = system(3, true, { startRepeat: true }, (i) => (i === 2 ? { rightBarLine: "startRepeat" } : {}));
  const { warnings } = checkScore(checked([a], [1]), [1]);
  assert.equal(warnings.length, 2);
  assert.match(warnings[0].message, /Two start repeats/);
  assert.match(warnings[1].message, /no end repeat after it/);
});

test("endings: a first ending without an end repeat, and an ending alone, are warnings; a proper pair isn't", () => {
  const good = system(4, true, {}, (i) =>
    i === 2 ? { ending: { startsHere: true, endsHere: true, label: "1." }, rightBarLine: "endRepeat" } : i === 3 ? { ending: { startsHere: true, endsHere: true, label: "2." } } : {},
  );
  assert.deepEqual(checkScore(checked([good], [1]), [1]).warnings, []);
  const bad = system(4, true, {}, (i) => (i === 2 ? { ending: { startsHere: true, endsHere: true, label: "1." } } : i === 3 ? { ending: { startsHere: true, endsHere: true, label: "2." } } : {}));
  const w = checkScore(checked([bad], [1]), [1]).warnings;
  assert.equal(w.length, 1);
  assert.match(w[0].message, /"1\." is followed by another ending, but doesn't end with an end repeat/);
  const alone = system(3, true, {}, (i) => (i === 2 ? { ending: { startsHere: true, endsHere: true, label: "1." }, rightBarLine: "endRepeat" } : {}));
  assert.match(checkScore(checked([alone], [1]), [1]).warnings[0].message, /stands alone/);
});

test("an ending across a system break is one ending", () => {
  const a = system(2, true, {}, (i) => (i === 2 ? { ending: { startsHere: true, endsHere: false, label: "1." } } : {}));
  const b = system(2, false, {}, (i) => (i === 1 ? { ending: { startsHere: false, endsHere: true, label: null }, rightBarLine: "endRepeat" } : { ending: { startsHere: true, endsHere: true, label: "2." } }));
  assert.deepEqual(checkScore(checked([a, b], [1]), [1]).warnings, []);
});

test("a courtesy signature that doesn't match the next system's start is a warning", () => {
  const a = system(3, true, {}, (i) => (i === 3 ? { class: "none", kind: null, voices: [], changes: [{ staff: 1, key: "2s", time: null }], rightBarLine: "none" } : {}));
  const ok = system(1, false, { staves: [{ staff: 1, description: null, label: null, clef: "treble", key: "2s", time: null }] });
  assert.deepEqual(checkScore(checked([a, ok], [1]), [1]).warnings, []);
  const wrong = system(1, false, { staves: [{ staff: 1, description: null, label: null, clef: "treble", key: "1s", time: null }] });
  const w = checkScore(checked([a, wrong], [1]), [1]).warnings;
  assert.equal(w.length, 1);
  assert.match(w[0].message, /courtesy key signature 2s/);
  assert.deepEqual(w[0].places, [{ system: 1, stretch: 3 }, { system: 2, stretch: 1 }]);
});
