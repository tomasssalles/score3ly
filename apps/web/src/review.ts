// The `review` step (docs/stages/music.md): what doesn't need the browser or the model. Its runner is runReview.ts.
//
// A review writes issues only: per call (item p<n>/s<k>, type `review`) the entries of its answer, choices on the
// issues of its system and new issues, as code checked and numbered them. The issues as the review leaves them are a
// view: the issues of the transcription it reviewed, with its entries applied in the order of the calls, and its
// agreements ("kept") added for the issues it left as they were.

import { llmStageKey, type LlmStageConfig } from "./llmStageKey.ts";
import { answerKeysProblem, nextAnswerKey, systemsRuleProblem, type Score } from "@score3ly/notation";
import { issueForModel, reviewFromModel, stretchMeasures, systemForModel, type ReviewAnswer, type ReviewNewIssueEntry } from "@score3ly/prompts";
import { boxProblem, onPage, type Box } from "@score3ly/core";
import type { ImageSource } from "./extract.ts";
import { latest, placesOf, sameAnswer, systemsOf, type PlacedSystem, type StoredIssue, type StoredWarning } from "./issues.ts";
import { count } from "./format.ts";

// 2: answers checked against their schema first, a malformed one refused (code review, batch 18). 3: a box is on the
// systems whose boxes it overlaps, their crops only as the fallback; case counts in a new answer (batch 29).
export const REVIEW_VERSION = 3;

// The score as the model reads it (docs/stages/music.md, `review`, "The score as text"): per piece its staves and voices
// with their descriptions, once; per system its staves, groups and stretches as `extract` wrote them, without the
// descriptions and the issues, each stretch with `measure`, the number code gave its measure (-1 for none); in the lens as
// models read it (lensForm.ts).
export function reviewScore(score: Score): unknown {
  const measureOf = stretchMeasures(score);
  return {
    pieces: score.pieces.map((piece) => ({
      staves: piece.staves.map((s) => ({ staff: s.staff, description: s.description })),
      voices: piece.voices,
      systems: piece.systems.map((s) => systemForModel(s.answer, { system: s.number, page: s.page }, measureOf, false)),
    })),
  };
}

// Who made a choice, as a model reads it: the kind of stage, never which one (a request must stay the same when an
// earlier stage is dropped or added, so that the cache still finds it; docs/stages/music.md, "Who chose").
const MODEL_NAMES: Record<string, string> = { extract: "Extract", review: "a review", apply_review: "Apply review", human_review: "a person" };
export const modelName = (by: string) => MODEL_NAMES[by] ?? by;

// The issues as the model reads them: their places as systems and stretches, the choices by who made them, a text with
// no value "" (only `applied` is null, where it isn't known).
export function reviewIssues(issues: StoredIssue[], systems: PlacedSystem[]): unknown {
  return issues.map((i) =>
    issueForModel({
      id: i.id,
      source: i.source,
      class: i.class,
      places: placesOf(i.boxes, systems),
      location: i.location,
      question: i.question,
      answers: i.answers,
      choices: i.choices.map((c) => ({ by: modelName(c.by), key: c.key, reason: c.reason ?? "", ...(c.kept ? { kept: true } : {}) })),
      applied: i.applied,
      resolved: i.resolved,
      lilypond: i.lilypond,
    }),
  );
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
          newIssue: issueForModel({
            id: e.newIssue.id,
            class: e.newIssue.class,
            location: e.newIssue.location,
            question: e.newIssue.question,
            answers: e.newIssue.answers,
            applied: e.newIssue.applied,
            chosen: e.newIssue.choices[0]?.key ?? "",
            reason: e.newIssue.choices[0]?.reason ?? "",
            lilypond: e.newIssue.lilypond,
          }),
        },
  );
}


// The context a call's answer is checked in: its system, the issues as they are now (earlier calls' entries applied),
// the systems for the boxes, and where each image of the request was cut from (on which system).
export type ReviewContext = {
  system: number;
  issues: Map<number, StoredIssue>;
  systems: PlacedSystem[];
  images: Map<string, ImageSource & { system: number }>;
};

// Checks an answer (docs/stages/music.md, `review`, "The answer"): what can't be used comes back as a problem, which
// makes the answer unusable, as in `extract`. Otherwise its entries, the new issues numbered from `first` (code
// asks for as many numbers as `newIssues` says, before).
export function checkReview(json: unknown, ctx: ReviewContext, first: number): { entries: ReviewEntry[] } | { problem: string } {
  return malformedRefused(() => checkEntries(json, ctx, first));
}

// A check that reads a field of something that isn't an object, or a list that isn't one, found a malformed answer:
// refused like any other unusable one, not a crash. (`ask` checks an answer's form against its schema first.)
export function malformedRefused<T>(check: () => T | { problem: string }): T | { problem: string } {
  try {
    return check();
  } catch (err) {
    if (err instanceof TypeError) return { problem: `the answer doesn't have the expected form: ${err.message}` };
    throw err;
  }
}

function checkEntries(json: unknown, ctx: ReviewContext, first: number): { entries: ReviewEntry[] } | { problem: string } {
  const answer = reviewFromModel(json) as ReviewAnswer;
  if (typeof answer !== "object" || answer === null || !Array.isArray(answer.entries)) return { problem: "the answer doesn't have the expected form" };
  const entries: ReviewEntry[] = [];
  const chosen = new Set<number>();
  let id = first;
  for (const entry of answer.entries) {
    if (typeof entry !== "object" || entry === null) return { problem: "an entry is neither a choice nor a new issue" };
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
        if (issue.answers.some((a) => sameAnswer(a.text, text))) return { problem: `the new answer of issue ${c.issue} repeats one of its answers` };
        const key = nextAnswerKey(issue.answers);
        if (key === null) return { problem: `issue ${c.issue} has as many answers as there are letters: no new one can be added` };
        const added = { key, text };
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

function newIssue(n: ReviewNewIssueEntry["newIssue"], ctx: ReviewContext, id: number): StoredIssue | { problem: string } {
  const what = `the new issue "${n.question}"`;
  if (n.boxes.length === 0) return { problem: `${what} has no boxes` };
  const boxes: { page: number; box: Box }[] = [];
  const systems = new Set<number>();
  for (const b of n.boxes) {
    const source = ctx.images.get(b.image);
    if (!source) return { problem: `${what} has a box on "${b.image}", which isn't one of the images sent` };
    if (boxProblem(b.box)) return { problem: `${what} has a box that isn't a box inside its image` };
    boxes.push({ page: source.page, box: onPage(source.box, b.box) });
    systems.add(source.system);
  }
  if (!systems.has(ctx.system)) return { problem: `${what} has no box on system ${ctx.system}` };
  const systemsProblem = systemsRuleProblem([...systems]);
  if (systemsProblem) return { problem: `${what} ${systemsProblem}` };
  if (n.answers.length < 2) return { problem: `${what} needs at least two answers: what the transcription has and what is right` };
  const keys = n.answers.map((a) => a.key);
  const keysProblem = answerKeysProblem(keys);
  if (keysProblem) return { problem: `${what}: ${keysProblem}` };
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
    choices: [{ by: "review", key: n.chosen, reason: n.reason }],
    applied: n.applied,
    resolved: false,
    lilypond: n.class === "format" ? n.lilypond : null,
  };
}

// The proposed changes of a review: its new issues and its choices.
export const proposedChanges = (calls: StoredReview[]) => calls.reduce((n, c) => n + c.entries.length, 0);

// The card's short result, e.g. "15 proposed changes".
export function reviewNote(changes: number): string {
  return count(changes, "proposed change");
}

// The stage key (§5.2, llmStageKey.ts): the step, its version, the prompt's and the lens's versions, the model, the images' recipe,
// the transcription it reviews (its stored outputs), the pages' images and layouts, the observations and pieces.
export function reviewStageKey(input: {
  config: LlmStageConfig;
  promptVersion: number;
  lensVersion: number;
  model: unknown;
  imageRecipe: unknown;
  transcription: string[];
  pages: { pageImageKey: string; layoutSha256: string }[];
  observationsSha256: string;
  piecesSha256: string;
}): Promise<string> {
  return llmStageKey("review", REVIEW_VERSION, input);
}
