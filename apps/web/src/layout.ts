// The `layout` step (docs/stages/layout.md): what doesn't need the browser or the model. Its runner is runLayout.ts.

import type { LayoutSystem } from "@score3ly/prompts";
import { keyOf } from "@score3ly/core";

export const LAYOUT_VERSION = 1;

// What is stored per page: the layout on the straightened page (fractions of it), and how it came about.
export type PageLayout = {
  angle: number | null; // the page was straightened by this (from the lines), or not at all
  severelySkewed: boolean;
  systems: LayoutSystem[];
  flagged: boolean; // the model wasn't satisfied after the last round: for a person to check (fix_layout)
  note: string; // the model's note, e.g. what is still wrong
  rounds: number; // answers it took
};

// The stage key (§5.2): the step, its version, the prompt's version, the model, the image limit, and per page the
// page image's recipe key and the stored lines it is straightened by.
export function layoutStageKey(input: {
  promptVersion: number;
  model: unknown;
  imageRecipe: unknown;
  pages: { pageImageKey: string; linesSha256: string | null }[];
}): Promise<string> {
  return keyOf({ step: "layout", version: LAYOUT_VERSION, ...input });
}

// The card's short result, e.g. "54 systems on 12 pages · 2 flagged".
export function layoutNote(systems: number, pages: number, flagged: number): string {
  const text = `${systems} system${systems === 1 ? "" : "s"} on ${pages} page${pages === 1 ? "" : "s"}`;
  return flagged > 0 ? `${text} · ${flagged} flagged` : text;
}
