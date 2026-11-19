// What the music stages (`extract`, `review`, `apply_review`; docs/stages/music.md) read before they start: the page images, the
// latest layout, observations and pieces, and the systems of the score with what is needed to crop them. In one place,
// so that every stage finds them the same way.

import type { SystemContext } from "@score3ly/notation";
import { extractImageLabels } from "@score3ly/prompts";
import type { ApiOutput, ApiStage } from "./api.ts";
import type { StoredObservations, StoredPieces } from "./analyze.ts";
import { fetchJsonContent } from "./api.ts";
import { pieceBounds, stretchBox, type ScoreSystem } from "./extract.ts";
import { numberSystems, type PageLayout } from "./layout.ts";
import { straightRecipe, type PageRecipe, type StraightRecipe } from "./recipes.ts";
import { CannotStart } from "./stageRunner.ts";
import { musicSources, type MusicPage, type MusicSources } from "./stageInputs.ts";

export type MusicSystem = ScoreSystem & { pageIndex: number };

export type MusicInputs = {
  earlier: ApiStage[]; // the stages before this one, the latest first
  sources: MusicSources;
  pages: MusicPage[]; // per page: its layout's output and its image's
  layouts: PageLayout[];
  observations: StoredObservations;
  observationsOutput: ApiOutput;
  pieces: StoredPieces;
  piecesOutput: ApiOutput;
  systems: MusicSystem[];
  byNumber: Map<number, MusicSystem>;
  straight: (pageIndex: number) => StraightRecipe;
  placeBox: (place: { system: number; stretch: number }) => { page: number; box: ReturnType<typeof stretchBox> } | null;
  bounds: (system: number) => { first: boolean; last: boolean };
  labelsOf: (system: ScoreSystem) => string[]; // the labels of the images a request about it sends
  contextOf: (system: ScoreSystem) => SystemContext; // what its answer is checked against
};

export async function musicInputs(stage: ApiStage, stages: ApiStage[]): Promise<MusicInputs> {
  const before = stages.slice(0, stages.findIndex((s) => s.id === stage.id));
  const earlier = [...before].reverse();
  const sources = musicSources(before);
  const { rasterize, layout: layoutStage, pages } = sources;
  if (!rasterize || rasterize.status !== "done") throw new CannotStart("there are no page images: Rasterize hasn't run.");
  if (!layoutStage || layoutStage.status !== "done") throw new CannotStart("the layout hasn't been found yet.");
  // The latest observations and pieces: a fix's, else analyze's (a WIP fix must be finished first).
  const obs = sources.observations;
  const pcs = sources.pieces;
  if (!obs || !pcs) throw new CannotStart("the score hasn't been analysed yet.");
  if (obs.stage.status !== "done" || pcs.stage.status !== "done") throw new CannotStart("a fix of the analysis isn't finished yet.");

  const [layouts, observations, pieces] = await Promise.all([
    Promise.all(pages.map((p) => fetchJsonContent(p.output.contentSha256!) as Promise<PageLayout>)),
    fetchJsonContent(obs.output.contentSha256!) as Promise<StoredObservations>,
    fetchJsonContent(pcs.output.contentSha256!) as Promise<StoredPieces>,
  ]);
  const systems: MusicSystem[] = numberSystems(layouts.map((l, i) => ({ page: pages[i].page, systems: l.systems })));
  if (systems.length === 0) throw new CannotStart("the layout has no systems.");
  const byNumber = new Map(systems.map((s) => [s.number, s]));
  const lastSystem = systems[systems.length - 1].number;
  const bounds = (n: number) => pieceBounds(pieces, n, lastSystem);

  const labelsOf = (s: ScoreSystem) => {
    const { first, last } = bounds(s.number);
    return extractImageLabels(s.layout.barLines.length + 1, !first && byNumber.has(s.number - 1), !last && byNumber.has(s.number + 1));
  };

  return {
    earlier,
    sources,
    pages,
    layouts,
    observations,
    observationsOutput: obs.output,
    pieces,
    piecesOutput: pcs.output,
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
