import { test } from "node:test";
import assert from "node:assert/strict";
import { checkLayoutAnswer, LAYOUT_ROUNDS, LAYOUT_SYSTEM, layoutCheck } from "./layout.ts";

const system = (fields = {}) => ({ left: 0.05, right: 0.95, top: 0.1, bottom: 0.3, barLines: [0.9, 0.3, 0.6], ...fields });
const answer = (systems: unknown[]) => ({ severelySkewed: false, systems, satisfied: true, note: "" });

test("a good answer is taken, with its bar lines sorted", () => {
  const checked = checkLayoutAnswer(answer([system()]));
  assert.ok(!("problem" in checked));
  assert.deepEqual(checked.systems, [{ box: { left: 0.05, right: 0.95, top: 0.1, bottom: 0.3 }, barLines: [0.3, 0.6, 0.9] }]);
});

test("boxes outside the page, the wrong way round, or bar lines outside their box are refused", () => {
  assert.match((checkLayoutAnswer(answer([system({ right: 1.2 })])) as { problem: string }).problem, /system 1: .*within the page/);
  assert.match((checkLayoutAnswer(answer([system(), system({ top: 0.5, bottom: 0.4 })])) as { problem: string }).problem, /system 2/);
  assert.match((checkLayoutAnswer(answer([system({ barLines: [0.99] })])) as { problem: string }).problem, /outside its box/);
  assert.ok("problem" in checkLayoutAnswer({ systems: [] }));
  // A bar line just past the box's edge is fine.
  assert.ok(!("problem" in checkLayoutAnswer(answer([system({ barLines: [0.96] })]))));
});

test("only the last check asks for a note on what is still wrong", () => {
  assert.doesNotMatch(layoutCheck(2), /last check/);
  assert.match(layoutCheck(LAYOUT_ROUNDS), /last check/);
});

test("the boxes are tight, and the bar lines are the inner ones only", () => {
  assert.match(LAYOUT_SYSTEM, /tight around everything/);
  assert.match(LAYOUT_SYSTEM, /Don't add a margin/);
  assert.match(LAYOUT_SYSTEM, /not the one at its very end/);
  assert.doesNotMatch(LAYOUT_SYSTEM, /including the one at the very end/);
  assert.match(layoutCheck(2), /none drawn at the system's start or end/);
});
