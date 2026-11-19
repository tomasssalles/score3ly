// The issues (docs/notation.md, "Issues"), whoever wrote them: the stored issue and warning, the rules every stage that
// creates or edits issues keeps (which systems a box is on, when an issue needs applying, an issue raised by code),
// and the folds, the issues as a stage leaves them from those before it. The rules about answers' keys and the systems
// an issue may cover are notation's (`issueRules.ts`), so that `extract`'s checks apply them too.

import { area, canonicalJson, intersection, type Box, type LayoutSystem } from "@score3ly/core";
import type { CodeIssue, StretchPlace, Warning } from "@score3ly/notation";
import { stretchBox, systemCropBox } from "./crops.ts";
import type { ReviewEntry, StoredReview } from "./review.ts";
import type { StoredApplyCall } from "./applyReview.ts";
import type { StoredHumanReview } from "./humanReview.ts";

// A box on a page, as issues and warnings store them.
export type PageBox = { page: number; box: Box };

// A choice: `by`, the step of the stage that chose ("extract", "review", "apply_review", "human_review"), never its id
// or turn: which stage of the pipeline that is, the app works out (attribution.ts); `kept`: a review's agreement, added
// by code for an issue it left as it was (docs/stages/music.md, `review`); `reverted`: `apply_review`'s choice of the
// answer already applied, for an answer it couldn't apply as given (docs/stages/music.md, `apply_review`).
export type Choice = { by: string; key: string; reason: string | null; kept?: true; reverted?: true };

// An issue as stored (§6, "Issues"): one schema for every source, its boxes on the pages, its id from the project's
// counter, who chose which answer.
export type StoredIssue = {
  id: number;
  source: "extract" | "review" | "code" | "user"; // "user": a person's own correction, raised in a human review
  class: "reading" | "format";
  boxes: PageBox[];
  location: string | null;
  question: string;
  answers: { key: string; text: string }[];
  choices: Choice[];
  applied: string | null;
  // Who put which answer in the transcription, in order, by step as in `choices`: "extract" for Extract's own issues and
  // those its checks raised, "apply_review" for an Apply review (docs/stages/music.md, "An issue's card"). None for an issue raised after its
  // transcription was written (a review's new issue, code's on an Apply review's transcription).
  applications?: { by: string; key: string }[];
  resolved: boolean;
  lilypond: string[] | null;
};

export type StoredWarning = { message: string; boxes: PageBox[] };

// The latest choice on an issue, the one that counts; null where none was made.
export const latest = (issue: StoredIssue): Choice | null => issue.choices[issue.choices.length - 1] ?? null;

// The issue with a choice added (choices are only ever appended, attribution.ts), and a new answer before it.
export function addChoice(issue: StoredIssue, choice: Choice, newAnswer?: { key: string; text: string } | null): StoredIssue {
  return { ...issue, answers: newAnswer ? [...issue.answers, newAnswer] : issue.answers, choices: [...issue.choices, choice] };
}

// An issue needs applying when it has a choice and its latest choice differs from `applied`, null included
// (docs/notation.md, "Issues").
export function needsApplying(issue: StoredIssue): boolean {
  const last = latest(issue);
  return last !== null && last.key !== issue.applied;
}

// --- Which systems a box is on ---

// A system of the score, where it is: its number, its page and its layout.
export type PlacedSystem = { number: number; page: number; layout: LayoutSystem };

const overlap = (a: Box, b: Box) => area(intersection(a, b));

// The systems a box on a page is on (docs/notation.md, "Issues"), each with how much of the box is on it: those whose
// tight box it overlaps; only a box on none of them is on systems by their margins, those whose crops with margins it
// overlaps. (Crops overlap their neighbours' boxes where systems are close: counting them for every box put a box at
// the top of a system on the system above it too.)
function systemsUnder(b: PageBox, systems: PlacedSystem[]): { system: PlacedSystem; share: number }[] {
  const onPage = systems.filter((s) => s.page === b.page);
  const under = (box: (s: PlacedSystem) => Box) =>
    onPage.flatMap((s) => {
      const share = overlap(b.box, box(s));
      return share > 0 ? [{ system: s, share }] : [];
    });
  const tight = under((s) => s.layout.box);
  return tight.length > 0 ? tight : under((s) => systemCropBox(s.layout));
}

// The systems and stretches boxes on the pages cover (docs/notation.md, "Issues": code works out the stretches under
// the boxes): the systems each box is on (`systemsUnder`), and the stretches of each it overlaps horizontally.
export function placesOf(boxes: PageBox[], systems: PlacedSystem[]): { system: number; stretches: number[] }[] {
  const places = new Map<number, Set<number>>();
  for (const b of boxes) {
    for (const { system: s } of systemsUnder(b, systems)) {
      const stretches = places.get(s.number) ?? new Set<number>();
      for (let k = 1; k <= s.layout.barLines.length + 1; k++) {
        const x = stretchBox(s.layout, k);
        if (Math.min(b.box.right, x.right) > Math.max(b.box.left, x.left)) stretches.add(k);
      }
      places.set(s.number, stretches);
    }
  }
  return [...places.entries()].sort((a, b) => a[0] - b[0]).map(([system, set]) => ({ system, stretches: [...set].sort((a, b) => a - b) }));
}

// The systems boxes are on, in the score's order.
export const systemsOf = (boxes: PageBox[], systems: PlacedSystem[]) => placesOf(boxes, systems).map((p) => p.system);

// The system whose card an issue's or a warning's text goes below in the Transcription: of those its first box is on,
// the one most of it is on. Null when it is on none.
export function homeOf(boxes: PageBox[], systems: PlacedSystem[]): number | null {
  const first = boxes[0];
  if (!first) return null;
  let best: { system: PlacedSystem; share: number } | null = null;
  for (const on of systemsUnder(first, systems)) if (!best || on.share > best.share) best = on;
  return best?.system.number ?? null;
}

// --- Issues and warnings raised by code ---

// Where code's places are on the pages (musicSystems.ts' `placeBox`).
export type PlaceBox = (place: StretchPlace) => PageBox | null;

const placesOnPages = (places: StretchPlace[], placeBox: PlaceBox) => places.flatMap((p) => placeBox(p) ?? []);

// An issue raised by code, as stored. `writtenBy`: the step whose transcription its applied answer is in, "extract" for
// Extract's checks; null for one raised on an Apply review's transcription, after it was written (no application).
export function codeIssue(issue: CodeIssue, id: number, placeBox: PlaceBox, writtenBy: "extract" | null): StoredIssue {
  return {
    id,
    source: "code",
    class: "reading",
    boxes: placesOnPages(issue.places, placeBox),
    location: null,
    question: issue.question,
    answers: issue.answers,
    choices: [],
    applied: issue.applied,
    ...(writtenBy === null ? {} : { applications: issue.applied === null ? [] : [{ by: writtenBy, key: issue.applied }] }),
    resolved: false,
    lilypond: null,
  };
}

export const storedWarning = (w: Warning, placeBox: PlaceBox): StoredWarning => ({ message: w.message, boxes: placesOnPages(w.places, placeBox) });

// A code issue found again on the new transcription is new only if no issue raised by code asks the same about the
// same places (docs/notation.md, "Issues": otherwise every rebuild would raise it again).
export function isNewCodeIssue(issue: Pick<StoredIssue, "question" | "boxes">, existing: Iterable<StoredIssue>): boolean {
  const boxes = canonicalJson(issue.boxes);
  for (const e of existing) if (e.source === "code" && e.question === issue.question && canonicalJson(e.boxes) === boxes) return false;
  return true;
}

// The code issues of a new transcription that are new (`isNewCodeIssue`), as stored, unnumbered (id 0): raised after
// the transcription was written, so with no application.
export function freshCodeIssues(found: CodeIssue[], existing: Iterable<StoredIssue>, placeBox: PlaceBox): StoredIssue[] {
  const all = [...existing];
  return found.map((c) => codeIssue(c, 0, placeBox, null)).filter((c) => isNewCodeIssue(c, all));
}

// --- The folds: the issues as a stage leaves them ---

// The issues after a call's entries (a new map; the issues in it are new objects where they changed). `by`: the step
// whose entries they are (a human review's are a review's entries too).
export function applyEntries(issues: Map<number, StoredIssue>, entries: ReviewEntry[], by: "review" | "human_review" = "review"): Map<number, StoredIssue> {
  const out = new Map(issues);
  for (const e of entries) {
    if ("choice" in e) {
      const issue = out.get(e.choice.issue);
      if (!issue) continue;
      out.set(issue.id, addChoice(issue, { by, key: e.choice.key, reason: e.choice.reason }, e.choice.newAnswer));
    } else {
      out.set(e.newIssue.id, e.newIssue);
    }
  }
  return out;
}

// The issues a review's calls chose on or raised: its changes (its agreements aren't).
export function changedBy(calls: StoredReview[]): Set<number> {
  return new Set(calls.flatMap((c) => c.entries.map((e) => ("choice" in e ? e.choice.issue : e.newIssue.id))));
}

// The review's agreements (docs/stages/music.md, `review`, "Agreement counts"): every unresolved issue the review
// made no choice on (`chose`: those it did), whose latest choice is a model's, gets a choice repeating it, marked `kept`.
export function withKept(issues: Map<number, StoredIssue>, chose: Set<number>): Map<number, StoredIssue> {
  const out = new Map(issues);
  for (const issue of issues.values()) {
    const last = latest(issue);
    if (issue.resolved || !last || last.by === "human_review" || chose.has(issue.id)) continue;
    out.set(issue.id, addChoice(issue, { by: "review", key: last.key, reason: null, kept: true }));
  }
  return out;
}

// The issues as a review leaves them: the reviewed ones, the calls' entries in score order, and once it is done
// (`done`), the agreements.
export function reviewedIssues(issues: Iterable<StoredIssue>, calls: StoredReview[], done = true): Map<number, StoredIssue> {
  let map = new Map([...issues].map((i) => [i.id, i]));
  for (const call of [...calls].sort((a, b) => a.system - b.system)) map = applyEntries(map, call.entries);
  return done ? withKept(map, changedBy(calls)) : map;
}

// The issues after a human review: its entries applied, and every issue it chose on or raised resolved (a person
// decided it, docs/notation.md, "Issues").
export function humanReviewedIssues(issues: Map<number, StoredIssue>, stored: StoredHumanReview): Map<number, StoredIssue> {
  const out = applyEntries(issues, stored.entries, "human_review");
  for (const e of stored.entries) {
    const issue = out.get("choice" in e ? e.choice.issue : e.newIssue.id);
    if (issue) out.set(issue.id, { ...issue, resolved: true });
  }
  return out;
}

// The issues after an Apply review's calls (docs/stages/music.md, `apply_review`): a reverted issue gets the stage's
// choice of its applied answer, with the reason; one without an applied answer gets the answer chosen as `applied` (a
// new one added first), with no application (who wrote that music isn't known: "[in this transcription]"); every other
// issue a call applied has its latest choice as `applied`.
export function appliedIssues(issues: Map<number, StoredIssue>, calls: StoredApplyCall[]): Map<number, StoredIssue> {
  const out = new Map(issues);
  for (const call of [...calls].sort((a, b) => a.system - b.system)) {
    for (const c of call.choices) {
      const issue = out.get(c.issue);
      if (!issue) continue;
      const chosen = addChoice(issue, { by: "apply_review", key: c.key, reason: c.reason, reverted: true }, c.newAnswer);
      out.set(c.issue, { ...chosen, applied: issue.applied ?? c.key });
    }
    for (const id of call.applied) {
      const issue = out.get(id);
      const last = issue && latest(issue);
      if (issue && last) out.set(id, { ...issue, applied: last.key, applications: [...(issue.applications ?? []), { by: "apply_review", key: last.key }] });
    }
  }
  return out;
}
