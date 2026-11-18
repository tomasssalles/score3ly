import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSystems } from "./lens.ts";
import { buildScore, type ScoreSystemInput } from "./score.ts";
import { box, richScore, stretch, system, voice } from "./testScore.ts";

const voices = (music = "c''1", described = false) => [voice(1, 1, music, described ? "melody" : null), voice(2, 2, "c1", described ? "bass" : null)];
const input = (answers: ScoreSystemInput["answer"][]): ScoreSystemInput[] => answers.map((answer, i) => ({ number: i + 1, page: 1, box: box(0.1), barLines: [], answer }));

// The checks count the measures system by system (lens.ts), the score model piece by piece (score.ts): the two must
// agree on every piece.
test("the checks' count of measures is the score's", () => {
  const scores: [ScoreSystemInput[], number[]][] = [
    [richScore(), [1, 4]],
    [
      input([
        system([stretch(1, voices("c''4", true), { kind: "incomplete" }), stretch(2, voices("c''2")), stretch(3, voices("c''2"), { class: "continues", kind: null })], { lastMeasureContinues: true }, true),
        system([stretch(1, voices(), { class: "continues", kind: null }), stretch(2, [voice(1, 1, "R1*3"), voice(2, 2, "R1*3")]), stretch(3, [], { class: "none", kind: null })]),
      ]),
      [1],
    ],
  ];
  for (const [systems, starts] of scores) {
    const checked = checkSystems(systems.map((s) => ({ answer: s.answer, context: { system: s.number, stretches: s.answer.stretches.length, firstOfPiece: starts.includes(s.number), images: [] } })));
    assert.ok(!("problem" in checked), "problem" in checked ? checked.problem : "");
    const score = buildScore(systems, starts);
    const counted = score.pieces.map((p) => checked.filter((c) => p.systems.some((s) => s.number === c.number)).at(-1)!.state.count);
    assert.deepEqual(
      score.pieces.map((p) => p.measures.reduce((n, m) => n + m.count, 0)),
      counted,
    );
  }
});

test("the score is split into pieces, each with its staves, voices and measures numbered from its start", () => {
  const score = buildScore(richScore(), [1, 4]);
  assert.deepEqual(score.pieces.map((p) => p.systems.map((s) => s.number)), [[1, 2, 3], [4]]);
  // The third staff, new on system 3 above the others, comes first; its label, then the piano's two.
  assert.deepEqual(score.pieces[0].staves.map((s) => [s.staff, s.label, s.abbr]), [[3, "Voice", null], [1, "Piano", "Pno."], [2, null, null]]);
  assert.deepEqual(score.pieces[0].voices.map((v) => v.voice), [1, 2, 3]);
  // A pickup counted from 0, as the printed number 1 on the next measure says; the multi-measure rest stands for four.
  assert.deepEqual(score.pieces[0].measures.map((m) => [m.n, m.count]), [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 4]]);
  // The measure split across systems 1 and 2.
  assert.deepEqual(score.pieces[0].measures[3].parts, [{ system: 1, stretches: [4] }, { system: 2, stretches: [1] }]);
  assert.deepEqual(score.pieces[1].measures.map((m) => m.n), [1, 2]);
  // A list of starts without the first system: it starts a piece all the same.
  assert.deepEqual(buildScore(richScore(), [4]).pieces.map((p) => p.systems.map((s) => s.number)), [[1, 2, 3], [4]]);
});
