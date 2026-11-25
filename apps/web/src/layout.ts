// The `layout` step (docs/stages/layout.md): what doesn't need the browser or the model. Its runner is runLayout.ts.

import { LAYOUT_ROUNDS } from "@score3ly/prompts";
import { llmStageKey, type LlmStageConfig } from "./llmStageKey.ts";
import { systemItem, type LayoutSystem } from "@score3ly/core";
import { count } from "./format.ts";

export const LAYOUT_VERSION = 2; // 2: answers checked against their schema first, a malformed one refused (code review, batch 18)

// What is stored per page: the layout on the straightened page (fractions of it), and how it came about.
export type PageLayout = {
  angle: number | null; // the page was straightened by this (from the lines), or not at all
  severelySkewed: boolean;
  systems: LayoutSystem[];
  flagged: boolean; // the model wasn't satisfied after the last round: for a person to check (fix_layout)
  note: string; // the model's note, e.g. what is still wrong
  rounds: number; // answers it took
};

// The stage key (§5.2, llmStageKey.ts): the step, its version, the prompt's version, the model, the images' recipe (the
// deskew decision's version among them: the stage decides the angles), per page the page image's recipe key and the
// stored lines it is straightened by, and the number of rounds.
export function layoutStageKey(input: {
  config: LlmStageConfig;
  promptVersion: number;
  model: unknown;
  imageRecipe: unknown;
  pages: { pageImageKey: string; linesSha256: string | null }[];
}): Promise<string> {
  return llmStageKey("layout", LAYOUT_VERSION, { ...input, rounds: LAYOUT_ROUNDS });
}

// The card's short result, e.g. "54 systems on 12 pages · 2 flagged".
export function layoutNote(systems: number, pages: number, flagged: number): string {
  const text = `${count(systems, "system")} on ${count(pages, "page")}`;
  return flagged > 0 ? `${text} · ${flagged} flagged` : text;
}

// A system of the score, numbered (docs/overview.md §6): its number, its page, its item (`p<page>/s<index>`) and its
// layout; `pageIndex` is the index of its page among the pages it was numbered from.
export type NumberedSystem = { number: number; page: number; item: string; layout: LayoutSystem; pageIndex: number };

type LayoutPage = { page: number; systems: LayoutSystem[] };

// The pages' indexes in the order their systems are numbered: by page number.
const pageOrder = (pages: LayoutPage[]) => pages.map((_, i) => i).sort((a, b) => pages[a].page - pages[b].page);

// The systems of the pages, numbered top to bottom on each page (as stored: layout and fix_layout keep them sorted),
// continuing from page to page in the pages' order. A page whose layout isn't there (not loaded) is given without
// systems.
export function numberSystems(pages: LayoutPage[]): NumberedSystem[] {
  const firsts = firstNumbers(pages);
  return pageOrder(pages).flatMap((pageIndex) => {
    const { page, systems } = pages[pageIndex];
    return systems.map((layout, j) => ({ number: firsts[pageIndex] + j, page, item: systemItem(page, j + 1), layout, pageIndex }));
  });
}

// The number of each page's first system, by the pages' index; for a page without systems, the next page's.
export function firstNumbers(pages: LayoutPage[]): number[] {
  const firsts = pages.map(() => 0);
  let next = 1;
  for (const i of pageOrder(pages)) {
    firsts[i] = next;
    next += pages[i].systems.length;
  }
  return firsts;
}
