// Snapshots of what the issues' rules decide, taken before the code review's batch 29 moved them into issues.ts and
// fixed which systems a box is on (review/plan.md, "What guards requests"; B4): from close systems (their crops overlap
// their neighbours' boxes) and boxes on their edges, every place where those rules reach a request or a stored output:
// the systems and stretches of each box, the lists each review call is sent, the issues as the review and apply_review
// requests give them, apply_review's calls and windows, its `apply` and `others`, where its issues and warnings are
// stored and where the Transcription shows them, a clarification's problems, which issues a review may choose on, the
// warnings about what a call changed, and the folds. One entry each, so that a change shows which case it touched.
// Changed once on purpose, by B4's fix (batch 29): the boxes inside system 2's box near its edges (\`topOf2\`,
// \`bottomOf2\`, so issues 2, 3 and 7) are no longer on systems 1 and 3 too, with what follows from that.
// Changed by the paid release (batch 34): the review's issues text gives a reading issue's `lilypond` as [] (C31).

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { reviewIssuesText } from "@score3ly/prompts";
import type { StoredExtraction } from "./extract.ts";
import { checkReview, reviewIssues, reviewWarnings, type StoredReview } from "./review.ts";
import { applyCalls, callWarnings, issueToApply, type StoredApplyCall } from "./applyReview.ts";
import { boxProblems } from "./humanReview.ts";
import { homeOf, shownSystem, type Note } from "./transcription.ts";
import { appliedIssues, humanReviewedIssues, needsApplying, type PlacedSystem, placesOf, reviewedIssues, type StoredIssue, type StoredWarning, systemsOf } from "./issues.ts";

const hash = (value: unknown) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex").slice(0, 16);

// Page 1: three systems close together (each crop reaches into its neighbours' boxes); page 2: two far apart.
const LAYOUTS = [
  { box: { left: 0.08, right: 0.92, top: 0.1, bottom: 0.25 }, barLines: [0.3, 0.55, 0.75] },
  { box: { left: 0.08, right: 0.92, top: 0.27, bottom: 0.42 }, barLines: [0.5] },
  { box: { left: 0.08, right: 0.92, top: 0.44, bottom: 0.59 }, barLines: [0.35, 0.7] },
  { box: { left: 0.1, right: 0.9, top: 0.1, bottom: 0.3 }, barLines: [0.4] },
  { box: { left: 0.1, right: 0.9, top: 0.6, bottom: 0.8 }, barLines: [] },
];
const PLACED: PlacedSystem[] = LAYOUTS.map((layout, i) => ({ number: i + 1, page: i < 3 ? 1 : 2, layout }));

const BOXES = {
  inside: { page: 1, box: { left: 0.32, right: 0.5, top: 0.12, bottom: 0.2 } },
  topOf2: { page: 1, box: { left: 0.2, right: 0.4, top: 0.272, bottom: 0.3 } }, // in system 2, in system 1's crop
  bottomOf2: { page: 1, box: { left: 0.6, right: 0.8, top: 0.39, bottom: 0.418 } }, // in system 2, in system 3's crop
  marginOf3: { page: 1, box: { left: 0.4, right: 0.6, top: 0.595, bottom: 0.6 } }, // below system 3, only its crop
  gap12: { page: 1, box: { left: 0.5, right: 0.6, top: 0.255, bottom: 0.265 } }, // between 1 and 2, both crops
  across12: { page: 1, box: { left: 0.8, right: 0.9, top: 0.2, bottom: 0.3 } },
  across123: { page: 1, box: { left: 0.1, right: 0.2, top: 0.2, bottom: 0.5 } },
  page2: { page: 2, box: { left: 0.45, right: 0.6, top: 0.15, bottom: 0.25 } },
  bottomOf4: { page: 2, box: { left: 0.2, right: 0.3, top: 0.28, bottom: 0.32 } }, // into its margin
  off: { page: 2, box: { left: 0.1, right: 0.2, top: 0.45, bottom: 0.5 } },
};
type Placed = { page: number; box: { left: number; right: number; top: number; bottom: number } };

const answers = [
  { key: "a", text: "A D" },
  { key: "b", text: "An E" },
];
const issue = (id: number, boxes: Placed[], fields: Partial<StoredIssue> = {}): StoredIssue => ({
  id,
  source: "extract",
  class: "reading",
  boxes,
  location: null,
  question: `Question ${id}?`,
  answers,
  choices: [{ by: "extract", key: "a", reason: null }],
  applied: "a",
  applications: [{ by: "extract", key: "a" }],
  resolved: false,
  lilypond: null,
  ...fields,
});
const chosen = (key: string) => ({ choices: [{ by: "extract", key: "a", reason: null }, { by: "review", key, reason: null }] });

// Issues of every kind, several to apply, on every kind of box.
const ISSUES: StoredIssue[] = [
  issue(1, [BOXES.inside]),
  issue(2, [BOXES.topOf2], chosen("b")),
  issue(3, [BOXES.bottomOf2], { ...chosen("b"), source: "review", applications: undefined }),
  issue(4, [BOXES.marginOf3], chosen("b")),
  issue(5, [BOXES.gap12], { source: "code", choices: [], applied: null, applications: [], answers: [] }),
  issue(6, [BOXES.across12], { ...chosen("b"), class: "format", lilypond: ["\\harmonic"] }),
  issue(7, [BOXES.topOf2, BOXES.inside], chosen("b")),
  issue(8, [BOXES.page2], { source: "user", choices: [{ by: "human_review", key: "a", reason: null }], applied: null, applications: undefined, resolved: true, answers: [answers[0]] }),
  issue(9, [BOXES.bottomOf4], chosen("b")),
  issue(10, [BOXES.across123], chosen("b")),
  issue(11, [BOXES.off], chosen("b")),
];
const WARNINGS: StoredWarning[] = Object.entries(BOXES).map(([name, b]) => ({ message: `Near ${name}.`, boxes: [b] }));

const extraction = (s: PlacedSystem): StoredExtraction => ({
  system: s.number,
  page: s.page,
  answer: { startRepeat: false, staves: [], groups: [], stretches: [], lastMeasureContinues: false, issues: [] },
  issues: [],
  warnings: [],
});
const SHOWN = PLACED.map((s) => shownSystem(extraction(s), s.layout));
const note = (i: StoredIssue): Note => ({ key: `issue-${i.id}`, boxes: i.boxes, kind: "issue", issue: i });

// As runApplyReview stores them: an issue under the first system its boxes are on, a call's warning likewise.
const storedHome = (boxes: Placed[]) => systemsOf(boxes, PLACED)[0] ?? null;
const stretchPlaceBox = (p: { system: number; stretch: number }) => {
  const s = PLACED[p.system - 1];
  return s ? { page: s.page, box: s.layout.box } : null;
};

function snapshots(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, b] of Object.entries(BOXES)) out[`places of ${name}`] = placesOf([b], PLACED);
  for (const i of ISSUES) {
    out[`issue ${i.id}: places`] = placesOf(i.boxes, PLACED);
    out[`issue ${i.id}: stored under`] = storedHome(i.boxes);
    out[`issue ${i.id}: shown under`] = homeOf(note(i), SHOWN);
    out[`issue ${i.id}: as a clarification`] = boxProblems(i.boxes, PLACED);
  }
  for (const w of WARNINGS) out[`${w.message} stored under`] = storedHome(w.boxes);

  // Review: what each call is sent about its system, and which issues it may choose on.
  out["review issues text"] = hash(reviewIssuesText(reviewIssues(ISSUES, PLACED), reviewWarnings(WARNINGS, PLACED)));
  for (const s of PLACED) {
    const here = ISSUES.filter((i) => systemsOf(i.boxes, PLACED).includes(s.number));
    out[`review of system ${s.number}: request lists`] = {
      issues: here.map((i) => i.id),
      resolved: here.filter((i) => i.resolved).map((i) => i.id),
      warnings: WARNINGS.filter((w) => systemsOf(w.boxes, PLACED).includes(s.number)).map((w) => w.message),
    };
    const issues = new Map(ISSUES.map((i) => [i.id, i]));
    out[`review of system ${s.number}: may choose on`] = ISSUES.filter((i) => {
      const r = checkReview({ entries: [{ choice: { issue: i.id, key: i.choices.at(-1)?.key === "b" ? "a" : "b", newAnswer: "", reason: "" } }] }, { system: s.number, issues, systems: PLACED, images: new Map() }, 1);
      return !("problem" in r);
    }).map((i) => i.id);
  }

  // Apply review: its calls, and each call's request lists.
  const calls = applyCalls(ISSUES, PLACED);
  out["apply calls"] = calls;
  for (const c of calls) {
    const onWindow = ISSUES.filter((i) => systemsOf(i.boxes, PLACED).some((n) => c.window.includes(n)));
    out[`apply call at ${c.system}: apply`] = hash(c.issues.map((id) => issueToApply(ISSUES.find((i) => i.id === id)!, PLACED)));
    out[`apply call at ${c.system}: others`] = onWindow.filter((i) => !c.issues.includes(i.id)).map((i) => i.id);
  }
  out["call warnings"] = callWarnings({
    changed: [
      { system: 1, stretch: 1 },
      { system: 1, stretch: 3 },
      { system: 2, stretch: 1 },
      { system: 2, stretch: 2 },
      { system: 3, stretch: 2 },
    ],
    applied: ISSUES.filter(needsApplying),
    patch: { voices: [], stretches: [], systems: [] },
    systems: PLACED,
    placeBox: stretchPlaceBox,
    measureOf: () => null,
  }).map((w) => w.message);

  // The folds: a review's call and its agreements, an apply, a human review.
  const review: StoredReview = { system: 2, entries: [{ choice: { issue: 1, key: "b", newAnswer: null, reason: "Clearer in m. 7" } }] };
  const reviewed = reviewedIssues(ISSUES, [review]);
  const call: StoredApplyCall = { system: 1, window: [1, 2], voices: [], stretches: [], systems: [], choices: [{ issue: 2, key: "a", reason: "Can't" }], applied: [1, 6, 7], changed: [], warnings: [] };
  const applied = appliedIssues(reviewed, [call]);
  const human = humanReviewedIssues(applied, { entries: [{ choice: { issue: 4, key: "c", newAnswer: { key: "c", text: "An F" }, reason: null } }] });
  out["folds"] = hash([[...reviewed.values()], [...applied.values()], [...human.values()]]);
  return out;
}

test("what the issues' rules decide is what it was", () => {
  const actual = snapshots();
  if (process.env.PRINT_SNAPSHOTS) for (const [k, v] of Object.entries(actual)) console.log(`SNAP  ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
  assert.deepEqual(actual, EXPECTED);
});

const EXPECTED: Record<string, unknown> = {
  "places of inside": [{"system":1,"stretches":[2]}],
  "places of topOf2": [{"system":2,"stretches":[1]}],
  "places of bottomOf2": [{"system":2,"stretches":[2]}],
  "places of marginOf3": [{"system":3,"stretches":[2]}],
  "places of gap12": [{"system":1,"stretches":[2,3]},{"system":2,"stretches":[2]}],
  "places of across12": [{"system":1,"stretches":[4]},{"system":2,"stretches":[2]}],
  "places of across123": [{"system":1,"stretches":[1]},{"system":2,"stretches":[1]},{"system":3,"stretches":[1]}],
  "places of page2": [{"system":4,"stretches":[2]}],
  "places of bottomOf4": [{"system":4,"stretches":[1]}],
  "places of off": [],
  "issue 1: places": [{"system":1,"stretches":[2]}],
  "issue 1: stored under": 1,
  "issue 1: shown under": 1,
  "issue 1: as a clarification": {"problem":null,"bad":[]},
  "issue 2: places": [{"system":2,"stretches":[1]}],
  "issue 2: stored under": 2,
  "issue 2: shown under": 2,
  "issue 2: as a clarification": {"problem":null,"bad":[]},
  "issue 3: places": [{"system":2,"stretches":[2]}],
  "issue 3: stored under": 2,
  "issue 3: shown under": 2,
  "issue 3: as a clarification": {"problem":null,"bad":[]},
  "issue 4: places": [{"system":3,"stretches":[2]}],
  "issue 4: stored under": 3,
  "issue 4: shown under": 3,
  "issue 4: as a clarification": {"problem":null,"bad":[]},
  "issue 5: places": [{"system":1,"stretches":[2,3]},{"system":2,"stretches":[2]}],
  "issue 5: stored under": 1,
  "issue 5: shown under": 1,
  "issue 5: as a clarification": {"problem":null,"bad":[]},
  "issue 6: places": [{"system":1,"stretches":[4]},{"system":2,"stretches":[2]}],
  "issue 6: stored under": 1,
  "issue 6: shown under": 1,
  "issue 6: as a clarification": {"problem":null,"bad":[]},
  "issue 7: places": [{"system":1,"stretches":[2]},{"system":2,"stretches":[1]}],
  "issue 7: stored under": 1,
  "issue 7: shown under": 2,
  "issue 7: as a clarification": {"problem":null,"bad":[]},
  "issue 8: places": [{"system":4,"stretches":[2]}],
  "issue 8: stored under": 4,
  "issue 8: shown under": 4,
  "issue 8: as a clarification": {"problem":null,"bad":[]},
  "issue 9: places": [{"system":4,"stretches":[1]}],
  "issue 9: stored under": 4,
  "issue 9: shown under": 4,
  "issue 9: as a clarification": {"problem":null,"bad":[]},
  "issue 10: places": [{"system":1,"stretches":[1]},{"system":2,"stretches":[1]},{"system":3,"stretches":[1]}],
  "issue 10: stored under": 1,
  "issue 10: shown under": 2,
  "issue 10: as a clarification": {"problem":"The boxes are on systems 1, 2, 3. They can be on one system, or on two neighbouring systems.","bad":[0]},
  "issue 11: places": [],
  "issue 11: stored under": null,
  "issue 11: shown under": null,
  "issue 11: as a clarification": {"problem":"Boxes must be on top of systems.","bad":[0]},
  "Near inside. stored under": 1,
  "Near topOf2. stored under": 2,
  "Near bottomOf2. stored under": 2,
  "Near marginOf3. stored under": 3,
  "Near gap12. stored under": 1,
  "Near across12. stored under": 1,
  "Near across123. stored under": 1,
  "Near page2. stored under": 4,
  "Near bottomOf4. stored under": 4,
  "Near off. stored under": null,
  "review issues text": "16a174e5cd2c90c2",
  "review of system 1: request lists": {"issues":[1,5,6,7,10],"resolved":[],"warnings":["Near inside.","Near gap12.","Near across12.","Near across123."]},
  "review of system 1: may choose on": [1,6,7,10],
  "review of system 2: request lists": {"issues":[2,3,5,6,7,10],"resolved":[],"warnings":["Near topOf2.","Near bottomOf2.","Near gap12.","Near across12.","Near across123."]},
  "review of system 2: may choose on": [2,3,6,7,10],
  "review of system 3: request lists": {"issues":[4,10],"resolved":[],"warnings":["Near marginOf3.","Near across123."]},
  "review of system 3: may choose on": [4,10],
  "review of system 4: request lists": {"issues":[8,9],"resolved":[8],"warnings":["Near page2.","Near bottomOf4."]},
  "review of system 4: may choose on": [9],
  "review of system 5: request lists": {"issues":[],"resolved":[],"warnings":[]},
  "review of system 5: may choose on": [],
  "apply calls": [{"system":1,"window":[1,2],"issues":[6,7,10,11]},{"system":2,"window":[2],"issues":[2,3]},{"system":3,"window":[3],"issues":[4]},{"system":4,"window":[4],"issues":[8,9]}],
  "apply call at 1: apply": "62fc558b75088f4d",
  "apply call at 1: others": [1,2,3,5],
  "apply call at 2: apply": "d29d875727e1bff8",
  "apply call at 2: others": [5,6,7,10],
  "apply call at 3: apply": "1e9857a0a0d38028",
  "apply call at 3: others": [10],
  "apply call at 4: apply": "ab07f91c74af31dc",
  "apply call at 4: others": [],
  "call warnings": ["Apply review changed stretch 3 of system 1, beyond the boxes of the issues it applied, without giving a reason.","Issue 8 is applied, but none of the stretches under its boxes changed (the transcription may already have said what its chosen answer says).","Issue 9 is applied, but none of the stretches under its boxes changed (the transcription may already have said what its chosen answer says)."],
  "folds": "c86403ede73fb7ef",
};
