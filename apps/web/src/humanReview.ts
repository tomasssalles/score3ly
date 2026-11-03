// The `human_review` step (docs/stages/music.md, `human_review`): a review done by a person, a manual stage after an
// `apply_review`, followed by an `apply_review` of its own that applies its answers. What doesn't need React.
//
// First step (2026-11-03): the stage and everything around it (adding, dropping, carrying, editing, finishing, the
// `apply_review` after it reading it), with no screen yet to answer issues or add new ones, so it stores no entries.

import type { ApiStage } from "./api.ts";
import { EXTRACTION_STEPS } from "./engrave.ts";
import type { StoredIssue } from "./extract.ts";
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
