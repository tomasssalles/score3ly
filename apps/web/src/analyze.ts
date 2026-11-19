// The `analyze` step (docs/stages/analyze.md): what doesn't need the browser or the model. Its runner is runAnalyze.ts.

import { llmStageKey, type LlmStageConfig } from "./llmStageKey.ts";
import {
  checkScoreAnswer,
  firstPlace,
  flatMetadata,
  flatObservations,
  PAGE_LISTS,
  SCORE_LISTS,
  stavesProblem,
  TEXT_FIELDS,
  TITLE_TYPES,
  withIds,
  type AnalyzeContext,
  type Confidence,
  type PageMetadata,
  type PageObservations,
  type Role,
  type ScoreAnswer,
  type ScoreMetadata,
  type ScoreObservations,
  type TextField,
} from "@score3ly/prompts";
import type { Problem } from "@score3ly/core";
import { count } from "./format.ts";

// The step's version: its code, with the checks and the conversions in @score3ly/prompts (ANALYZE_PROMPT_VERSION is
// what is sent: the texts and the schemas).
export const ANALYZE_VERSION = 5; // 4: answers checked against their schema first, a malformed one refused (code review, batch 18); 5: spans ending before they start and two pieces at one system refused, a piece's page its system's (code review, batch 30)

// What is stored per page (item p<n>, type `analysis`): the page's own answer, and which systems are on it.
export type PageAnalysis = { page: number; systems: number[]; metadata: PageMetadata; observations: PageObservations };

// What is stored for the whole score: the metadata (item '', type `metadata`; below), and the observations (item '', type
// `observations`): one document, the pages' items as the whole score's call corrected them, and the items of the
// whole score; every item with an id (a page's "p7-3", an added one "a2", the whole score's "s1", one the user added
// in `fix_observations` "u1"). `fix_observations` stores the same, every item also saying whether the user
// confirmed it (`analyze`'s don't: nothing is), and the user's own items without a confidence (docs/stages/analyze.md).
type WithId = { id: string };
export type Stored<T> = Omit<T, "confidence"> & { id: string; confidence: Confidence | null; confirmed?: boolean };
type StoredLists<T> = { [K in keyof T]: T[K] extends (infer I)[] ? Stored<I>[] : never };
export type StoredPage = { page: number } & StoredLists<PageObservations>;
export type StoredScore = StoredLists<ScoreObservations>;
export type StoredObservations = { pages: StoredPage[]; score: StoredScore };

// The metadata as stored (item '', type `metadata`) by `analyze` (pages always set, a piece's its system's; nothing
// confirmed, so no `confirmed`) and by `fix_metadata`, the user's comments too; read by normalizeMetadata. Every item:
// its page (none for what the user adds without one), the model's confidence (none for what the user added) and
// whether the user confirmed it (docs/stages/analyze.md: stored beside the confidence, not instead of it).
type TitleType = (typeof TITLE_TYPES)[number];
// The text fields: the model's, and the user's comment (never set by `analyze`).
export type TextKind = TextField | "comments";
export type MetadataItem = { page: number | null; confidence: Confidence | null; confirmed: boolean };
export type StoredMetadata = {
  titles: ({ text: string; type: TitleType } & MetadataItem)[];
  people: ({ name: string; role: Role } & MetadataItem)[];
  pieces: ({ title: string; system: number } & MetadataItem)[];
} & Record<TextKind, ({ text: string } & MetadataItem)[]>;

// Stored metadata as the app reads it: `analyze`'s has no `confirmed` (nothing is), and the lists an older version
// didn't have (e.g. `compositionDates`, `comments`) are empty.
export function normalizeMetadata(json: unknown): StoredMetadata {
  const m = (json ?? {}) as Partial<StoredMetadata>;
  const common = <T extends Partial<MetadataItem>>(item: T) => ({ ...item, confidence: item.confidence ?? null, confirmed: item.confirmed ?? false });
  return {
    titles: (m.titles ?? []).map(common),
    people: (m.people ?? []).map(({ name, role, page, confidence, confirmed }) => common({ name, role, page, confidence, confirmed })),
    pieces: (m.pieces ?? []).map(common),
    ...(Object.fromEntries([...TEXT_FIELDS, "comments"].map((f) => [f, (m[f as TextKind] ?? []).map(common)])) as Record<TextKind, []>),
  };
}

// Where the pieces start (item '', type `pieces`): the first system of every piece, ascending, each once. All that
// `extract` reads of the metadata (§6): a corrected composer leaves it the same. It always starts with system 1: the
// systems before the first piece the metadata names are a piece too, so naming that piece later changes nothing.
export type StoredPieces = number[];

export function piecesOf(metadata: { pieces: { system: number }[] }): StoredPieces {
  return [...new Set([1, ...metadata.pieces.map((p) => p.system)])].sort((a, b) => a - b);
}

// The stage key (§5.2, llmStageKey.ts): the step, its version, the prompt's version, the model, the images' recipe, and per page the
// page image's recipe key and the stored layout it is analysed with.
export function analyzeStageKey(input: {
  config: LlmStageConfig;
  promptVersion: number;
  model: unknown;
  imageRecipe: unknown;
  pages: { pageImageKey: string; layoutSha256: string }[];
}): Promise<string> {
  return llmStageKey("analyze", ANALYZE_VERSION, input);
}

// The pages' results as the whole-score call reads them, flat as the model writes them: every metadata item with the
// page it was found on, every system and observation item with its id.
export function pageResultsForScore(pages: PageAnalysis[]): unknown {
  return pages.map(({ page, systems, metadata, observations }) => ({
    page,
    systems,
    metadata: flatMetadata(
      Object.fromEntries(
        Object.entries(metadata).map(([field, items]) => [field, (items as object[]).map((item) => ({ ...item, page }))]),
      ) as ScoreMetadata,
    ),
    observations: flatObservations(withIds(page, observations)),
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

// The whole score's answer as `analyze` uses it: checked (checkScoreAnswer, against the pages' items), applied to the
// pages' items (combineObservations), and the pages as corrected checked once more: their staves must still agree
// (stavesProblem). The answer and the observations, or why the answer can't be used.
// What a change here or in combineObservations changes is stored, not sent: it raises ANALYZE_VERSION (this file), the
// step's version, not ANALYZE_PROMPT_VERSION (texts and schemas).
export function scoreObservations(
  pages: PageAnalysis[],
  json: unknown,
  context: Omit<AnalyzeContext, "items">,
): { answer: ScoreAnswer; observations: StoredObservations } | Problem {
  const checked = checkScoreAnswer(json, { ...context, items: pageItems(pages) });
  if ("problem" in checked) return checked;
  const observations = combineObservations(pages, checked);
  const staves = observations.pages
    .map((p) => stavesProblem(p, pages.find((r) => r.page === p.page)!.systems))
    .map((problem, i) => problem && `page ${observations.pages[i].page}: ${problem}`)
    .find((problem) => problem);
  return staves ? { problem: staves } : { answer: checked, observations };
}

// The card's short result, e.g. "12 pages · 3 pieces".
export function analyzeNote(pages: number, pieces: number): string {
  const text = count(pages, "page");
  return pieces > 1 ? `${text} · ${pieces} pieces` : text;
}

// An item's confidence as the views show it (decided, §6: low ???, medium ?, high ✓ gray, confirmed ✓ green) and as
// `extract`'s requests give it: "confirmed" when a person checked it or wrote it (what a person adds has no confidence
// of the model's), else the model's.
export type ShownConfidence = Confidence | "confirmed";

export function shownConfidence(item: { confidence: Confidence | null; confirmed?: boolean }): ShownConfidence {
  return item.confirmed || item.confidence === null ? "confirmed" : item.confidence;
}

export const CONFIDENCE_SYMBOLS: Record<ShownConfidence, { symbol: string; label: string }> = {
  low: { symbol: "???", label: "Low confidence" },
  medium: { symbol: "?", label: "Medium confidence" },
  high: { symbol: "✓", label: "High confidence" },
  confirmed: { symbol: "✓", label: "Confirmed" },
};
