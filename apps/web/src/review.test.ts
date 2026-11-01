import { test } from "node:test";
import assert from "node:assert/strict";
import type { StoredIssue } from "./extract.ts";
import { applyEntries, checkReview, logEntries, placesOf, proposedChanges, reviewedIssues, reviewNote, withKept, type PlacedSystem, type ReviewContext, type StoredReview } from "./review.ts";

// Three systems: 1 and 2 on page 1 (each with one bar line at 0.5), 3 on page 2.
const systems: PlacedSystem[] = [
  { number: 1, page: 1, layout: { box: { left: 0.1, right: 0.9, top: 0.1, bottom: 0.3 }, barLines: [0.5] } },
  { number: 2, page: 1, layout: { box: { left: 0.1, right: 0.9, top: 0.5, bottom: 0.7 }, barLines: [0.5] } },
  { number: 3, page: 2, layout: { box: { left: 0.1, right: 0.9, top: 0.1, bottom: 0.3 }, barLines: [] } },
];

const onSystem = (n: number, left = 0.2, right = 0.4) => {
  const s = systems[n - 1];
  return { page: s.page, box: { left, right, top: s.layout.box.top + 0.05, bottom: s.layout.box.bottom - 0.05 } };
};

function issue(id: number, system: number, over: Partial<StoredIssue> = {}): StoredIssue {
  return {
    id,
    source: "extract",
    class: "reading",
    boxes: [onSystem(system)],
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

const issues = () => new Map([issue(1, 1), issue(2, 2), issue(3, 2, { resolved: true }), issue(4, 1, { choices: [], applied: null, source: "code", answers: [] })].map((i) => [i.id, i]));

// The images of a call about system 2: the system, its stretches, and the previous and next systems, as crops of
// the whole width of their systems' boxes (simple, for the tests).
function context(system = 2): ReviewContext {
  const crop = (n: number) => ({ page: systems[n - 1].page, box: systems[n - 1].layout.box, system: n });
  return {
    system,
    issues: issues(),
    systems,
    images: new Map([
      ["system", crop(system)],
      ["stretch 1", crop(system)],
      ["previous system", crop(system - 1)],
      ["next system", crop(system + 1)],
    ]),
    stageId: "review-1",
  };
}

const newIssue = (over: object = {}) => ({
  newIssue: {
    boxes: [{ image: "system", box: { left: 0.1, right: 0.3, top: 0.2, bottom: 0.8 } }],
    location: null,
    question: "Is this a D or an E?",
    answers: [
      { key: "a", text: "A D" },
      { key: "b", text: "An E" },
    ],
    applied: "a",
    chosen: "b",
    reason: null,
    class: "reading",
    lilypond: null,
    ...over,
  },
});
const choice = (issue: number, key: string | null, newAnswer: string | null = null) => ({ choice: { issue, key, newAnswer, reason: null } });
const problem = (json: unknown) => {
  const result = checkReview(json, context(), 10);
  assert.ok("problem" in result, "expected a problem");
  return result.problem;
};

test("boxes cover the systems they overlap, and the stretches under them", () => {
  assert.deepEqual(placesOf([onSystem(1, 0.2, 0.4)], systems), [{ system: 1, stretches: [1] }]);
  assert.deepEqual(placesOf([onSystem(2, 0.4, 0.6)], systems), [{ system: 2, stretches: [1, 2] }]);
  // A box over the end of system 1 and the start of system 2.
  assert.deepEqual(placesOf([{ page: 1, box: { left: 0.6, right: 0.8, top: 0.25, bottom: 0.55 } }], systems), [
    { system: 1, stretches: [2] },
    { system: 2, stretches: [2] },
  ]);
  assert.deepEqual(placesOf([{ page: 3, box: { left: 0, right: 1, top: 0, bottom: 1 } }], systems), []);
});

test("a usable answer: choices on the system's own issues and new issues, numbered, their boxes on the pages", () => {
  const result = checkReview({ entries: [choice(2, "b"), newIssue(), newIssue({ question: "Another?" })] }, context(), 10);
  assert.ok(!("problem" in result));
  const [c, n1, n2] = result.entries;
  assert.deepEqual(c, { choice: { issue: 2, key: "b", newAnswer: null, reason: null } });
  assert.ok("newIssue" in n1 && "newIssue" in n2);
  assert.equal(n1.newIssue.id, 10);
  assert.equal(n2.newIssue.id, 11);
  assert.equal(n1.newIssue.source, "review");
  assert.deepEqual(n1.newIssue.choices, [{ by: "review-1", key: "b", reason: null }]);
  assert.equal(n1.newIssue.applied, "a");
  // The box on the system's crop, on the page.
  assert.deepEqual(n1.newIssue.boxes[0].page, 1);
  assert.ok(Math.abs(n1.newIssue.boxes[0].box.left - 0.18) < 1e-9);
});

test("a new answer gets the next letter, and must be new", () => {
  const result = checkReview({ entries: [choice(2, null, "A dot of a dotted note")] }, context(), 1);
  assert.ok(!("problem" in result));
  assert.deepEqual(result.entries[0], { choice: { issue: 2, key: "c", newAnswer: { key: "c", text: "A dot of a dotted note" }, reason: null } });
  assert.match(problem({ entries: [choice(2, null, "a smudge")] }), /repeats one of its answers/);
});

test("choices: only on existing, unresolved issues of the call's system, once, changing the chosen answer", () => {
  assert.match(problem({ entries: [choice(99, "a")] }), /doesn't exist/);
  assert.match(problem({ entries: [choice(1, "b")] }), /no box on system 2/);
  assert.match(problem({ entries: [choice(3, "b")] }), /resolved/);
  assert.match(problem({ entries: [choice(2, "b"), choice(2, "a")] }), /twice/);
  assert.match(problem({ entries: [choice(2, "a")] }), /doesn't change its chosen answer/);
  assert.match(problem({ entries: [choice(2, "z")] }), /no answer "z"/);
  assert.match(problem({ entries: [choice(2, "b", "Both")] }), /exactly one/);
});

test("new issues: a box on the call's system, at most two consecutive systems, two answers, applied and chosen different", () => {
  assert.match(problem({ entries: [newIssue({ boxes: [{ image: "previous system", box: { left: 0.1, right: 0.3, top: 0.2, bottom: 0.8 } }] })] }), /no box on system 2/);
  const box = { left: 0.1, right: 0.3, top: 0.2, bottom: 0.8 };
  // The previous and the next system together: three systems.
  assert.match(problem({ entries: [newIssue({ boxes: [{ image: "previous system", box }, { image: "system", box }, { image: "next system", box }] })] }), /more than two/);
  const ok = checkReview({ entries: [newIssue({ boxes: [{ image: "system", box }, { image: "previous system", box }] })] }, context(), 1);
  assert.ok(!("problem" in ok));
  assert.match(problem({ entries: [newIssue({ boxes: [{ image: "stretch 9", box }] })] }), /isn't one of the images/);
  assert.match(problem({ entries: [newIssue({ answers: [{ key: "a", text: "A D" }] })] }), /at least two answers/);
  assert.match(problem({ entries: [newIssue({ chosen: "a" })] }), /the same answer/);
  assert.match(problem({ entries: [newIssue({ class: "format" })] }), /LilyPond/);
  assert.match(problem({ entries: [newIssue({ boxes: [{ image: "system", box: { left: 0.5, right: 0.2, top: 0, bottom: 1 } }] })] }), /isn't a box/);
});

test("the entries apply in order; agreements are added where the latest choice is a model's", () => {
  const call: StoredReview = {
    system: 2,
    entries: [
      { choice: { issue: 2, key: "c", newAnswer: { key: "c", text: "A dot" }, reason: "Like m. 3." } },
      { newIssue: { ...issue(10, 2), source: "review", choices: [{ by: "review-1", key: "b", reason: null }] } },
    ],
  };
  const after = applyEntries(issues(), call, "review-1");
  assert.deepEqual(after.get(2)!.answers.map((a) => a.key), ["a", "b", "c"]);
  assert.deepEqual(after.get(2)!.choices.at(-1), { by: "review-1", key: "c", reason: "Like m. 3." });
  assert.ok(after.has(10));

  // Issue 1 (a model's choice, left alone) is kept; 2 and 10 were chosen on; 3 is resolved; 4 has no choice.
  const human = issue(5, 1, { choices: [{ by: "human-1", key: "b", reason: null }] });
  after.set(5, human);
  const kept = withKept(after, "review-1", (by) => by === "human-1");
  assert.deepEqual(kept.get(1)!.choices.at(-1), { by: "review-1", key: "a", reason: null, kept: true });
  assert.equal(kept.get(2)!.choices.length, after.get(2)!.choices.length);
  assert.equal(kept.get(3)!.choices.length, 1);
  assert.equal(kept.get(4)!.choices.length, 0);
  assert.equal(kept.get(5)!.choices.length, 1);

  const all = reviewedIssues([...issues().values()], [call], "review-1", () => false);
  assert.equal(all.get(1)!.choices.at(-1)!.kept, true);
  assert.equal(proposedChanges([call]), 2);
  assert.equal(reviewNote(2), "2 proposed changes");
  assert.equal(reviewNote(1), "1 proposed change");
});

test("the log gives each change short", () => {
  const call: StoredReview = { system: 2, entries: [{ choice: { issue: 2, key: "c", newAnswer: { key: "c", text: "A dot" }, reason: null } }] };
  assert.deepEqual(logEntries(call), [{ choice: { issue: 2, key: "c", newAnswer: "A dot", reason: null } }]);
});
