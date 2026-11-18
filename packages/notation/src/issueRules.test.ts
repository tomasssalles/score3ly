import { test } from "node:test";
import assert from "node:assert/strict";
import { answerKeysProblem, nextAnswerKey, systemsRuleProblem } from "./issueRules.ts";

const answers = (...keys: string[]) => keys.map((key) => ({ key }));

test("a new answer's key is the letter after the last used, never one already there", () => {
  assert.equal(nextAnswerKey([]), "a");
  assert.equal(nextAnswerKey(answers("a", "b")), "c");
  // Keys out of order (which the rule below refuses): the new one still repeats none.
  assert.equal(nextAnswerKey(answers("a", "c")), "d");
  const all = answers(...Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i)));
  assert.equal(nextAnswerKey(all.slice(0, 25)), "z");
  assert.equal(nextAnswerKey(all), null);
});

test("the answers' keys are a, b, c, … in order", () => {
  assert.equal(answerKeysProblem([]), null);
  assert.equal(answerKeysProblem(["a", "b", "c"]), null);
  for (const keys of [["a", "c"], ["b"], ["a", "a"], ["A"], ["ab"]]) assert.match(answerKeysProblem(keys) ?? "", /must be "a", "b", "c", … in order/, keys.join());
  assert.match(answerKeysProblem(Array.from({ length: 27 }, (_, i) => String.fromCharCode(97 + i))) ?? "", /at most 26 answers/);
});

test("an issue's boxes are on at most two consecutive systems", () => {
  for (const systems of [[3], [3, 4], [4, 3, 3], []]) assert.equal(systemsRuleProblem(systems), null, systems.join());
  for (const systems of [[3, 5], [3, 4, 5], [1, 2, 4]]) assert.equal(systemsRuleProblem(systems), "covers more than two consecutive systems", systems.join());
});
