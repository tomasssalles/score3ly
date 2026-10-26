// The `extract` step (DESIGN.md §6): what doesn't need the browser or the model. Its runner is runExtract.ts.

import type { Box, CheckedSystem, CodeIssue, LensIssue, LensSystem, StretchPlace, Warning } from "@score3ly/notation";
import { describeMark, type ScoreState } from "@score3ly/notation";
import type { LayoutSystem } from "@score3ly/prompts";
import { keyOf } from "@score3ly/core";
import type { SystemHints } from "./linking.ts";

export const EXTRACT_VERSION = 2;

// The margins code adds to the tight boxes of the layout (§6, `layout`: "margins are code's"), in one place.
// Horizontally a fraction of the page's width, vertically of the system's height (at least a little of the page's).
// Stretch crops get half the neighbouring stretch on each side, so that a slur crossing a bar line shows where it ends.
export const MARGINS = { version: 1, x: 0.01, y: 0.15, minY: 0.005 };

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const round = (v: number) => Math.round(v * 1e6) / 1e6; // canonical numbers for the crop's recipe (§8.6)

function margined(left: number, right: number, box: Box): Box {
  const y = Math.max(MARGINS.y * (box.bottom - box.top), MARGINS.minY);
  return { left: round(clamp(left)), right: round(clamp(right)), top: round(clamp(box.top - y)), bottom: round(clamp(box.bottom + y)) };
}

// The edges of a system's stretches, left to right: its box's edges and its bar lines.
function edges(system: LayoutSystem): number[] {
  return [system.box.left, ...system.barLines, system.box.right];
}

// The system's crop: its box with margins.
export function systemCropBox(system: LayoutSystem): Box {
  return margined(system.box.left - MARGINS.x, system.box.right + MARGINS.x, system.box);
}

// Each stretch's crop: the stretch with half of each neighbouring stretch (the system's margin at its ends).
export function stretchCropBoxes(system: LayoutSystem): Box[] {
  const x = edges(system);
  return x.slice(0, -1).map((left, i) => {
    const right = x[i + 1];
    const before = i === 0 ? MARGINS.x : (left - x[i - 1]) / 2;
    const after = i === x.length - 2 ? MARGINS.x : (x[i + 2] - right) / 2;
    return margined(left - before, right + after, system.box);
  });
}

// A stretch's own box on the page, without margins: what issues raised by code and warnings point at.
export function stretchBox(system: LayoutSystem, stretch: number): Box {
  const x = edges(system);
  const i = Math.min(Math.max(stretch, 1), x.length - 1) - 1;
  return { left: x[i], right: x[i + 1], top: system.box.top, bottom: system.box.bottom };
}

// A box on an image cut from the page by `crop`, as a box on the page (exact: the crop's box is known).
export function onPage(crop: Box, box: Box): Box {
  const w = crop.right - crop.left;
  const h = crop.bottom - crop.top;
  return { left: crop.left + box.left * w, right: crop.left + box.right * w, top: crop.top + box.top * h, bottom: crop.top + box.bottom * h };
}

// A system of the score: its number in the whole score, its page, its output's item ("p3/s2") and its layout.
export type ScoreSystem = { number: number; page: number; item: string; layout: LayoutSystem };

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
    signatures: state.signatures,
    openMarks: state.open.map((m) => ({ ...m, description: describeMark(m) })),
    openEnding: state.ending !== null,
    hints: input.hints,
    observations: input.observations,
  };
}

// An issue as stored (§6, "Issues"): one schema for every source, its boxes on the pages, its id from the project's
// counter, who chose which answer.
export type StoredIssue = {
  id: number;
  source: "extract" | "code";
  class: "reading" | "format";
  boxes: { page: number; box: Box }[];
  location: string | null;
  question: string;
  answers: { key: string; text: string }[];
  choices: { by: string; key: string; reason: string | null }[];
  applied: string | null;
  resolved: boolean;
  lilypond: string[] | null;
};

export type StoredWarning = { message: string; boxes: { page: number; box: Box }[] };

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
  placeBox: (place: StretchPlace) => { page: number; box: Box } | null,
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
    resolved: false,
    lilypond: issue.class === "format" ? issue.lilypond : null,
  });
  const places = (list: StretchPlace[]) => list.flatMap((p) => placeBox(p) ?? []);
  const fromCode = (issue: CodeIssue): StoredIssue => codeIssue(issue, id++, places);
  const warning = (w: Warning): StoredWarning => ({ message: w.message, boxes: places(w.places) });
  return {
    system: system.number,
    page: system.page,
    answer: checked.answer,
    issues: [...checked.answer.issues.map(fromModel), ...checked.codeIssues.map(fromCode)],
    warnings: checked.warnings.map(warning),
  };
}

// What the checks of the whole score found (item '', type `score_checks`): issues raised by code, numbered from
// `first`, and warnings, their boxes on the pages.
export type StoredScoreChecks = { issues: StoredIssue[]; warnings: StoredWarning[] };

export function storedScoreChecks(
  checked: { codeIssues: CodeIssue[]; warnings: Warning[] },
  placeBox: (place: StretchPlace) => { page: number; box: Box } | null,
  first: number,
): StoredScoreChecks {
  let id = first;
  const places = (list: StretchPlace[]) => list.flatMap((p) => placeBox(p) ?? []);
  return {
    issues: checked.codeIssues.map((issue) => codeIssue(issue, id++, places)),
    warnings: checked.warnings.map((w) => ({ message: w.message, boxes: places(w.places) })),
  };
}

function codeIssue(issue: CodeIssue, id: number, places: (list: StretchPlace[]) => { page: number; box: Box }[]): StoredIssue {
  return { id, source: "code", class: "reading", boxes: places(issue.places), location: null, question: issue.question, answers: issue.answers, choices: [], applied: issue.applied, resolved: false, lilypond: null };
}

// The stage key (§5.2): the step, its version, the prompt's and the lens's versions, the model, the images' recipe,
// per page its image's recipe key and its stored layout, and the observations and pieces it reads.
export function extractStageKey(input: {
  promptVersion: number;
  lensVersion: number;
  model: unknown;
  imageRecipe: unknown;
  pages: { pageImageKey: string; layoutSha256: string }[];
  observationsSha256: string;
  piecesSha256: string;
}): Promise<string> {
  return keyOf({ step: "extract", version: EXTRACT_VERSION, ...input });
}

// The card's short result, e.g. "54 systems · 12 issues · 3 warnings".
export function extractNote(systems: number, issues: number, warnings: number): string {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  return [plural(systems, "system"), ...(issues ? [plural(issues, "issue")] : []), ...(warnings ? [plural(warnings, "warning")] : [])].join(" · ");
}
