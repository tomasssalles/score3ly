import { test } from "node:test";
import assert from "node:assert/strict";
import type { StoredIssue } from "./extract.ts";
import { humanReviewedIssues, humanReviewNote, humanReviewStart, HUMAN_REVIEW_VERSION } from "./humanReview.ts";
import type { ApiStage } from "./api.ts";

function issue(id: number, over: Partial<StoredIssue> = {}): StoredIssue {
  return {
    id,
    source: "extract",
    class: "reading",
    boxes: [{ page: 1, box: { left: 0.2, right: 0.4, top: 0.15, bottom: 0.25 } }],
    location: null,
    question: `Question ${id}?`,
    answers: [
      { key: "a", text: "A staccato" },
      { key: "b", text: "A smudge" },
    ],
    choices: [{ by: "extract", key: "a", reason: null }],
    applied: "a",
    resolved: false,
    lilypond: null,
    ...over,
  };
}

test("a human review with no entries leaves the issues as they were", () => {
  const issues = new Map([issue(1), issue(2)].map((i) => [i.id, i]));
  assert.deepEqual(humanReviewedIssues(issues, { entries: [] }, "h1"), issues);
  assert.equal(humanReviewNote({ entries: [] }), "0 changes");
});

test("a human review's choices and own issues are applied, and resolve their issues", () => {
  const issues = new Map([issue(1), issue(2)].map((i) => [i.id, i]));
  const own = issue(3, { source: "code", choices: [{ by: "h1", key: "a", reason: null }], applied: null, answers: [{ key: "a", text: "A C flat" }] });
  const out = humanReviewedIssues(
    issues,
    { entries: [{ choice: { issue: 1, key: "c", newAnswer: { key: "c", text: "An accent" }, reason: null } }, { newIssue: own }] },
    "h1",
  );
  assert.deepEqual(out.get(1)!.answers.map((a) => a.key), ["a", "b", "c"]);
  assert.deepEqual(out.get(1)!.choices.at(-1), { by: "h1", key: "c", reason: null });
  assert.equal(out.get(1)!.resolved, true);
  assert.equal(out.get(2)!.resolved, false);
  assert.equal(out.get(3)!.resolved, true);
  assert.equal(humanReviewNote({ entries: [{ newIssue: own }] }), "1 change");
});

test("a human review reads the transcription of the Apply review it follows", () => {
  const after = {
    step: "apply_review",
    pageCount: 2,
    outputs: [
      { id: "e1", item: "p1/s1", type: "extraction", contentSha256: "x" },
      { id: "c", item: "", type: "score_checks", contentSha256: "y" },
      { id: "call", item: "p1/s1", type: "apply_review", contentSha256: "z" },
    ],
  } as unknown as ApiStage;
  assert.deepEqual(humanReviewStart(after), { stepVersion: HUMAN_REVIEW_VERSION, pageCount: 2, inputIds: ["e1", "c"] });
});

import { chooseAnswer, clearChoice, scoreOrder, userChoice, writeAnswer } from "./humanReview.ts";

test("the user's choice: one per issue, an existing answer or a written one, taken back", () => {
  let stored = chooseAnswer({ entries: [] }, issue(1), "b");
  stored = chooseAnswer(stored, issue(2), "a");
  assert.deepEqual(userChoice(stored, 1), { key: "b", newAnswer: null });
  stored = writeAnswer(stored, issue(1), "  An accent ");
  assert.deepEqual(userChoice(stored, 1), { key: "c", newAnswer: { key: "c", text: "An accent" } });
  assert.equal(stored.entries.length, 2);
  // A written answer that is one of the answers chooses it; empty text changes nothing.
  assert.deepEqual(userChoice(writeAnswer(stored, issue(1), "a SMUDGE"), 1), { key: "b", newAnswer: null });
  assert.equal(writeAnswer(stored, issue(1), "  "), stored);
  stored = clearChoice(stored, 1);
  assert.equal(userChoice(stored, 1), null);
  assert.deepEqual(userChoice(stored, 2), { key: "a", newAnswer: null });
});

test("issues in the score's order: page, then system, then from left to right", () => {
  const at = (id: number, page: number, left: number, top: number) => issue(id, { boxes: [{ page, box: { left, right: left + 0.1, top, bottom: top + 0.05 } }] });
  const systems = [
    { left: 0, right: 1, top: 0.1, bottom: 0.3 },
    { left: 0, right: 1, top: 0.5, bottom: 0.7 },
  ];
  const order = scoreOrder([at(1, 2, 0.1, 0.15), at(2, 1, 0.5, 0.55), at(3, 1, 0.8, 0.15), at(4, 1, 0.2, 0.55), at(5, 1, 0.1, 0.15)], () => systems);
  assert.deepEqual(order.map((i) => i.id), [5, 3, 4, 2, 1]);
});
