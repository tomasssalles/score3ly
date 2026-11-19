// The `human_review` step (docs/stages/music.md, `human_review`): a review done by a person, a manual stage after an
// `apply_review`, followed by an `apply_review` of its own that applies its answers. What doesn't need React.
//
// The user answers existing issues (one choice per issue: an existing answer, or one the user writes) and raises issues
// of their own: corrections with boxes on the original and the correction as text (docs/notation.md, "Issues": from the
// user, one answer, chosen by the user, resolved, `applied` null).

import type { ApiStage } from "./api.ts";
import { PRODUCERS } from "./stageInputs.ts";
import type { Box } from "@score3ly/core";
import { nextAnswerKey } from "@score3ly/notation";
import { sameAnswer, systemsOf, type PlacedSystem, type StoredIssue } from "./issues.ts";
import type { ReviewEntry } from "./review.ts";
import { count } from "./format.ts";

export const HUMAN_REVIEW_VERSION = 1;

// What a human review stores (item '', type `human_review`): its entries, as a review's call stores them: the user's
// choices on existing issues (a written answer as a new answer), and the user's own issues, numbered by code.
export type StoredHumanReview = { entries: ReviewEntry[] };

// The card's short result, e.g. "3 changes".
export function humanReviewNote(stored: StoredHumanReview): string {
  const n = stored.entries.length;
  return count(n, "change");
}

// What a human review reads, added after an `apply_review` (docs/database.md): the transcription it reviews.
export function humanReviewStart(after: ApiStage): { stepVersion: number; pageCount: number | null; inputIds: string[] } {
  const inputs = (PRODUCERS.extraction as readonly string[]).includes(after.step)
    ? after.outputs.filter((o) => (o.type === "extraction" || (o.item === "" && o.type === "score_checks")) && o.contentSha256)
    : [];
  return { stepVersion: HUMAN_REVIEW_VERSION, pageCount: after.pageCount, inputIds: inputs.map((o) => o.id) };
}

// The user's choice on an issue, if any (the review stores one per issue).
export function userChoice(stored: StoredHumanReview, issue: number): { key: string; newAnswer: { key: string; text: string } | null } | null {
  for (const e of stored.entries) if ("choice" in e && e.choice.issue === issue) return { key: e.choice.key, newAnswer: e.choice.newAnswer };
  return null;
}

const others = (stored: StoredHumanReview, issue: number) => stored.entries.filter((e) => !("choice" in e && e.choice.issue === issue));

// Chooses one of an issue's answers: the user's choice on it, replacing any earlier one.
export function chooseAnswer(stored: StoredHumanReview, issue: StoredIssue, key: string): StoredHumanReview {
  return { entries: [...others(stored, issue.id), { choice: { issue: issue.id, key, newAnswer: null, reason: null } }] };
}

// The key of the issue's answer a written text is (`sameAnswer`: spaces around it aside, case counts), or null.
export function writtenAnswerKey(issue: StoredIssue, text: string): string | null {
  return issue.answers.find((a) => sameAnswer(a.text, text))?.key ?? null;
}

// Chooses an answer the user wrote ("none of these, but ..."): a new answer with the next letter, or the existing one
// with the same text (`writtenAnswerKey`). Empty text changes nothing, and so does a new answer to an issue that has
// as many answers as there are letters.
export function writeAnswer(stored: StoredHumanReview, issue: StoredIssue, text: string): StoredHumanReview {
  const written = text.trim();
  if (written === "") return stored;
  const existing = writtenAnswerKey(issue, written);
  if (existing !== null) return chooseAnswer(stored, issue, existing);
  const key = nextAnswerKey(issue.answers);
  if (key === null) return stored;
  return { entries: [...others(stored, issue.id), { choice: { issue: issue.id, key, newAnswer: { key, text: written }, reason: null } }] };
}

// Takes the user's choice on an issue back.
export function clearChoice(stored: StoredHumanReview, issue: number): StoredHumanReview {
  return { entries: others(stored, issue) };
}

// A clarification, the user's own issue (docs/notation.md, "Issues", "from the user"): its boxes and what the original
// score has there as its one answer,
// chosen by the human review, resolved; nothing is known of what the transcription has (`applied` null), and the
// question may be missing. Without its text yet, it has no answer: it can't be finished like that (`ownIssueProblems`).
export function ownIssue(id: number, boxes: { page: number; box: Box }[], text: string): StoredIssue {
  const written = text.trim();
  return {
    id,
    source: "user",
    class: "reading",
    boxes,
    location: null,
    question: "",
    answers: written ? [{ key: "a", text: written }] : [],
    choices: written ? [{ by: "human_review", key: "a", reason: null }] : [],
    applied: null,
    resolved: true,
    lilypond: null,
  };
}

// The user's own issues, in the order they were raised.
export function ownIssues(stored: StoredHumanReview): StoredIssue[] {
  return stored.entries.flatMap((e) => ("newIssue" in e ? [e.newIssue] : []));
}

// An own issue added, or replaced where it is (same id).
export function putOwnIssue(stored: StoredHumanReview, issue: StoredIssue): StoredHumanReview {
  const at = stored.entries.findIndex((e) => "newIssue" in e && e.newIssue.id === issue.id);
  if (at < 0) return { entries: [...stored.entries, { newIssue: issue }] };
  return { entries: stored.entries.map((e, i) => (i === at ? { newIssue: issue } : e)) };
}

export function removeOwnIssue(stored: StoredHumanReview, id: number): StoredHumanReview {
  return { entries: stored.entries.filter((e) => !("newIssue" in e && e.newIssue.id === id)) };
}

// The messages about a clarification, in its panel and from Finish.
export const NO_TEXT = "The clarification text cannot be empty.";
export const NO_BOX = "A clarification needs at least one box.";
export const OFF_SYSTEM = "Boxes must be on top of systems.";

// What is wrong with a clarification's boxes (docs/notation.md, "Issues": on at most 2 systems, neighbours), if anything:
// the problem, and which boxes break the rules (by index). Not enforced while the user draws: shown, and checked when
// the stage is finished (`ownIssueProblems`).
export function boxProblems(boxes: { page: number; box: Box }[], systems: PlacedSystem[]): { problem: string | null; bad: number[] } {
  if (boxes.length === 0) return { problem: NO_BOX, bad: [] };
  const off = boxes.flatMap((b, k) => (systemsOf([b], systems).length === 0 ? [k] : []));
  if (off.length > 0) return { problem: OFF_SYSTEM, bad: off };
  const covered = systemsOf(boxes, systems);
  if (covered.length > 2 || (covered.length === 2 && covered[1] - covered[0] !== 1)) {
    return {
      problem: `The boxes are on systems ${covered.join(", ")}. They can be on one system, or on two neighbouring systems.`,
      bad: boxes.map((_, k) => k),
    };
  }
  return { problem: null, bad: [] };
}

// What keeps a human review from being finished: each clarification without its text, or whose boxes break the rules.
export function ownIssueProblems(stored: StoredHumanReview, systems: PlacedSystem[]): { id: number; problem: string }[] {
  return ownIssues(stored).flatMap((issue) => {
    const problems = [
      ...(issue.answers.length === 0 ? [NO_TEXT] : []),
      ...[boxProblems(issue.boxes, systems).problem ?? []].flat(),
    ];
    return problems.length > 0 ? [{ id: issue.id, problem: problems.join(" ") }] : [];
  });
}

