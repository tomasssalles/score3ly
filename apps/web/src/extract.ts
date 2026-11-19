// The `extract` step (docs/stages/music.md): what doesn't need the browser or the model. Its runner is runExtract.ts.

import { llmStageKey, type LlmStageConfig } from "./llmStageKey.ts";
import type { CheckedSystem, CodeIssue, LensIssue, LensSystem, ScoreSystemInput, Warning } from "@score3ly/notation";
import { describeMark, type ScoreState } from "@score3ly/notation";
import { onPage, type Box, type LayoutSystem } from "@score3ly/core";
import { codeIssue, storedWarning, type PlaceBox, type StoredIssue, type StoredWarning } from "./issues.ts";
import type { SystemHints } from "./linking.ts";
import { count } from "./format.ts";

export const EXTRACT_VERSION = 3; // 3: answers checked against their schema first, a malformed one refused (code review, batch 18)

// A system of the score: its number in the whole score, its page, its output's item ("p3/s2") and its layout.
export type ScoreSystem = { number: number; page: number; item: string; layout: LayoutSystem };

// A system as notation builds the score from it (`buildScore`): its number, page, box and bar lines, and its answer. A
// system whose layout is missing has no box and no bar lines.
export function scoreInput(system: { number: number; page: number; layout?: LayoutSystem }, answer: LensSystem): ScoreSystemInput {
  return { number: system.number, page: system.page, box: system.layout?.box ?? null, barLines: system.layout?.barLines ?? [], answer };
}

// Whether systems begin or end a piece (`pieces`: the first system of every piece, starting with 1).
export function pieceBounds(pieces: number[], system: number, last: number): { first: boolean; last: boolean } {
  return { first: pieces.includes(system), last: system === last || pieces.includes(system + 1) };
}

// The request, in the lens's field names (§6, "The lens": "The request is JSON in the same field names as the
// answer"), with what the previous system left and the hints. The whole observations document comes too.
export function extractRequest(input: {
  system: ScoreSystem;
  stretches: number;
  firstOfPiece: boolean;
  lastOfPiece: boolean;
  state: ScoreState;
  hints: SystemHints;
  observations: unknown;
}): unknown {
  const { system, state } = input;
  return {
    system: system.number,
    page: system.page,
    stretches: input.stretches,
    firstOfPiece: input.firstOfPiece,
    lastOfPiece: input.lastOfPiece,
    previousMeasureContinues: state.measureContinues,
    staves: state.staves,
    voices: state.voices,
    signatures: state.signatures.map((x) => ({ ...x, time: x.time ?? "" })), // as the lens's texts in the answer: "" for none
    openMarks: state.open.map((m) => ({ ...m, description: describeMark(m) })),
    openEnding: state.ending !== null,
    hints: input.hints,
    observations: input.observations,
  };
}

// What is stored per system (item p<n>/s<k>, type `extraction`): the answer as the model gave it (its issues' boxes
// on its images, as it sent them), and what code made of it: the issues with their ids and boxes on the pages, and the
// warnings.
export type StoredExtraction = { system: number; page: number; answer: LensSystem; issues: StoredIssue[]; warnings: StoredWarning[] };

// Where an image of a request was cut from: its page and box (for the model's issue boxes).
export type ImageSource = { page: number; box: Box };

// The stored form of a checked system: the model's issues on the pages, then code's, numbered from `first`.
export function storedExtraction(
  system: ScoreSystem,
  checked: CheckedSystem,
  images: Map<string, ImageSource>,
  placeBox: PlaceBox,
  first: number,
): StoredExtraction {
  let id = first;
  const fromModel = (issue: LensIssue): StoredIssue => ({
    id: id++,
    source: "extract",
    class: issue.class,
    boxes: issue.boxes.map((b) => {
      const source = images.get(b.image)!;
      return { page: source.page, box: onPage(source.box, b.box) };
    }),
    location: issue.location,
    question: issue.question,
    answers: issue.answers,
    choices: [{ by: "extract", key: issue.applied, reason: null }],
    applied: issue.applied,
    applications: [{ by: "extract", key: issue.applied }],
    resolved: false,
    lilypond: issue.class === "format" ? issue.lilypond : null,
  });
  const fromCode = (issue: CodeIssue): StoredIssue => codeIssue(issue, id++, placeBox, "extract");
  return {
    system: system.number,
    page: system.page,
    answer: checked.answer,
    issues: [...checked.answer.issues.map(fromModel), ...checked.codeIssues.map(fromCode)],
    warnings: checked.warnings.map((w) => storedWarning(w, placeBox)),
  };
}

// What the checks of the whole score found (item '', type `score_checks`): issues raised by code, numbered from
// `first`, and warnings, their boxes on the pages.
export type StoredScoreChecks = { issues: StoredIssue[]; warnings: StoredWarning[] };

export function storedScoreChecks(
  checked: { codeIssues: CodeIssue[]; warnings: Warning[] },
  placeBox: PlaceBox,
  first: number,
): StoredScoreChecks {
  let id = first;
  return {
    issues: checked.codeIssues.map((issue) => codeIssue(issue, id++, placeBox, "extract")),
    warnings: checked.warnings.map((w) => storedWarning(w, placeBox)),
  };
}

// The stage key (§5.2, llmStageKey.ts): the step, its version, the prompt's and the lens's versions, the model, the images' recipe,
// per page its image's recipe key and its stored layout, and the observations and pieces it reads.
export function extractStageKey(input: {
  config: LlmStageConfig;
  promptVersion: number;
  lensVersion: number;
  model: unknown;
  imageRecipe: unknown;
  pages: { pageImageKey: string; layoutSha256: string }[];
  observationsSha256: string;
  piecesSha256: string;
}): Promise<string> {
  return llmStageKey("extract", EXTRACT_VERSION, input);
}

// The card's short result, e.g. "54 systems · 12 issues · 3 warnings".
export function extractNote(systems: number, issues: number, warnings: number): string {
  return [count(systems, "system"), ...(issues ? [count(issues, "issue")] : []), ...(warnings ? [count(warnings, "warning")] : [])].join(" · ");
}
