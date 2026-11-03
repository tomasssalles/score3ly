// The `human_review` step (docs/stages/music.md, `human_review`): a review done by a person, a manual stage after an
// `apply_review`, followed by an `apply_review` of its own that applies its answers. What doesn't need React.
//
// Built in steps (docs/tasks.md): the stage and everything around it, and answering the existing issues (one choice per
// issue: an existing answer, or one the user writes). Adding issues of one's own comes later.

import type { ApiStage } from "./api.ts";
import { EXTRACTION_STEPS } from "./engrave.ts";
import type { StoredIssue } from "./extract.ts";
import type { Box } from "@score3ly/notation";
import { applyEntries, type ReviewEntry } from "./review.ts";

export const HUMAN_REVIEW_VERSION = 1;

// What a human review stores (item '', type `human_review`): its entries, as a review's call stores them: the user's
// choices on existing issues (a written answer as a new answer), and the user's own issues, numbered by code.
export type StoredHumanReview = { entries: ReviewEntry[] };

// The issues after a human review: its entries applied, and every issue it chose on or raised resolved (a person
// decided it, docs/notation.md, "Issues").
export function humanReviewedIssues(issues: Map<number, StoredIssue>, stored: StoredHumanReview, stageId: string): Map<number, StoredIssue> {
  const out = applyEntries(issues, { system: 0, entries: stored.entries }, stageId);
  for (const e of stored.entries) {
    const issue = out.get("choice" in e ? e.choice.issue : e.newIssue.id);
    if (issue) out.set(issue.id, { ...issue, resolved: true });
  }
  return out;
}

// The card's short result, e.g. "3 changes".
export function humanReviewNote(stored: StoredHumanReview): string {
  const n = stored.entries.length;
  return `${n} change${n === 1 ? "" : "s"}`;
}

// What a human review reads, added after an `apply_review` (docs/database.md): the transcription it reviews.
export function humanReviewStart(after: ApiStage): { stepVersion: number; pageCount: number | null; inputIds: string[] } {
  const inputs = EXTRACTION_STEPS.includes(after.step)
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
const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Chooses one of an issue's answers: the user's choice on it, replacing any earlier one.
export function chooseAnswer(stored: StoredHumanReview, issue: StoredIssue, key: string): StoredHumanReview {
  return { entries: [...others(stored, issue.id), { choice: { issue: issue.id, key, newAnswer: null, reason: null } }] };
}

// Chooses an answer the user wrote ("none of these, but ..."): a new answer with the next letter, or the existing one
// with the same text. Empty text changes nothing.
export function writeAnswer(stored: StoredHumanReview, issue: StoredIssue, text: string): StoredHumanReview {
  const written = text.trim();
  if (written === "") return stored;
  const existing = issue.answers.find((a) => sameText(a.text, written));
  if (existing) return chooseAnswer(stored, issue, existing.key);
  const key = String.fromCharCode("a".charCodeAt(0) + issue.answers.length);
  return { entries: [...others(stored, issue.id), { choice: { issue: issue.id, key, newAnswer: { key, text: written }, reason: null } }] };
}

// Takes the user's choice on an issue back.
export function clearChoice(stored: StoredHumanReview, issue: number): StoredHumanReview {
  return { entries: others(stored, issue) };
}

// The issues in the score's order (docs/stages/music.md, `human_review`: the arrows go from box to box): by the page of
// their first box, then the system it falls on (the layout's order on the page), then from left to right.
export function scoreOrder(issues: StoredIssue[], systemsOf: (page: number) => Box[]): StoredIssue[] {
  const place = (issue: StoredIssue) => {
    const first = issue.boxes[0];
    if (!first) return [Infinity, Infinity, Infinity, issue.id];
    const systems = systemsOf(first.page);
    const middle = (first.box.top + first.box.bottom) / 2;
    let system = systems.findIndex((b) => middle >= b.top && middle <= b.bottom);
    if (system < 0) system = systems.filter((b) => b.bottom < middle).length - 0.5;
    return [first.page, system, first.box.left, issue.id];
  };
  const placed = issues.map((issue) => ({ issue, at: place(issue) }));
  placed.sort((a, b) => {
    for (let i = 0; i < 4; i++) if (a.at[i] !== b.at[i]) return a.at[i] - b.at[i];
    return 0;
  });
  return placed.map((p) => p.issue);
}
