import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSystems, type LensStretch } from "./lens.ts";
import { firstMeasureStretch, splitPieces, trailingNoneStretches } from "./structure.ts";
import { richScore, stretch, system, voice } from "./testScore.ts";

const voices = () => [voice(1, 1, "c''1"), voice(2, 2, "c1")];
const none = (i: number, over: Partial<LensStretch> = {}) => stretch(i, [], { class: "none", kind: null, ...over });

test("systems are split into pieces at the starts, in the score's order, the first system always starting one", () => {
  const systems = [3, 1, 4, 2, 5].map((number) => ({ number }));
  assert.deepEqual(splitPieces(systems, [1, 4]), [[{ number: 1 }, { number: 2 }, { number: 3 }], [{ number: 4 }, { number: 5 }]]);
  assert.deepEqual(splitPieces(systems, [3]), [[{ number: 1 }, { number: 2 }], [{ number: 3 }, { number: 4 }, { number: 5 }]]);
  assert.deepEqual(splitPieces([], [1]), []);
});

test("the first stretch that is part of a measure, and the trailing ones that aren't", () => {
  const answer = system([none(1), stretch(2, voices()), stretch(3, voices()), none(4), none(5)]);
  assert.equal(firstMeasureStretch(answer), 2);
  assert.deepEqual(trailingNoneStretches(answer).map((s) => s.stretch), [5, 4]);
  const allNone = system([none(1), none(2)]);
  assert.equal(firstMeasureStretch(allNone), 1);
  assert.deepEqual(trailingNoneStretches(allNone).map((s) => s.stretch), [2, 1]);
  assert.deepEqual(trailingNoneStretches(system([stretch(1, voices())])), []);
});

const contextOf = (n: number, stretches: number, firstOfPiece: boolean) => ({ system: n, stretches, firstOfPiece, images: [] });

test("the systems are checked in order, each from what the one before it left, a piece starting afresh", () => {
  const input = richScore();
  const checked = checkSystems(input.map((s) => ({ answer: s.answer, context: contextOf(s.number, s.answer.stretches.length, s.number === 1 || s.number === 4) })));
  assert.ok(!("problem" in checked));
  assert.deepEqual(checked.map((c) => [c.number, c.state.count]), [[1, 4], [2, 7], [3, 12], [4, 2]]);
  // A system that doesn't follow the one before it in the list starts afresh too.
  const gap = checkSystems([input[0], input[2]].map((s) => ({ answer: s.answer, context: contextOf(s.number, s.answer.stretches.length, s.number === 1) })));
  assert.ok("problem" in gap);
  assert.equal(gap.system, 3);
});

test("the first system that can't be used stops the chain, with its number", () => {
  const input = richScore();
  const result = checkSystems(input.map((s) => ({ answer: s.answer, context: contextOf(s.number, s.number === 2 ? 9 : s.answer.stretches.length, s.number === 1 || s.number === 4) })));
  assert.deepEqual(result, { system: 2, problem: "the answer must have exactly the stretches 1 to 9, in order, and has 1, 2, 3, 4" });
});
