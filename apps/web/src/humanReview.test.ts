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
  // A written answer that is one of the answers, exactly, chooses it; case counts; empty text changes nothing.
  assert.deepEqual(userChoice(writeAnswer(stored, issue(1), " A smudge "), 1), { key: "b", newAnswer: null });
  assert.deepEqual(userChoice(writeAnswer(stored, issue(1), "a SMUDGE"), 1), { key: "c", newAnswer: { key: "c", text: "a SMUDGE" } });
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

import { boxProblems, ownIssue, ownIssueProblems, ownIssues, placedSystems, putOwnIssue, removeOwnIssue } from "./humanReview.ts";

test("clarifications: raised, written, replaced in place, removed; one without text keeps Finish waiting", () => {
  const box = { page: 1, box: { left: 0.2, right: 0.3, top: 0.15, bottom: 0.25 } };
  const draft = ownIssue("h1", 7, [box], "  ");
  assert.deepEqual([draft.source, draft.answers, draft.choices, draft.applied, draft.resolved], ["user", [], [], null, true]);
  let stored = putOwnIssue(chooseAnswer({ entries: [] }, issue(1), "b"), draft);
  const systems = placedSystems([{ page: 1, systems: [{ box: { left: 0.1, right: 0.9, top: 0.1, bottom: 0.3 }, barLines: [] }] }]);
  assert.deepEqual(ownIssueProblems(stored, systems), [{ id: 7, problem: "It has no text yet." }]);
  const written = ownIssue("h1", 7, [box], " A C flat ");
  assert.deepEqual([written.answers, written.choices], [[{ key: "a", text: "A C flat" }], [{ by: "h1", key: "a", reason: null }]]);
  stored = putOwnIssue(stored, written);
  assert.equal(stored.entries.length, 2);
  assert.deepEqual(ownIssues(stored), [written]);
  assert.deepEqual(ownIssueProblems(stored, systems), []);
  // Applied like a review's new issue, resolved.
  assert.equal(humanReviewedIssues(new Map(), stored, "h1").get(7)!.resolved, true);
  stored = removeOwnIssue(stored, 7);
  assert.deepEqual(ownIssues(stored), []);
  assert.equal(stored.entries.length, 1);
});

test("a clarification's boxes: at least one, each on a system, on one system or two neighbouring ones; the boxes that break a rule", () => {
  const layout = (top: number) => ({ box: { left: 0.1, right: 0.9, top, bottom: top + 0.2 }, barLines: [] });
  const systems = placedSystems([
    { page: 2, systems: [layout(0.1)] },
    { page: 1, systems: [layout(0.1), layout(0.5)] },
  ]);
  assert.deepEqual(systems.map((s) => [s.number, s.page]), [[1, 1], [2, 1], [3, 2]]);
  const on = (page: number, top: number) => ({ page, box: { left: 0.2, right: 0.3, top, bottom: top + 0.05 } });
  const off = { page: 1, box: { left: 0.2, right: 0.3, top: 0.4, bottom: 0.42 } };
  assert.deepEqual(boxProblems([on(1, 0.15)], systems), { problem: null, bad: [] });
  assert.deepEqual(boxProblems([on(1, 0.15), on(1, 0.55)], systems).problem, null);
  assert.deepEqual(boxProblems([on(1, 0.55), on(2, 0.15)], systems).problem, null);
  assert.deepEqual(boxProblems([on(1, 0.15), on(2, 0.15)], systems), {
    problem: "Its boxes are on systems 1, 3: they can be on one system, or on two neighbouring systems.",
    bad: [0, 1],
  });
  assert.match(boxProblems([on(1, 0.15), on(1, 0.55), on(2, 0.15)], systems).problem!, /neighbouring/);
  assert.deepEqual(boxProblems([on(1, 0.15), off], systems), { problem: "A box isn't on a system.", bad: [1] });
  assert.match(boxProblems([], systems).problem!, /no box/);
});

import { mapThrough } from "./humanReview.ts";

test("positions map through matching anchors, piecewise linear, extrapolated at the ends", () => {
  const from = [10, 30, 50, 70];
  const to = [100, 200, 260, 460];
  assert.equal(mapThrough(from, to, 20), 150); // 50% into the first system
  assert.equal(mapThrough(from, to, 40), 230); // halfway through the gap
  assert.equal(mapThrough(from, to, 80), 560); // beyond the end, the last slope
  assert.equal(mapThrough(from, to, 0), 50); // before the start, the first slope
  assert.equal(mapThrough([], [], 5), null);
});
