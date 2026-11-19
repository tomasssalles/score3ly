// The systems of the score as the music stages (`extract`, `review`, `apply_review`; docs/stages/music.md) use them:
// numbered across the pages, with where the pieces begin and end, the images a request about each sends, what its
// answer is checked against, and how its page is straightened. Pure: musicInputs.ts fetches what it is made from.

import type { SystemContext } from "@score3ly/notation";
import { extractImageLabels } from "@score3ly/prompts";
import type { StoredPieces } from "./analyze.ts";
import { pieceBounds, type ScoreSystem } from "./extract.ts";
import { numberSystems, type NumberedSystem, type PageLayout } from "./layout.ts";
import { straightRecipe, type PageRecipe, type StraightRecipe } from "./recipes.ts";
import type { MusicPage } from "./stageInputs.ts";
import { stretchBox } from "./crops.ts";

export type MusicSystem = NumberedSystem;

export type MusicSystems = {
  systems: MusicSystem[];
  byNumber: Map<number, MusicSystem>;
  straight: (pageIndex: number) => StraightRecipe;
  placeBox: (place: { system: number; stretch: number }) => { page: number; box: ReturnType<typeof stretchBox> } | null;
  bounds: (system: number) => { first: boolean; last: boolean };
  labelsOf: (system: ScoreSystem) => string[]; // the labels of the images a request about it sends
  contextOf: (system: ScoreSystem) => SystemContext; // what its answer is checked against
};

// `pages` and `layouts`: each page and its layout, in the pages' order.
export function musicSystems(pages: MusicPage[], layouts: PageLayout[], pieces: StoredPieces): MusicSystems {
  const systems: MusicSystem[] = numberSystems(layouts.map((l, i) => ({ page: pages[i].page, systems: l.systems })));
  const byNumber = new Map(systems.map((s) => [s.number, s]));
  const lastSystem = systems[systems.length - 1]?.number ?? 0;
  const bounds = (n: number) => pieceBounds(pieces, n, lastSystem);
  const labelsOf = (s: ScoreSystem) => {
    const { first, last } = bounds(s.number);
    return extractImageLabels(s.layout.barLines.length + 1, !first && byNumber.has(s.number - 1), !last && byNumber.has(s.number + 1));
  };
  return {
    systems,
    byNumber,
    straight: (i) => straightRecipe(pages[i].image.recipe as PageRecipe, layouts[i].angle),
    placeBox: (p) => {
      const s = byNumber.get(p.system);
      return s ? { page: s.page, box: stretchBox(s.layout, p.stretch) } : null;
    },
    bounds,
    labelsOf,
    contextOf: (s) => ({ system: s.number, stretches: s.layout.barLines.length + 1, firstOfPiece: bounds(s.number).first, images: labelsOf(s) }),
  };
}
