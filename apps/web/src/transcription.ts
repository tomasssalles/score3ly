// The Transcription (DESIGN.md §6, "The Transcription"): what its view needs that isn't React. The issues and warnings
// of `extract` (each system's and those of the checks of the whole score), with their boxes on the pages: each box is
// drawn on every crop it falls on, and each note's text goes below one system, the first its boxes fall on.

import { buildScore, type Box, type Score } from "@score3ly/notation";
import type { LayoutSystem } from "@score3ly/prompts";
import { systemCropBox, type StoredExtraction, type StoredIssue, type StoredWarning } from "./extract.ts";

export type ShownSystem = { extraction: StoredExtraction; layout: LayoutSystem; crop: Box };

// An issue or a warning, with a key unique in the view (the element its box scrolls to).
export type Note = { key: string; boxes: { page: number; box: Box }[] } & ({ kind: "issue"; issue: StoredIssue } | { kind: "warning"; warning: StoredWarning });

export function notesOf(systems: ShownSystem[], checks: { issues: StoredIssue[]; warnings: StoredWarning[] } | null): Note[] {
  const issues = [...systems.flatMap((s) => s.extraction.issues), ...(checks?.issues ?? [])];
  const warnings = [
    ...systems.flatMap((s) => s.extraction.warnings.map((w, i) => ({ w, key: `warning-${s.extraction.system}-${i}` }))),
    ...(checks?.warnings ?? []).map((w, i) => ({ w, key: `warning-score-${i}` })),
  ];
  return [
    ...issues.map((issue): Note => ({ key: `issue-${issue.id}`, boxes: issue.boxes, kind: "issue", issue })),
    ...warnings.map(({ w, key }): Note => ({ key, boxes: w.boxes, kind: "warning", warning: w })),
  ];
}

const area = (b: Box) => Math.max(0, b.right - b.left) * Math.max(0, b.bottom - b.top);

function overlap(a: Box, b: Box): number {
  return area({ left: Math.max(a.left, b.left), right: Math.min(a.right, b.right), top: Math.max(a.top, b.top), bottom: Math.min(a.bottom, b.bottom) });
}

// The system a note's text goes below: the first, in the score's order, that its first box falls on (most of it,
// where crops overlap). Null when it falls on none.
export function homeOf(note: Note, systems: ShownSystem[]): number | null {
  const first = note.boxes[0];
  if (!first) return null;
  let best: { system: number; share: number } | null = null;
  for (const s of systems) {
    if (s.extraction.page !== first.page) continue;
    const share = overlap(first.box, s.layout.box) || overlap(first.box, s.crop) / 1e3;
    if (share > 0 && (!best || share > best.share)) best = { system: s.extraction.system, share };
  }
  return best?.system ?? null;
}

// The boxes that fall on a crop, as fractions of the crop (cut at its edges).
export function boxesOnCrop(notes: Note[], page: number, crop: Box): { note: Note; box: Box }[] {
  const w = crop.right - crop.left;
  const h = crop.bottom - crop.top;
  return notes.flatMap((note) =>
    note.boxes
      .filter((b) => b.page === page && overlap(b.box, crop) > 0)
      .map((b) => ({
        note,
        box: {
          left: Math.max(0, (b.box.left - crop.left) / w),
          right: Math.min(1, (b.box.right - crop.left) / w),
          top: Math.max(0, (b.box.top - crop.top) / h),
          bottom: Math.min(1, (b.box.bottom - crop.top) / h),
        },
      })),
  );
}

export function shownSystem(extraction: StoredExtraction, layout: LayoutSystem): ShownSystem {
  return { extraction, layout, crop: systemCropBox(layout) };
}

// The score as code builds it from the stored extractions (for the renderings), or the reason it can't be.
export function scoreOf(systems: ShownSystem[], pieces: number[]): Score | { problem: string } {
  try {
    return buildScore(
      systems.map((s) => ({ number: s.extraction.system, page: s.extraction.page, box: s.layout.box, barLines: s.layout.barLines, answer: s.extraction.answer })),
      pieces,
    );
  } catch (err) {
    return { problem: err instanceof Error ? err.message : String(err) };
  }
}
