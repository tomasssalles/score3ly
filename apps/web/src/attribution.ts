// Who chose and who applied each answer of an issue, as the app names them now ("Review 2", "Human review 1";
// docs/stages/music.md, "Who chose"). What is stored says only the step (`by`: "extract", "review", "apply_review",
// "human_review"), never a stage's id or turn: a stage that gives the same answers again then stores the same content,
// so its output is found in the cache and what comes after it is kept (§5.2), whatever its turn is now. The turns come
// from the pipeline as it is now: an entry of an issue's `choices` or `applications` belongs to the first stage, in the
// pipeline's order, after which the issue has it. Choices and applications are only ever appended, so walking the
// stages that choose or apply, in order, and giving each the entries it added, names every entry.
//
// The walk reads the stages' stored outputs; what it found is kept on the device, by a key of the chain of stages up
// to there (as images are, by their recipes): a stage dropped or added before changes the key, so a stale one is never
// used.

import { keyOf } from "@score3ly/core";
import type { StoredExtraction, StoredScoreChecks } from "./extract.ts";
import type { StoredReview } from "./review.ts";
import type { StoredHumanReview } from "./humanReview.ts";
import { issuesAfter as foldIssues, type StoredIssue } from "./issues.ts";

// A stage as an issue's card names it, and its step; `person`: a human review.
export type Who = { label: string; person: boolean; step: string };

// Who added each entry of an issue's `choices` and `applications`, by index.
export type IssueWho = { choices: Who[]; applications: Who[] };
export type Attribution = Record<number, IssueWho>;

export const EXTRACT: Who = { label: "Extract", person: false, step: "extract" };

// The stages that choose or apply, in the pipeline's order, with what they stored: the transcriptions (`extract`'s,
// `apply_review`'s: every system's extraction and the checks of the whole score), a review's calls (its agreements
// only once it is done), a human review's entries.
export type ChainStage = { who: Who } & (
  | { step: "extract" | "apply_review"; systems: string[]; checks: string | null }
  | { step: "review"; calls: string[]; done: boolean }
  | { step: "human_review"; sha256: string | null }
);

const ATTRIBUTION_VERSION = 1;

// The stage's label: its step's title, numbered among the pipeline's stages of its step before it ("Review 2").
export function whoOf(step: string, title: string, turn: number): Who {
  return step === "extract" ? EXTRACT : { label: `${title} ${turn}`, person: step === "human_review", step };
}

// An entry given to a stage of another step than the one it was stored with: only a bug can make one (the walk giving
// entries to the wrong stage, a stage storing another step's name). The label stays the stage's it was found at.
export type Mismatch = { issue: number; list: "choices" | "applications"; index: number; stored: string; stage: string };

export const reportMismatch = (m: Mismatch) =>
  console.error(`Attribution: entry ${m.index} of issue ${m.issue}'s ${m.list} is stored as "${m.stored}" but was given to ${m.stage}.`);

// Gives `who` the entries the issues have beyond those already named; Extract's own stay Extract's. Each entry's stored
// step must be the stage's: a mismatch is reported (`report`).
export function extend(attribution: Attribution, issues: Iterable<StoredIssue>, who: Who, report: (m: Mismatch) => void = reportMismatch): Attribution {
  const out = { ...attribution };
  for (const issue of issues) {
    const before = attribution[issue.id] ?? { choices: [], applications: [] };
    const named = (list: Mismatch["list"], entries: { by: string }[], known: Who[]) => [
      ...known,
      ...entries.slice(known.length).map((e, i) => {
        const by = e.by === "extract" ? EXTRACT : who;
        if (e.by !== by.step) report({ issue: issue.id, list, index: known.length + i, stored: e.by, stage: by.label });
        return by;
      }),
    ];
    out[issue.id] = { choices: named("choices", issue.choices, before.choices), applications: named("applications", issue.applications ?? [], before.applications) };
  }
  return out;
}

export type Sources = {
  json: (sha256: string) => Promise<unknown>; // stored content
  cached?: (key: string) => Promise<Attribution | null>; // the device's cache
  cache?: (key: string, attribution: Attribution) => Promise<void>;
  report?: (m: Mismatch) => void; // a stored step that doesn't match its stage's (`extend`)
};

// The issues after a stage, from those after the stage before it: its stored content loaded, then issues.ts' fold.
async function issuesAfter(stage: ChainStage, before: Map<number, StoredIssue>, sources: Sources): Promise<Map<number, StoredIssue>> {
  switch (stage.step) {
    case "extract":
    case "apply_review": {
      const systems = await Promise.all(stage.systems.map(async (s) => (await sources.json(s)) as StoredExtraction));
      const checks = stage.checks ? ((await sources.json(stage.checks)) as StoredScoreChecks) : null;
      return foldIssues(before, { step: stage.step, issues: [...systems.flatMap((s) => s.issues), ...(checks?.issues ?? [])] });
    }
    case "review": {
      const calls = await Promise.all(stage.calls.map(async (c) => (await sources.json(c)) as StoredReview));
      return foldIssues(before, { step: "review", calls, done: stage.done });
    }
    case "human_review":
      return foldIssues(before, { step: "human_review", stored: stage.sha256 ? ((await sources.json(stage.sha256)) as StoredHumanReview) : null });
  }
}

// The chain's attribution, and the issues after its last stage. Each prefix's attribution is looked up in the cache
// first; where the walk starts again from a cached one, the issues it needs are made again from the latest
// transcription before it.
export async function attributionOf(chain: ChainStage[], sources: Sources): Promise<{ attribution: Attribution; issues: Map<number, StoredIssue> }> {
  const keys: string[] = [];
  for (const stage of chain) keys.push(await keyOf({ v: ATTRIBUTION_VERSION, before: keys.at(-1) ?? null, stage }));
  let from = 0;
  let attribution: Attribution = {};
  for (let i = chain.length - 1; i >= 0 && sources.cached; i--) {
    const found = await sources.cached(keys[i]);
    if (found) {
      attribution = found;
      from = i + 1;
      break;
    }
  }
  // The issues where the walk starts: from the latest transcription at or before it, without naming anything again.
  let issues = new Map<number, StoredIssue>();
  if (from > 0) {
    let start = from - 1;
    while (start > 0 && chain[start].step !== "extract" && chain[start].step !== "apply_review") start--;
    for (let i = start; i < from; i++) issues = await issuesAfter(chain[i], issues, sources);
  }
  for (let i = from; i < chain.length; i++) {
    issues = await issuesAfter(chain[i], issues, sources);
    attribution = extend(attribution, issues.values(), chain[i].who, sources.report);
    await sources.cache?.(keys[i], attribution);
  }
  return { attribution, issues };
}

