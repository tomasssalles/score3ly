// The `human_review` step (docs/stages/music.md, `human_review`): a review done by a person, a manual stage after an
// `apply_review`, followed by an `apply_review` of its own that applies its answers. What doesn't need React.
//
// The user answers existing issues (one choice per issue: an existing answer, or one the user writes) and raises issues
// of their own: corrections with boxes on the original and the correction as text (docs/notation.md, "Issues": from the
// user, one answer, chosen by the user, resolved, `applied` null).

import type { ApiStage } from "./api.ts";
import { EXTRACTION_STEPS } from "./engrave.ts";
import type { StoredIssue } from "./extract.ts";
import type { Box } from "@score3ly/notation";
import { applyEntries, systemsOf, type PlacedSystem, type ReviewEntry } from "./review.ts";

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
const sameText = (a: string, b: string) => a.trim() === b.trim();

// Chooses one of an issue's answers: the user's choice on it, replacing any earlier one.
export function chooseAnswer(stored: StoredHumanReview, issue: StoredIssue, key: string): StoredHumanReview {
  return { entries: [...others(stored, issue.id), { choice: { issue: issue.id, key, newAnswer: null, reason: null } }] };
}

// Chooses an answer the user wrote ("none of these, but ..."): a new answer with the next letter, or the existing one
// with exactly the same text (spaces around it aside; case counts). Empty text changes nothing.
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

// Issues and warnings in the score's order (docs/stages/music.md, `human_review`: the arrows go from box to box): by the
// page of their first box, then the system it falls on (the layout's order on the page), then from left to right, then
// as given.
export function scoreOrder<T extends { boxes: { page: number; box: Box }[] }>(items: T[], systemsOn: (page: number) => Box[]): T[] {
  const place = (item: T, index: number) => {
    const first = item.boxes[0];
    if (!first) return [Infinity, Infinity, Infinity, index];
    const systems = systemsOn(first.page);
    const middle = (first.box.top + first.box.bottom) / 2;
    let system = systems.findIndex((b) => middle >= b.top && middle <= b.bottom);
    if (system < 0) system = systems.filter((b) => b.bottom < middle).length - 0.5;
    return [first.page, system, first.box.left, index];
  };
  const placed = items.map((issue, i) => ({ issue, at: place(issue, i) }));
  placed.sort((a, b) => {
    for (let i = 0; i < 4; i++) if (a.at[i] !== b.at[i]) return a.at[i] - b.at[i];
    return 0;
  });
  return placed.map((p) => p.issue);
}

// A clarification, the user's own issue (docs/notation.md, "Issues", "from the user"): its boxes and what the original
// score has there as its one answer,
// chosen by the human review, resolved; nothing is known of what the transcription has (`applied` null), and the
// question may be missing. Without its text yet, it has no answer: it can't be finished like that (`ownIssueProblems`).
export function ownIssue(stageId: string, id: number, boxes: { page: number; box: Box }[], text: string): StoredIssue {
  const written = text.trim();
  return {
    id,
    source: "user",
    class: "reading",
    boxes,
    location: null,
    question: "",
    answers: written ? [{ key: "a", text: written }] : [],
    choices: written ? [{ by: stageId, key: "a", reason: null }] : [],
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

// The systems of the layout, numbered top to bottom, continuing from page to page (docs/overview.md §6).
export function placedSystems(pages: { page: number; systems: { box: Box; barLines: number[] }[] }[]): PlacedSystem[] {
  let n = 0;
  return [...pages]
    .sort((a, b) => a.page - b.page)
    .flatMap((p) => p.systems.map((layout) => ({ number: ++n, page: p.page, layout })));
}

// Maps a position through matching anchors (docs/stages/music.md, `human_review`, linked scrolling: system by system,
// piecewise linear): `from` and `to` are increasing positions that correspond one to one (each system's top and bottom
// on both sides); between two anchors linearly, beyond the ends with the slope of the nearest segment. Null without
// anchors.
export function mapThrough(from: number[], to: number[], v: number): number | null {
  if (from.length === 0 || from.length !== to.length) return null;
  if (from.length === 1) return to[0] + (v - from[0]);
  let i = 0;
  while (i < from.length - 2 && v > from[i + 1]) i++;
  const span = from[i + 1] - from[i];
  const slope = span > 0 ? (to[i + 1] - to[i]) / span : 1;
  return to[i] + (v - from[i]) * slope;
}
