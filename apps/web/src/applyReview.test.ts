import { test } from "node:test";
import assert from "node:assert/strict";
import { pieceStart, type LensSystem } from "@score3ly/notation";
import type { StoredIssue } from "./extract.ts";
import {
  appliedIssues,
  applyCalls,
  applyNote,
  applyPatch,
  callWarnings,
  changedStretches,
  checkAll,
  checkPatch,
  isNewCodeIssue,
  needsApplying,
  type ApplyContext,
  type StoredApplyCall,
} from "./applyReview.ts";
import type { PlacedSystem } from "./review.ts";

// Three systems on page 1, each with one bar line at 0.5 (two stretches), one piece.
const systems: PlacedSystem[] = [1, 2, 3].map((n) => ({
  number: n,
  page: 1,
  layout: { box: { left: 0.1, right: 0.9, top: 0.1 + (n - 1) * 0.3, bottom: 0.25 + (n - 1) * 0.3 }, barLines: [0.5] },
}));

// A box on stretch `k` of system `n`.
const on = (n: number, k = 1) => {
  const s = systems[n - 1].layout.box;
  return { page: 1, box: k === 1 ? { left: 0.2, right: 0.4, top: s.top + 0.02, bottom: s.bottom - 0.02 } : { left: 0.6, right: 0.8, top: s.top + 0.02, bottom: s.bottom - 0.02 } };
};

function issue(id: number, boxes: StoredIssue["boxes"], over: Partial<StoredIssue> = {}): StoredIssue {
  return {
    id,
    source: "extract",
    class: "reading",
    boxes,
    location: null,
    question: `Question ${id}?`,
    answers: [
      { key: "a", text: "A C" },
      { key: "b", text: "A D" },
    ],
    choices: [
      { by: "extract", key: "a", reason: null },
      { by: "review-1", key: "b", reason: null },
    ],
    applied: "a",
    resolved: false,
    lilypond: null,
    ...over,
  };
}

// A system as `extract` would answer it: one staff, one voice, two measures of 4/4.
function lens(n: number, music = ["c'1", "d'1"]): LensSystem {
  return {
    startRepeat: false,
    staves: [{ staff: 1, description: n === 1 ? "piano" : null, label: null, clef: "treble", key: "0", time: n === 1 ? "4/4" : null }],
    groups: [],
    stretches: music.map((m, i) => ({
      stretch: i + 1,
      class: "new",
      kind: "normal",
      printedNumber: null,
      measureNumber: null,
      changes: [],
      ending: null,
      voices: [{ voice: 1, staff: 1, description: n === 1 && i === 0 ? "melody" : null, music: m }],
      rightBarLine: "single",
    })),
    lastMeasureContinues: false,
    issues: [],
  };
}

const answers = () => new Map([1, 2, 3].map((n) => [n, lens(n)]));
const toCheck = [1, 2, 3].map((n) => ({ number: n, stretches: 2, firstOfPiece: n === 1, images: ["system"], followsPrevious: n > 1 }));
const empty = { voices: [], stretches: [], systems: [], choices: [] };

test("an issue needs applying when its latest choice isn't what is applied", () => {
  assert.equal(needsApplying(issue(1, [on(1)])), true);
  assert.equal(needsApplying(issue(1, [on(1)], { applied: "b" })), false);
  assert.equal(needsApplying(issue(1, [on(1)], { choices: [] })), false);
  // A person's issue, whose applied answer isn't known.
  assert.equal(needsApplying(issue(1, [on(1)], { applied: null, choices: [{ by: "human", key: "a", reason: null }] })), true);
});

test("one call per system where an issue that needs applying begins; its window reaches the next system for an issue that does", () => {
  const list = [
    issue(3, [on(2, 2), on(3)]),
    issue(1, [on(1)]),
    issue(2, [on(1, 2)]),
    issue(4, [on(3)], { applied: "b" }), // already applied
  ];
  assert.deepEqual(applyCalls(list, systems), [
    { system: 1, window: [1], issues: [1, 2] },
    { system: 2, window: [2, 3], issues: [3] },
  ]);
});

test("a patch replaces whole units: a voice's music, a stretch's fields, a system's fields; null music removes a voice", () => {
  const before = answers();
  const after = applyPatch(before, {
    voices: [
      { system: 2, stretch: 1, voice: 1, staff: 1, description: null, music: "e'1", reason: null },
      { system: 2, stretch: 2, voice: 2, staff: 1, description: "inner voice", music: "s1", reason: null },
    ],
    stretches: [{ system: 3, stretch: 2, class: "new", kind: "normal", printedNumber: "6", measureNumber: 6, changes: [], ending: null, rightBarLine: "final", reason: null }],
    systems: [{ system: 1, startRepeat: true, staves: before.get(1)!.staves, groups: [], lastMeasureContinues: false, reason: null }],
  });
  assert.equal(after.get(2)!.stretches[0].voices[0].music, "e'1");
  assert.deepEqual(after.get(2)!.stretches[1].voices.map((v) => v.voice), [1, 2]);
  assert.equal(after.get(3)!.stretches[1].rightBarLine, "final");
  assert.equal(after.get(3)!.stretches[1].voices[0].music, "d'1"); // its voices stay
  assert.equal(after.get(1)!.startRepeat, true);
  assert.equal(before.get(2)!.stretches[0].voices[0].music, "c'1"); // nothing changed in place
  const removed = applyPatch(after, { voices: [{ system: 2, stretch: 2, voice: 2, staff: 1, description: null, music: null, reason: null }], stretches: [], systems: [] });
  assert.deepEqual(removed.get(2)!.stretches[1].voices.map((v) => v.voice), [1]);
  // Compared stretch by stretch: a system's fields count as its first stretch.
  assert.deepEqual(changedStretches(before, after), [
    { system: 1, stretch: 1 },
    { system: 2, stretch: 1 },
    { system: 2, stretch: 2 },
    { system: 3, stretch: 2 },
  ]);
});

test("a patch is checked: only the systems the call may change, each unit once, stretches and voices that exist, reverts of its own issues", () => {
  const issues = new Map([issue(1, [on(2)]), issue(2, [on(3)])].map((i) => [i.id, i]));
  const ctx: ApplyContext = { window: [2], allowed: [1, 2, 3], answers: answers(), toApply: [1], issues };
  const voice = (over: object = {}) => ({ system: 2, stretch: 1, voice: 1, staff: 1, description: null, music: "e'1", reason: null, ...over });
  const problem = (json: object) => {
    const result = checkPatch({ ...empty, ...json }, ctx);
    return "problem" in result ? result.problem : null;
  };
  assert.equal(problem({ voices: [voice()] }), null);
  assert.equal(problem({ voices: [voice({ system: 4 })] }), "a change of voice 1 in stretch 1: system 4 isn't one this call may change (1, 2, 3)");
  assert.equal(problem({ voices: [voice(), voice()] }), "voice 1 of stretch 1 of system 2 is changed twice");
  assert.equal(problem({ voices: [voice({ stretch: 3 })] }), "system 2 has no stretch 3");
  assert.equal(problem({ voices: [voice({ voice: 2, music: null })] }), "voice 2 is removed from stretch 1 of system 2, which doesn't have it");
  assert.equal(problem({ choices: [{ issue: 2, key: "a", reason: "Impossible." }] }), "issue 2 isn't one this call applies: only those can be reverted");
  assert.equal(problem({ choices: [{ issue: 1, key: "b", reason: "Impossible." }] }), 'a revert of issue 1 must choose its applied answer ("a"), not "b"');
  assert.equal(problem({ choices: [{ issue: 1, key: "a", reason: " " }] }), "the revert of issue 1 needs a reason: why it can't be applied");
  assert.equal(problem({ choices: [{ issue: 1, key: "a", reason: "Impossible." }] }), null);
  assert.ok("problem" in checkPatch({ voices: [] }, ctx));
  // A description left out where the voice had one is kept.
  const first = checkPatch({ ...empty, voices: [voice({ system: 1 })] }, ctx);
  assert.ok(!("problem" in first));
  assert.equal(first.voices[0].description, "melody");
});

test("the systems are checked again in order: a patch that breaks a later system is found", () => {
  const ok = checkAll(answers(), toCheck, pieceStart);
  assert.ok(!("system" in ok));
  // Removing the voice's description where it first appears breaks system 1.
  const broken = applyPatch(answers(), { voices: [{ system: 1, stretch: 1, voice: 1, staff: 1, description: null, music: "c'1", reason: null }], stretches: [], systems: [] });
  assert.deepEqual(checkAll(broken, toCheck, pieceStart), { system: 1, problem: "voice 1 is new and needs a description where it first appears" });
});

test("warnings: a change beyond the boxes of the issues applied, with its reason or without, and an applied issue whose stretches didn't change", () => {
  const applied = [issue(1, [on(2)]), issue(2, [on(3, 2)])];
  const patch = {
    voices: [
      { system: 2, stretch: 1, voice: 1, staff: 1, description: null, music: "e'1", reason: null },
      { system: 2, stretch: 2, voice: 1, staff: 1, description: null, music: "f'1", reason: "The slur of issue 1 now ends here." },
      { system: 1, stretch: 2, voice: 1, staff: 1, description: null, music: "g'1", reason: null },
    ],
    stretches: [],
    systems: [],
  };
  const changed = [
    { system: 1, stretch: 2 },
    { system: 2, stretch: 1 },
    { system: 2, stretch: 2 },
  ];
  const warnings = callWarnings({ changed, applied, patch, systems, placeBox: () => null, measureOf: (p) => (p.system - 1) * 2 + p.stretch });
  assert.deepEqual(
    warnings.map((w) => w.message),
    [
      "Apply review changed stretch 2 of system 1 (m. 2), beyond the boxes of the issues it applied, without giving a reason.",
      "Apply review changed stretch 2 of system 2 (m. 4), beyond the boxes of the issues it applied: The slur of issue 1 now ends here.",
      "Issue 2 is applied, but none of the stretches under its boxes changed (the transcription may already have said what its chosen answer says).",
    ],
  );
});

test("after the calls: a reverted issue gets the stage's choice of its applied answer, an applied one its chosen answer as applied", () => {
  const issues = new Map([issue(1, [on(1)]), issue(2, [on(1, 2)]), issue(3, [on(3)])].map((i) => [i.id, i]));
  const call: StoredApplyCall = { system: 1, window: [1], ...empty, choices: [{ issue: 2, key: "a", reason: "They conflict." }], applied: [1], changed: [], warnings: [] };
  const after = appliedIssues(issues, [call], "apply-1");
  assert.equal(after.get(1)!.applied, "b");
  assert.equal(needsApplying(after.get(1)!), false);
  assert.deepEqual(after.get(2)!.choices.at(-1), { by: "apply-1", key: "a", reason: "They conflict.", reverted: true });
  assert.equal(after.get(2)!.applied, "a");
  assert.equal(needsApplying(after.get(2)!), false);
  assert.equal(after.get(3), issues.get(3)); // untouched
  assert.equal(applyNote(4, 2), "4 changes applied, 2 reverted");
  assert.equal(applyNote(1, 0), "1 change applied");
});

test("an issue raised by code again is new only if none asks the same about the same places", () => {
  const existing = [issue(7, [on(2)], { source: "code", question: "Where does the slur end?" })];
  assert.equal(isNewCodeIssue({ question: "Where does the slur end?", boxes: [on(2)] }, existing), false);
  assert.equal(isNewCodeIssue({ question: "Where does the slur end?", boxes: [on(3)] }, existing), true);
  assert.equal(isNewCodeIssue({ question: "Where does the tie end?", boxes: [on(2)] }, existing), true);
});

// docs/stages/music.md, `apply_review`, "When an answer can't be applied as given" (decided 2026-11-03).
test("reverts of an issue with no applied answer choose what the transcription has; a resolved issue's revert is taken as given", () => {
  const unknown = issue(1, [on(2)], { source: "code", applied: null });
  const resolved = issue(2, [on(2)], { source: "user", resolved: true, applied: null, answers: [{ key: "a", text: "A C flat" }], choices: [{ by: "human-1", key: "a", reason: null }] });
  const issues = new Map([unknown, resolved].map((i) => [i.id, i]));
  const ctx: ApplyContext = { window: [2], allowed: [1, 2, 3], answers: answers(), toApply: [1, 2], issues };
  const check = (choices: object[]) => checkPatch({ ...empty, choices }, ctx);
  const problem = (choices: object[]) => {
    const r = check(choices);
    return "problem" in r ? r.problem : null;
  };
  // An existing answer other than the chosen one, or a new one; not both, not neither, not the chosen one.
  assert.equal(problem([{ issue: 1, key: "a", newAnswer: null, reason: "No D there." }]), null);
  assert.match(problem([{ issue: 1, key: "b", newAnswer: null, reason: "No D there." }])!, /chooses its chosen answer/);
  assert.match(problem([{ issue: 1, key: "a", newAnswer: "An E", reason: "No D there." }])!, /exactly one/);
  assert.match(problem([{ issue: 1, key: null, newAnswer: null, reason: "No D there." }])!, /exactly one/);
  assert.match(problem([{ issue: 1, key: null, newAnswer: "A C", reason: "No D there." }])!, /choose it by its key/);
  const written = check([{ issue: 1, key: null, newAnswer: " An E ", reason: "No D there." }]);
  assert.ok(!("problem" in written));
  assert.deepEqual(written.choices, [{ issue: 1, key: "c", newAnswer: { key: "c", text: "An E" }, reason: "No D there." }]);
  // After the calls: the new answer is there, chosen and applied, with no application ("[in this transcription]").
  const call: StoredApplyCall = { system: 2, window: [2], ...empty, choices: written.choices, applied: [], changed: [], warnings: [] };
  const after = appliedIssues(issues, [call], "apply-1").get(1)!;
  assert.deepEqual(after.answers.at(-1), { key: "c", text: "An E" });
  assert.equal(after.applied, "c");
  assert.equal(after.applications, undefined);
  assert.equal(needsApplying(after), false);
  // A resolved issue: whatever it chose, taken (the stage then stops, runApplyReview).
  assert.deepEqual(problem([{ issue: 2, key: "zz", newAnswer: null, reason: "No such note." }]), null);
});
