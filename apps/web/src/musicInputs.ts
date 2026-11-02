// What the music stages (`extract`, `review`, `apply_review`; docs/stages/music.md) read before they start: the page images, the
// latest layout, observations and pieces, and the systems of the score with what is needed to crop them. In one place,
// so that every stage finds them the same way.

import { DESKEW_VERSION, ROTATE_VERSION } from "@score3ly/imaging";
import { extractImageLabels } from "@score3ly/prompts";
import type { ApiOutput, ApiStage } from "./api";
import type { StoredObservations, StoredPieces } from "./analyze";
import { fetchJsonContent } from "./api";
import { pieceBounds, stretchBox, type ScoreSystem } from "./extract";
import { firstNumbers } from "./fixLayout";
import type { PageLayout } from "./layout";
import type { StraightRecipe } from "./pageImages";
import { pageOfItem, type PageRecipe } from "./rasterize";
import { CannotStart } from "./stageRunner";

const LAYOUT_STEPS = ["layout", "fix_layout"];
const OBSERVATION_STEPS = ["fix_observations", "analyze"];
const PIECE_STEPS = ["fix_metadata", "analyze"];

export type MusicSystem = ScoreSystem & { pageIndex: number };

export type MusicInputs = {
  earlier: ApiStage[]; // the stages before this one, the latest first
  pages: { output: ApiOutput; image: ApiOutput; page: number }[]; // per page: its layout's output and its image's
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
};

export async function musicInputs(stage: ApiStage, stages: ApiStage[]): Promise<MusicInputs> {
  const earlier = stages.slice(0, stages.findIndex((s) => s.id === stage.id)).reverse();
  const rasterize = earlier.find((s) => s.step === "rasterize");
  if (!rasterize || rasterize.status !== "done") throw new CannotStart("there are no page images: Rasterize hasn't run.");
  const layoutStage = earlier.find((s) => LAYOUT_STEPS.includes(s.step));
  if (!layoutStage || layoutStage.status !== "done") throw new CannotStart("the layout hasn't been found yet.");
  // The latest observations and pieces: a fix's, else analyze's (a WIP fix must be finished first).
  const latest = (steps: string[], type: string) => {
    const s = earlier.find((x) => steps.includes(x.step) && x.outputs.some((o) => o.item === "" && o.type === type));
    return s ? { stage: s, output: s.outputs.find((o) => o.item === "" && o.type === type && o.contentSha256)! } : null;
  };
  const obs = latest(OBSERVATION_STEPS, "observations");
  const pcs = latest(PIECE_STEPS, "pieces");
  if (!obs || !pcs) throw new CannotStart("the score hasn't been analysed yet.");
  if (obs.stage.status !== "done" || pcs.stage.status !== "done") throw new CannotStart("a fix of the analysis isn't finished yet.");

  const images = new Map(rasterize.outputs.filter((o) => o.type === "page_image").map((o) => [o.item, o]));
  const pages = layoutStage.outputs
    .filter((o) => o.type === "layout" && o.contentSha256 && images.get(o.item)?.recipe)
    .map((o) => ({ output: o, image: images.get(o.item)!, page: pageOfItem(o.item) ?? 0 }))
    .sort((a, b) => a.page - b.page);
  const [layouts, observations, pieces] = await Promise.all([
    Promise.all(pages.map((p) => fetchJsonContent(p.output.contentSha256!) as Promise<PageLayout>)),
    fetchJsonContent(obs.output.contentSha256!) as Promise<StoredObservations>,
    fetchJsonContent(pcs.output.contentSha256!) as Promise<StoredPieces>,
  ]);
  const firsts = firstNumbers(layouts.map((l) => l.systems.length));
  const systems: MusicSystem[] = layouts.flatMap((l, i) =>
    l.systems.map((s, j) => ({ number: firsts[i] + j, page: pages[i].page, item: `p${pages[i].page}/s${j + 1}`, layout: s, pageIndex: i })),
  );
  if (systems.length === 0) throw new CannotStart("the layout has no systems.");
  const byNumber = new Map(systems.map((s) => [s.number, s]));
  const lastSystem = systems[systems.length - 1].number;
  const bounds = (n: number) => pieceBounds(pieces, n, lastSystem);

  return {
    earlier,
    pages,
    layouts,
    observations,
    observationsOutput: obs.output,
    pieces,
    piecesOutput: pcs.output,
    systems,
    byNumber,
    straight: (i) => ({ page: pages[i].image.recipe as PageRecipe, angle: layouts[i].angle, deskew: DESKEW_VERSION, rotate: ROTATE_VERSION }),
    placeBox: (p) => {
      const s = byNumber.get(p.system);
      return s ? { page: s.page, box: stretchBox(s.layout, p.stretch) } : null;
    },
    bounds,
    labelsOf: (s) => {
      const { first, last } = bounds(s.number);
      return extractImageLabels(s.layout.barLines.length + 1, !first && byNumber.has(s.number - 1), !last && byNumber.has(s.number + 1));
    },
  };
}
