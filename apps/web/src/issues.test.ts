import { test } from "node:test";
import assert from "node:assert/strict";
import { appliedIssues, codeIssue, freshCodeIssues, issuesAfter, needsApplying, placesOf, systemsOf, type PlacedSystem, type StoredIssue } from "./issues.ts";
import { boxProblems, chooseAnswer, ownIssue, putOwnIssue, userChoice, writeAnswer, writtenAnswerKey } from "./humanReview.ts";
import { applyCalls, checkPatch, type StoredApplyCall } from "./applyReview.ts";
import { EXTRACT, extend, whoOf, type Attribution, type Who } from "./attribution.ts";
import { checkReview } from "./review.ts";
import { systemCropBox } from "./crops.ts";

// Six systems close together on one page: each crop (15% of a system's height above and below) reaches into its
// neighbours' boxes.
const CLOSE: PlacedSystem[] = Array.from({ length: 6 }, (_, i) => ({
  number: i + 1,
  page: 1,
  layout: { box: { left: 0.1, right: 0.9, top: 0.02 + i * 0.15, bottom: 0.16 + i * 0.15 }, barLines: [0.5] },
}));
const topOf5 = { page: 1, box: { left: 0.2, right: 0.3, top: CLOSE[4].layout.box.top + 0.002, bottom: CLOSE[4].layout.box.top + 0.03 } };
const bottomOf6 = { page: 1, box: { left: 0.6, right: 0.7, top: CLOSE[5].layout.box.bottom - 0.03, bottom: CLOSE[5].layout.box.bottom - 0.002 } };

test("the systems are close: system 4's crop reaches into system 5's box", () => {
  assert.ok(systemCropBox(CLOSE[3].layout).bottom > topOf5.box.top);
});

test("a box at the top of system 5 is on system 5 only (B4)", () => {
  assert.deepEqual(systemsOf([topOf5], CLOSE), [5]);
  assert.deepEqual(placesOf([topOf5], CLOSE), [{ system: 5, stretches: [1] }]);
});

test("a box only in margins is on the systems whose crops it overlaps", () => {
  const below6 = { page: 1, box: { left: 0.2, right: 0.3, top: CLOSE[5].layout.box.bottom + 0.005, bottom: CLOSE[5].layout.box.bottom + 0.015 } };
  assert.deepEqual(systemsOf([below6], CLOSE), [6]);
  // In the gap between systems 1 and 2, which both crops cover.
  assert.deepEqual(systemsOf([{ page: 1, box: { left: 0.2, right: 0.3, top: 0.162, bottom: 0.168 } }], CLOSE), [1, 2]);
  assert.deepEqual(systemsOf([{ page: 1, box: { left: 0.2, right: 0.3, top: 0.99, bottom: 1 } }], CLOSE), []);
});

test("a clarification on systems 5 and 6 near their edges is valid (B4)", () => {
  assert.deepEqual(boxProblems([topOf5, bottomOf6], CLOSE), { problem: null, bad: [] });
});

test("an issue on systems 5 and 6 near their edges is applied in a call at system 5 with the window [5, 6] (B4)", () => {
  const issue: StoredIssue = {
    id: 1,
    source: "review",
    class: "reading",
    boxes: [topOf5, bottomOf6],
    location: null,
    question: "Is it a D?",
    answers: [
      { key: "a", text: "A D" },
      { key: "b", text: "An E" },
    ],
    choices: [{ by: "review", key: "b", reason: null }],
    applied: "a",
    resolved: false,
    lilypond: null,
  };
  assert.deepEqual(applyCalls([issue], CLOSE), [{ system: 5, window: [5, 6], issues: [1] }]);
});

// --- Answers: their keys, and when a written one is one of them ---

const keyed = (keys: string[]): StoredIssue => ({
  id: 7,
  source: "code",
  class: "reading",
  boxes: [topOf5],
  location: null,
  question: "Where does this slur end?",
  answers: keys.map((key) => ({ key, text: `Answer ${key.toUpperCase()}` })),
  choices: [{ by: "extract", key: keys[0], reason: null }],
  applied: keys[0],
  resolved: false,
  lilypond: null,
});

test("an answer added to answers keyed \"a\", \"c\" gets \"d\", never a key it has (D7)", () => {
  const issue = keyed(["a", "c"]);
  // A person's written answer.
  const written = writeAnswer({ entries: [] }, issue, "On the next E");
  assert.deepEqual(userChoice(written, 7), { key: "d", newAnswer: { key: "d", text: "On the next E" } });
  // A review's new answer.
  const reviewed = checkReview({ entries: [{ choice: { issue: 7, key: "", newAnswer: "On the next E", reason: "" } }] }, { system: 5, issues: new Map([[7, issue]]), systems: CLOSE, images: new Map() }, 1);
  assert.ok(!("problem" in reviewed), JSON.stringify(reviewed));
  assert.deepEqual(reviewed.entries[0], { choice: { issue: 7, key: "d", newAnswer: { key: "d", text: "On the next E" }, reason: null } });
  // Apply review's revert of an issue without an applied answer.
  const open = { ...issue, applied: null, choices: [{ by: "review", key: "c", reason: null }] };
  const answers = new Map([[5, { startRepeat: false, staves: [], groups: [], stretches: [], lastMeasureContinues: false, issues: [] }]]);
  const patch = checkPatch(
    { voices: [], stretches: [], systems: [], choices: [{ issue: 7, key: "", newAnswer: "On the next E", reason: "Neither is there." }] },
    { window: [5], allowed: [5], answers, toApply: [7], issues: new Map([[7, open]]) },
  );
  assert.ok(!("problem" in patch), JSON.stringify(patch));
  assert.deepEqual(patch.choices, [{ issue: 7, key: "d", newAnswer: { key: "d", text: "On the next E" }, reason: "Neither is there." }]);
});

test("case matters in answers (dec. 25): a review's new answer that differs only in case is a new answer", () => {
  const issue = keyed(["a", "b"]);
  const ctx = { system: 5, issues: new Map([[7, issue]]), systems: CLOSE, images: new Map() };
  const differs = checkReview({ entries: [{ choice: { issue: 7, key: "", newAnswer: "answer b", reason: "" } }] }, ctx, 1);
  assert.ok(!("problem" in differs), JSON.stringify(differs));
  assert.equal(differs.entries[0] && "choice" in differs.entries[0] ? differs.entries[0].choice.key : null, "c");
  // The same text, spaces around it aside, repeats an answer.
  const same = checkReview({ entries: [{ choice: { issue: 7, key: "", newAnswer: " Answer B ", reason: "" } }] }, ctx, 1);
  assert.ok("problem" in same && /repeats one of its answers/.test(same.problem));
  // A person's: the same text chooses that answer; another case is another answer.
  assert.deepEqual(userChoice(writeAnswer({ entries: [] }, issue, " Answer B "), 7), { key: "b", newAnswer: null });
  assert.equal(userChoice(writeAnswer({ entries: [] }, issue, "answer b"), 7)?.key, "c");
  assert.equal(writtenAnswerKey(issue, " Answer B "), "b");
  assert.equal(writtenAnswerKey(issue, "answer b"), null);
});

// --- Issues raised by code ---

test("an answered code issue isn't raised again for a reworded question or a box moved by a rounding (D12)", () => {
  const found = { kind: "mark-end:curve", question: "Where does this slur or tie end?", answers: [], applied: null, places: [{ system: 5, stretch: 2 }] };
  const placeBox = (p: { system: number; stretch: number }) => ({ page: 1, box: { ...CLOSE[p.system - 1].layout.box, left: 0.5 } });
  const stored = codeIssue(found, 12, placeBox, "extract");
  const answered = { ...stored, answers: [{ key: "a", text: "On the next E" }], choices: [{ by: "human_review", key: "a", reason: null }], resolved: true };
  const moved = (p: { system: number; stretch: number }) => ({ page: 1, box: { ...placeBox(p).box, top: placeBox(p).box.top + 1e-6 } });
  assert.deepEqual(freshCodeIssues([{ ...found, question: "Where does this curve end?" }], [answered], moved), []);
  // Another place, or another kind of question, is another issue.
  assert.equal(freshCodeIssues([{ ...found, places: [{ system: 5, stretch: 1 }] }], [answered], placeBox).length, 1);
  assert.equal(freshCodeIssues([{ ...found, kind: "mark-start:curve" }], [answered], placeBox).length, 1);
});

// --- The chain: extract → review → apply_review → human_review → apply_review, on the pure folds (D27) ---

test("through the chain, ids stay, choices and applications are only appended, and nothing needs applying after an apply", () => {
  const placeBox = (p: { system: number; stretch: number }) => ({ page: 1, box: CLOSE[p.system - 1].layout.box });
  // Extract: a model's issue and one raised by code.
  const extracted: StoredIssue[] = [
    { ...keyed(["a", "b"]), id: 1, source: "extract", applications: [{ by: "extract", key: "a" }] },
    codeIssue({ kind: "continuation", question: "Does it continue?", answers: [{ key: "a", text: "Yes" }, { key: "b", text: "No" }], applied: "b", places: [{ system: 5, stretch: 1 }] }, 2, placeBox, "extract"),
  ];
  const stages: { who: Who; issues: Map<number, StoredIssue> }[] = [{ who: EXTRACT, issues: issuesAfter(new Map(), { step: "extract", issues: extracted }) }];
  const last = () => stages[stages.length - 1].issues;

  // A review of system 5: a choice on issue 1, a new issue on its image.
  const images = new Map([["system", { page: 1, box: systemCropBox(CLOSE[4].layout), system: 5 }]]);
  const reviewed = checkReview(
    {
      entries: [
        { choice: { issue: 1, key: "b", newAnswer: "", reason: "As in m. 7" } },
        { newIssue: { boxes: [{ image: "system", box: { left: 0.2, right: 0.3, top: 0.3, bottom: 0.6 } }], location: null, question: "A D or an E?", answers: [{ key: "a", text: "A D" }, { key: "b", text: "An E" }], applied: "a", chosen: "b", reason: "", class: "reading", lilypond: null } },
      ],
    },
    { system: 5, issues: last(), systems: CLOSE, images },
    3,
  );
  assert.ok(!("problem" in reviewed), JSON.stringify(reviewed));
  stages.push({ who: whoOf("review", 1), issues: issuesAfter(last(), { step: "review", calls: [{ system: 5, entries: reviewed.entries }], done: true }) });

  // Apply review: every call applies what it was given.
  const apply = (n: number) => {
    const calls = applyCalls(last().values(), CLOSE).map((c): StoredApplyCall => ({ system: c.system, window: c.window, voices: [], stretches: [], systems: [], choices: [], applied: c.issues, changed: [], warnings: [] }));
    assert.ok(calls.length > 0);
    const applied = appliedIssues(last(), calls);
    stages.push({ who: whoOf("apply_review", n), issues: issuesAfter(last(), { step: "apply_review", issues: [...applied.values()] }) });
    for (const issue of last().values()) assert.equal(needsApplying(issue), false, `issue ${issue.id} after Apply review ${n}`);
  };
  apply(1);

  // A human review: an answer chosen on code's issue, one written on issue 3, a clarification.
  let stored = chooseAnswer({ entries: [] }, last().get(2)!, "a");
  stored = writeAnswer(stored, last().get(3)!, "An F");
  stored = putOwnIssue(stored, ownIssue(4, [topOf5], "A tie, not a slur"));
  stages.push({ who: whoOf("human_review", 1), issues: issuesAfter(last(), { step: "human_review", stored }) });
  assert.deepEqual(
    [...last().values()].filter((i) => i.resolved).map((i) => i.id),
    [2, 3, 4],
  );
  apply(2);

  // Ids only added; every issue's choices and applications those before it, with more after them.
  for (const [k, stage] of stages.entries()) {
    if (k === 0) continue;
    const before = stages[k - 1].issues;
    for (const [id, issue] of before) {
      const after = stage.issues.get(id);
      assert.ok(after, `issue ${id} is still there after ${stage.who.label}`);
      assert.deepEqual(after.choices.slice(0, issue.choices.length), issue.choices);
      assert.deepEqual((after.applications ?? []).slice(0, (issue.applications ?? []).length), issue.applications ?? []);
      assert.deepEqual(after.answers.slice(0, issue.answers.length), issue.answers);
    }
  }
  // Attribution names every entry by the stage that added it, with no mismatch.
  let attribution: Attribution = {};
  for (const stage of stages) attribution = extend(attribution, stage.issues.values(), stage.who, (m) => assert.fail(JSON.stringify(m)));
  assert.deepEqual(
    attribution[3].choices.map((w) => w.label),
    ["Review 1", "Human review 1"],
  );
  assert.deepEqual(
    attribution[1].applications.map((w) => w.label),
    ["Extract", "Apply review 1"],
  );
  assert.equal(last().get(3)!.applied, "c");
});
