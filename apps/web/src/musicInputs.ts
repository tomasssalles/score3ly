// What the music stages (`extract`, `review`, `apply_review`; docs/stages/music.md) read before they start: the page images, the
// latest layout, observations and pieces, and the systems of the score with what is needed to crop them. In one place,
// so that every stage finds them the same way.

import type { ApiOutput, ApiStage } from "./api.ts";
import type { StoredObservations, StoredPieces } from "./analyze.ts";
import { fetchJsonContent } from "./api.ts";
import type { PageLayout } from "./layout.ts";
import { musicSystems, type MusicSystems } from "./musicSystems.ts";
import { CannotStart } from "./stageRunner.ts";
import { musicSources, type MusicPage, type MusicSources } from "./stageInputs.ts";

export type { MusicSystem } from "./musicSystems.ts";

export type MusicInputs = MusicSystems & {
  earlier: ApiStage[]; // the stages before this one, the latest first
  sources: MusicSources;
  pages: MusicPage[]; // per page: its layout's output and its image's
  layouts: PageLayout[];
  observations: StoredObservations;
  observationsOutput: ApiOutput;
  pieces: StoredPieces;
  piecesOutput: ApiOutput;
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
  const systems = musicSystems(pages, layouts, pieces);
  if (systems.systems.length === 0) throw new CannotStart("the layout has no systems.");
  return {
    ...systems,
    earlier,
    sources,
    pages,
    layouts,
    observations,
    observationsOutput: obs.output,
    pieces,
    piecesOutput: pcs.output,
  };
}
