// The `review` step (docs/stages/music.md): what doesn't need the browser or the model. Its runner is runReview.ts.
//
// A review writes issues only: per call (item p<n>/s<k>, type `review`) the entries of its answer, choices on the
// issues of its system and new issues, as code checked and numbered them. The issues as the review leaves them are a
// view: the issues of the transcription it reviewed, with its entries applied in the order of the calls, and its
// agreements ("kept") added for the issues it left as they were.

import type { Box, LensSystem, Score } from "@score3ly/notation";
import { groupForModel, reviewFromModel, staffForModel, stretchForModel, type LayoutSystem, type ReviewAnswer, type ReviewNewIssueEntry } from "@score3ly/prompts";
import { keyOf } from "@score3ly/core";
import { onPage, stretchBox, systemCropBox, type ImageSource, type StoredIssue, type StoredWarning } from "./extract.ts";

export const REVIEW_VERSION = 1;

// A system of the score, where it is: its number, its page and its layout.
export type PlacedSystem = { number: number; page: number; layout: LayoutSystem };

const area = (b: Box) => Math.max(0, b.right - b.left) * Math.max(0, b.bottom - b.top);
const overlap = (a: Box, b: Box) => area({ left: Math.max(a.left, b.left), right: Math.min(a.right, b.right), top: Math.max(a.top, b.top), bottom: Math.min(a.bottom, b.bottom) });

// The systems and stretches boxes on the pages cover (docs/notation.md, "Issues": code works out the stretches under
// the boxes): a box covers a system it overlaps (its tight box, else its crop with margins), and the stretches of it
// it overlaps horizontally.
export function placesOf(boxes: { page: number; box: Box }[], systems: PlacedSystem[]): { system: number; stretches: number[] }[] {
  const places = new Map<number, Set<number>>();
  for (const b of boxes) {
    for (const s of systems) {
      if (s.page !== b.page || (overlap(b.box, s.layout.box) === 0 && overlap(b.box, systemCropBox(s.layout)) === 0)) continue;
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

export const systemsOf = (boxes: { page: number; box: Box }[], systems: PlacedSystem[]) => placesOf(boxes, systems).map((p) => p.system);

// The score as the model reads it (docs/stages/music.md, `review`, "The score as text"): per piece its staves and voices
// with their descriptions, once; per system its staves, groups and stretches as `extract` wrote them, without the
// descriptions and the issues, each stretch with `measure`, the number code gave its measure (-1 for none); in the lens as
// models read it (lensForm.ts).
export function reviewScore(score: Score): unknown {
  return {
    pieces: score.pieces.map((piece) => {
      const measureOf = new Map<string, number>();
      for (const m of piece.measures) for (const p of m.parts) for (const k of p.stretches) measureOf.set(`${p.system}/${k}`, m.n);
      return {
        staves: piece.staves.map((s) => ({ staff: s.staff, description: s.description })),
        voices: piece.voices,
        systems: piece.systems.map((s) => {
          const answer: LensSystem = s.answer;
          return {
            system: s.number,
            page: s.page,
            startRepeat: answer.startRepeat,
            staves: answer.staves.map(({ staff, label, clef, key, time }) => staffForModel({ staff, label, clef, key, time })),
            groups: answer.groups.map(groupForModel),
            stretches: answer.stretches.map(({ voices, ...rest }) =>
              stretchForModel({
                ...rest,
                measure: measureOf.get(`${s.number}/${rest.stretch}`) ?? -1,
                voices: voices.map(({ voice, staff, music }) => ({ voice, staff, music })),
              }),
            ),
            lastMeasureContinues: answer.lastMeasureContinues,
          };
        }),
      };
    }),
  };
}

// The issues as the model reads them: their places as systems and stretches, the choices by who made them, a text with
// no value "" (only `applied` is null, where it isn't known).
export function reviewIssues(issues: StoredIssue[], systems: PlacedSystem[], chooser: (by: string) => string): unknown {
  return issues.map((i) => ({
    id: i.id,
    source: i.source,
    class: i.class,
    places: placesOf(i.boxes, systems),
    location: i.location ?? "",
    question: i.question,
    answers: i.answers,
    choices: i.choices.map((c) => ({ by: chooser(c.by), key: c.key, reason: c.reason ?? "", ...(c.kept ? { kept: true } : {}) })),
    applied: i.applied,
    resolved: i.resolved,
    ...(i.lilypond ? { lilypond: i.lilypond } : {}),
  }));
}

export function reviewWarnings(warnings: StoredWarning[], systems: PlacedSystem[]): unknown {
  return warnings.map((w) => ({ message: w.message, places: placesOf(w.boxes, systems) }));
}

// What a call stores: its system, and its entries as code checked them: choices with the answer's key (a new answer
// with its text and the letter it got), new issues numbered and with their boxes on the pages.
export type ReviewEntry =
  | { choice: { issue: number; key: string; newAnswer: { key: string; text: string } | null; reason: string | null } }
  | { newIssue: StoredIssue };
export type StoredReview = { system: number; entries: ReviewEntry[] };

// The entries as the log gives them to later calls: what changed, short.
export function logEntries(stored: StoredReview): unknown[] {
  return stored.entries.map((e) =>
    "choice" in e
      ? { choice: { issue: e.choice.issue, key: e.choice.key, ...(e.choice.newAnswer ? { newAnswer: e.choice.newAnswer.text } : {}), reason: e.choice.reason ?? "" } }
      : {
          newIssue: {
            id: e.newIssue.id,
            class: e.newIssue.class,
            location: e.newIssue.location ?? "",
            question: e.newIssue.question,
            answers: e.newIssue.answers,
            applied: e.newIssue.applied,
            chosen: e.newIssue.choices[0]?.key ?? "",
            reason: e.newIssue.choices[0]?.reason ?? "",
            ...(e.newIssue.lilypond ? { lilypond: e.newIssue.lilypond } : {}),
          },
        },
  );
}

const nextKey = (answers: { key: string }[]) => String.fromCharCode("a".charCodeAt(0) + answers.length);
const latest = (issue: StoredIssue) => issue.choices[issue.choices.length - 1] ?? null;
const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// The context a call's answer is checked in: its system, the issues as they are now (earlier calls' entries applied),
// the systems for the boxes, and where each image of the request was cut from (on which system).
export type ReviewContext = {
  system: number;
  issues: Map<number, StoredIssue>;
  systems: PlacedSystem[];
  images: Map<string, ImageSource & { system: number }>;
  stageId: string;
};

// Checks an answer (docs/stages/music.md, `review`, "The answer"): what can't be used comes back as a problem, which
// makes the answer unusable, as in `extract`. Otherwise its entries, the new issues numbered from `first` (code
// asks for as many numbers as `newIssues` says, before).
export function checkReview(json: unknown, ctx: ReviewContext, first: number): { entries: ReviewEntry[] } | { problem: string } {
  const answer = reviewFromModel(json) as ReviewAnswer;
  if (typeof answer !== "object" || answer === null || !Array.isArray(answer.entries)) return { problem: "the answer doesn't have the expected form" };
  const entries: ReviewEntry[] = [];
  const chosen = new Set<number>();
  let id = first;
  for (const entry of answer.entries) {
    if ("choice" in entry && entry.choice) {
      const c = entry.choice;
      const issue = ctx.issues.get(c.issue);
      if (!issue) return { problem: `a choice names issue ${c.issue}, which doesn't exist` };
      if (!systemsOf(issue.boxes, ctx.systems).includes(ctx.system)) return { problem: `issue ${c.issue} has no box on system ${ctx.system}: only its own issues can be chosen on` };
      if (issue.resolved) return { problem: `issue ${c.issue} is resolved: a person decided it` };
      if (chosen.has(c.issue)) return { problem: `issue ${c.issue} is chosen on twice` };
      chosen.add(c.issue);
      if ((c.key === null) === (c.newAnswer === null)) return { problem: `the choice on issue ${c.issue} needs exactly one of a key and a new answer` };
      if (c.key !== null) {
        if (!issue.answers.some((a) => a.key === c.key)) return { problem: `issue ${c.issue} has no answer "${c.key}"` };
        if (latest(issue)?.key === c.key) return { problem: `the choice on issue ${c.issue} doesn't change its chosen answer ("${c.key}")` };
        entries.push({ choice: { issue: c.issue, key: c.key, newAnswer: null, reason: c.reason } });
      } else {
        const text = c.newAnswer!.trim();
        if (text === "") return { problem: `the new answer of issue ${c.issue} is empty` };
        if (issue.answers.some((a) => sameText(a.text, text))) return { problem: `the new answer of issue ${c.issue} repeats one of its answers` };
        const added = { key: nextKey(issue.answers), text };
        entries.push({ choice: { issue: c.issue, key: added.key, newAnswer: added, reason: c.reason } });
      }
    } else if ("newIssue" in entry && entry.newIssue) {
      const result = newIssue(entry.newIssue, ctx, id);
      if ("problem" in result) return result;
      id++;
      entries.push({ newIssue: result });
    } else {
      return { problem: "an entry is neither a choice nor a new issue" };
    }
  }
  return { entries };
}

export const newIssueCount = (json: unknown) => ((json as ReviewAnswer)?.entries ?? []).filter((e) => "newIssue" in e && e.newIssue).length;

function newIssue(n: ReviewNewIssueEntry["newIssue"], ctx: ReviewContext, id: number): StoredIssue | { problem: string } {
  const what = `the new issue "${n.question}"`;
  if (n.boxes.length === 0) return { problem: `${what} has no boxes` };
  const boxes: { page: number; box: Box }[] = [];
  const systems = new Set<number>();
  for (const b of n.boxes) {
    const source = ctx.images.get(b.image);
    if (!source) return { problem: `${what} has a box on "${b.image}", which isn't one of the images sent` };
    const { left, right, top, bottom } = b.box;
    if (![left, right, top, bottom].every((v) => v >= 0 && v <= 1) || left >= right || top >= bottom) return { problem: `${what} has a box that isn't a box inside its image` };
    boxes.push({ page: source.page, box: onPage(source.box, b.box) });
    systems.add(source.system);
  }
  if (!systems.has(ctx.system)) return { problem: `${what} has no box on system ${ctx.system}` };
  const list = [...systems].sort((a, b) => a - b);
  if (list.length > 2 || (list.length === 2 && list[1] - list[0] !== 1)) return { problem: `${what} covers more than two consecutive systems` };
  if (n.answers.length < 2) return { problem: `${what} needs at least two answers: what the transcription has and what is right` };
  const keys = n.answers.map((a) => a.key);
  if (keys.some((k, i) => k !== String.fromCharCode(97 + i))) return { problem: `${what}: the answers' keys must be "a", "b", "c", … in order` };
  if (!keys.includes(n.applied) || !keys.includes(n.chosen)) return { problem: `${what}: "applied" and "chosen" must be keys of its answers` };
  if (n.applied === n.chosen) return { problem: `${what}: "applied" and "chosen" are the same answer` };
  // A format issue's list may be empty: what is printed may need no new token, only what the format's rules forbid.
  if (n.class === "format" && !Array.isArray(n.lilypond)) return { problem: `${what} is a format issue without its list of LilyPond tokens` };
  if (n.class !== "format" && n.lilypond !== null) return { problem: `${what} isn't a format issue, so its list of LilyPond tokens must be empty` };
  return {
    id,
    source: "review",
    class: n.class,
    boxes,
    location: n.location,
    question: n.question,
    answers: n.answers,
    choices: [{ by: ctx.stageId, key: n.chosen, reason: n.reason }],
    applied: n.applied,
    resolved: false,
    lilypond: n.class === "format" ? n.lilypond : null,
  };
}

// The issues after a call's entries (a new map; the issues in it are new objects where they changed).
export function applyEntries(issues: Map<number, StoredIssue>, stored: StoredReview, stageId: string): Map<number, StoredIssue> {
  const out = new Map(issues);
  for (const e of stored.entries) {
    if ("choice" in e) {
      const issue = out.get(e.choice.issue);
      if (!issue) continue;
      out.set(issue.id, {
        ...issue,
        answers: e.choice.newAnswer ? [...issue.answers, e.choice.newAnswer] : issue.answers,
        choices: [...issue.choices, { by: stageId, key: e.choice.key, reason: e.choice.reason }],
      });
    } else {
      out.set(e.newIssue.id, e.newIssue);
    }
  }
  return out;
}

// The review's agreements (docs/stages/music.md, `review`, "Agreement counts"): every unresolved issue the review
// made no choice on, whose latest choice is a model's, gets a choice repeating it, marked `kept`. `person`: whether a
// stage is a person's (a human review).
export function withKept(issues: Map<number, StoredIssue>, stageId: string, person: (by: string) => boolean): Map<number, StoredIssue> {
  const out = new Map(issues);
  for (const issue of issues.values()) {
    const last = latest(issue);
    if (issue.resolved || !last || person(last.by) || issue.choices.some((c) => c.by === stageId)) continue;
    out.set(issue.id, { ...issue, choices: [...issue.choices, { by: stageId, key: last.key, reason: null, kept: true }] });
  }
  return out;
}

// The issues as a review leaves them: the reviewed ones, the calls' entries in score order, the agreements.
export function reviewedIssues(issues: StoredIssue[], calls: StoredReview[], stageId: string, person: (by: string) => boolean): Map<number, StoredIssue> {
  let map = new Map(issues.map((i) => [i.id, i]));
  for (const call of [...calls].sort((a, b) => a.system - b.system)) map = applyEntries(map, call, stageId);
  return withKept(map, stageId, person);
}

// The proposed changes of a review: its new issues and its choices.
export const proposedChanges = (calls: StoredReview[]) => calls.reduce((n, c) => n + c.entries.length, 0);

// The card's short result, e.g. "15 proposed changes".
export function reviewNote(changes: number): string {
  return `${changes} proposed change${changes === 1 ? "" : "s"}`;
}

// The stage key (§5.2): the step, its version, the prompt's and the lens's versions, the model, the images' recipe,
// the transcription it reviews (its stored outputs), the pages' images and layouts, the observations and pieces.
export function reviewStageKey(input: {
  promptVersion: number;
  lensVersion: number;
  model: unknown;
  imageRecipe: unknown;
  transcription: string[];
  pages: { pageImageKey: string; layoutSha256: string }[];
  observationsSha256: string;
  piecesSha256: string;
}): Promise<string> {
  return keyOf({ step: "review", version: REVIEW_VERSION, ...input });
}
