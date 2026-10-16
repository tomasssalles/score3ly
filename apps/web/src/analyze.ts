// The `analyze` step (DESIGN.md §6): what doesn't need the browser or the model. Its runner is runAnalyze.ts.

import {
  PAGE_LISTS,
  SCORE_LISTS,
  withIds,
  type Confidence,
  type PageMetadata,
  type PageObservations,
  type Place,
  type ScoreAnswer,
  type ScoreMetadata,
  type ScoreObservations,
} from "@score3ly/prompts";
import { keyOf } from "./keys.ts";

export const ANALYZE_VERSION = 3;

// What is stored per page (item p<n>, type `analysis`): the page's own answer, and which systems are on it.
export type PageAnalysis = { page: number; systems: number[]; metadata: PageMetadata; observations: PageObservations };

// What is stored for the whole score: the metadata (item '', type `metadata`), and the observations (item '', type
// `observations`): one document, the pages' items as the whole score's call corrected them, and the items of the
// whole score; every item with an id (a page's "p7-3", an added one "a2", the whole score's "s1", one the user added
// in `fix_observations` "u1"). `fix_observations` stores the same, every item also saying whether the user
// confirmed it (`analyze`'s don't: nothing is), and the user's own items without a confidence (DESIGN.md §6).
export type StoredMetadata = ScoreMetadata;
type WithId = { id: string };
export type Stored<T> = Omit<T, "confidence"> & { id: string; confidence: Confidence | null; confirmed?: boolean };
type StoredLists<T> = { [K in keyof T]: T[K] extends (infer I)[] ? Stored<I>[] : never };
export type StoredPage = { page: number } & StoredLists<PageObservations>;
export type StoredScore = StoredLists<ScoreObservations>;
export type StoredObservations = { pages: StoredPage[]; score: StoredScore };

// Where the pieces start (item '', type `pieces`): the first system of every piece, ascending, each once. All that
// `extract` reads of the metadata (§6): a corrected composer leaves it the same. It always starts with system 1: the
// systems before the first piece the metadata names are a piece too, so naming that piece later changes nothing.
export type StoredPieces = number[];

export function piecesOf(metadata: { pieces: { system: number }[] }): StoredPieces {
  return [...new Set([1, ...metadata.pieces.map((p) => p.system)])].sort((a, b) => a - b);
}

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

// The pages' results as the whole-score call reads them: every metadata item with the page it was found on, every
// observation item with its id.
export function pageResultsForScore(pages: PageAnalysis[]): unknown {
  return pages.map(({ page, systems, metadata, observations }) => ({
    page,
    systems,
    metadata: Object.fromEntries(
      Object.entries(metadata).map(([field, items]) => [field, (items as object[]).map((item) => ({ ...item, page }))]),
    ),
    observations: withIds(page, observations),
  }));
}

// The pages' items by id, with their list and page: what the whole score's answer may correct or remove.
export function pageItems(pages: PageAnalysis[]): Map<string, { list: (typeof PAGE_LISTS)[number]; page: number }> {
  return new Map(
    pages.flatMap(({ page, observations }) => {
      const numbered = withIds(page, observations);
      return PAGE_LISTS.flatMap((list) => (numbered[list] as WithId[]).map((item): [string, { list: typeof list; page: number }] => [item.id, { list, page }]));
    }),
  );
}

// Where a place is in the score, for sorting: by system, then start, stretch 1, bar line 1, stretch 2, …, end.
function placeOrder(p: Place): number {
  const within = p.at === "start" ? 1 : p.at === "stretch" ? 2 * p.number : p.at === "barLine" ? 2 * p.number + 1 : 1e6;
  return p.system * 1e7 + within;
}

// Where an item starts, for sorting a list: an item open at its start before everything on its end's system, one open
// at both ends before everything.
export function firstPlace(item: object): number {
  const i = item as { system?: number; place?: Place; start?: Place | null; end?: Place | null };
  if (i.system !== undefined) return i.system * 1e7;
  if (i.place) return placeOrder(i.place);
  if (i.start) return placeOrder(i.start);
  return i.end ? i.end.system * 1e7 : 0;
}

// The observations as one document: the whole score's answer applied to the pages' items. Corrected items keep their
// id and page, removed ones go, added ones join their page with a new id; every list but the notes in the score's
// order.
export function combineObservations(pages: PageAnalysis[], answer: ScoreAnswer): StoredObservations {
  const removed = new Set(answer.removals);
  const corrected = new Map(PAGE_LISTS.flatMap((list) => (answer.corrections[list] as WithId[]).map((item): [string, WithId] => [item.id, item])));
  let added = 0;
  const stored = pages.map(({ page, observations }): StoredPage => {
    const numbered = withIds(page, observations);
    const lists = PAGE_LISTS.map((list) => {
      const kept = (numbered[list] as WithId[]).filter((item) => !removed.has(item.id)).map((item) => corrected.get(item.id) ?? item);
      const additions = (answer.additions[list] as { page: number }[])
        .filter((item) => item.page === page)
        .map(({ page: _, ...item }) => ({ id: `a${++added}`, ...item }));
      const all = [...kept, ...additions];
      return [list, list === "notes" ? all : all.sort((a, b) => firstPlace(a) - firstPlace(b))];
    });
    return { page, ...Object.fromEntries(lists) } as StoredPage;
  });
  let n = 0;
  const score = Object.fromEntries(
    SCORE_LISTS.map((list) => [list, (answer.score[list] as object[]).map((item) => ({ id: `s${++n}`, ...item }))]),
  ) as StoredScore;
  return { pages: stored, score };
}

// A place by name, as the views say it: "system 17, start", "system 17, bar line 4", "system 17, stretch 3",
// "system 17, end".
export function placeLabel(p: Place): string {
  const where = p.at === "start" || p.at === "end" ? p.at : `${p.at === "barLine" ? "bar line" : "stretch"} ${p.number}`;
  return `system ${p.system}, ${where}`;
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
