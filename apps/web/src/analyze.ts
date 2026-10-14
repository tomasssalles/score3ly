// The `analyze` step (DESIGN.md §6): what doesn't need the browser or the model. Its runner is runAnalyze.ts.

import type {
  Confidence,
  PageMetadata,
  PageObservations,
  ScoreMetadata,
  ScoreObservations,
} from "@score3ly/prompts";
import { keyOf } from "./keys.ts";

export const ANALYZE_VERSION = 1;

// What is stored per page (item p<n>, type `analysis`): the page's own answer, and which systems are on it.
export type PageAnalysis = { page: number; systems: number[]; metadata: PageMetadata; observations: PageObservations };

// What is stored for the whole score: the metadata (item '', type `metadata`) and the observations (item '', type
// `observations`): the whole score's, and every page's.
export type StoredMetadata = ScoreMetadata;
export type StoredObservations = { score: ScoreObservations; pages: (PageObservations & { page: number })[] };

// The stage key (§5.2): the step, its version, the prompt's version, the model, the images' recipe, and per page the
// page image's recipe key and the stored layout it is analysed with.
export function analyzeStageKey(input: {
  promptVersion: number;
  model: unknown;
  imageRecipe: unknown;
  pages: { pageImageKey: string; layoutSha256: string }[];
}): Promise<string> {
  return keyOf({ step: "analyze", version: ANALYZE_VERSION, ...input });
}

// The pages' results as the whole-score call reads them: every metadata item with the page it was found on.
export function pageResultsForScore(pages: PageAnalysis[]): unknown {
  return pages.map(({ page, systems, metadata, observations }) => ({
    page,
    systems,
    metadata: Object.fromEntries(
      Object.entries(metadata).map(([field, items]) => [field, (items as object[]).map((item) => ({ ...item, page }))]),
    ),
    observations,
  }));
}

// The card's short result, e.g. "12 pages · 3 pieces".
export function analyzeNote(pages: number, pieces: number): string {
  const text = `${pages} page${pages === 1 ? "" : "s"}`;
  return pieces > 1 ? `${text} · ${pieces} pieces` : text;
}

// A field's confidence as the views show it (decided, §6): low ???, medium ?, high ✓ (gray), confirmed ✓ (green).
export type ShownConfidence = Confidence | "confirmed";

export const CONFIDENCE_SYMBOLS: Record<ShownConfidence, { symbol: string; label: string }> = {
  low: { symbol: "???", label: "Low confidence" },
  medium: { symbol: "?", label: "Medium confidence" },
  high: { symbol: "✓", label: "High confidence" },
  confirmed: { symbol: "✓", label: "Confirmed" },
};
