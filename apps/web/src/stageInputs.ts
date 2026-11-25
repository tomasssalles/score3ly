// Where a stage finds what it reads (docs/database.md, "outputs"): the latest stage before it that produces it. Pure
// (stages and outputs, no fetching), for the runners, the finishers, the artifacts and what a carried review would
// read now (steps.ts), which must all find the same.

import type { StepId } from "@score3ly/core";
import type { ApiOutput, ApiStage } from "./api.ts";
import { pageOfItem } from "@score3ly/core";

// The steps whose stages produce what later stages read: a manual fix's output replaces the one it corrects, so the
// latest of them counts. `lines` are `skew_analysis`'s outputs `skew` and `fix_skew`'s `lines`; the others are the
// outputs' types.
export const PRODUCERS = {
  page_image: ["rasterize"],
  lines: ["skew_analysis", "fix_skew"],
  layout: ["layout", "fix_layout"],
  metadata: ["fix_metadata", "analyze"],
  pieces: ["fix_metadata", "analyze"],
  observations: ["fix_observations", "analyze"],
  extraction: ["extract", "apply_review"],
  mei: ["build_mei", "fix_mei"],
} as const satisfies Record<string, readonly StepId[]>;

export type Produced = keyof typeof PRODUCERS;

// The latest of `earlier` (stages in the pipeline's order) whose step is one of `steps`, or null.
export function latestStage(earlier: readonly ApiStage[], steps: readonly string[]): ApiStage | null {
  for (let i = earlier.length - 1; i >= 0; i--) if (steps.includes(earlier[i].step)) return earlier[i];
  return null;
}

// The latest stage before that produces `what`, whatever its status and outputs (the callers check them).
export const latestProducer = (earlier: readonly ApiStage[], what: Produced): ApiStage | null => latestStage(earlier, PRODUCERS[what]);

// A whole-score output (item ''): the latest stage before that stored one of the type, with it. A fix that hasn't
// stored it yet (a WIP form never saved) is passed over.
export function latestOutput(earlier: readonly ApiStage[], type: "metadata" | "pieces" | "observations"): { stage: ApiStage; output: ApiOutput } | null {
  const own = (s: ApiStage) => s.outputs.find((o) => o.item === "" && o.type === type && o.contentSha256);
  for (let i = earlier.length - 1; i >= 0; i--) {
    const output = (PRODUCERS[type] as readonly string[]).includes(earlier[i].step) ? own(earlier[i]) : undefined;
    if (output) return { stage: earlier[i], output };
  }
  return null;
}

// A page the music stages read: its layout's output and its image's, and its number.
export type MusicPage = { output: ApiOutput; image: ApiOutput; page: number };

// What the music stages read (docs/stages/music.md), by output: the page images and the latest layout (the pages with
// both, by page), the latest observations and pieces, and the latest transcription with the reviews after it. The
// stages, for their status: what is missing is null. `earlier`: the stages before the one that reads, in order.
export type MusicSources = {
  rasterize: ApiStage | null;
  layout: ApiStage | null;
  pages: MusicPage[];
  observations: { stage: ApiStage; output: ApiOutput } | null;
  pieces: { stage: ApiStage; output: ApiOutput } | null;
  transcription: {
    stage: ApiStage;
    outputs: ApiOutput[]; // its extractions and the checks of the whole score, in its order
    extractions: Map<string, ApiOutput>; // by item
    checks: ApiOutput | null;
    reviews: ApiStage[]; // the stages after it that review it (`review`, `human_review`), in order
  } | null;
};

// The steps whose stages review the transcription before them, and the type of the outputs each stores its entries in.
export const REVIEWING_STEPS: Record<string, string> = { review: "review", human_review: "human_review" };

export function musicSources(earlier: readonly ApiStage[]): MusicSources {
  const rasterize = latestProducer(earlier, "page_image");
  const layout = latestProducer(earlier, "layout");
  const images = new Map((rasterize?.outputs ?? []).filter((o) => o.type === "page_image").map((o) => [o.item, o]));
  const pages = (rasterize ? (layout?.outputs ?? []) : [])
    .filter((o) => o.type === "layout" && o.contentSha256 && images.get(o.item)?.recipe)
    .map((o) => ({ output: o, image: images.get(o.item)!, page: pageOfItem(o.item) ?? 0 }))
    .sort((a, b) => a.page - b.page);
  const transcribed = latestProducer(earlier, "extraction");
  const outputs = (transcribed?.outputs ?? []).filter((o) => (o.type === "extraction" || (o.item === "" && o.type === "score_checks")) && o.contentSha256);
  return {
    rasterize,
    layout,
    pages,
    observations: latestOutput(earlier, "observations"),
    pieces: latestOutput(earlier, "pieces"),
    transcription: transcribed && {
      stage: transcribed,
      outputs,
      extractions: new Map(outputs.filter((o) => o.type === "extraction").map((o) => [o.item, o])),
      checks: outputs.find((o) => o.type === "score_checks") ?? null,
      reviews: earlier.slice(earlier.indexOf(transcribed) + 1).filter((s) => s.step in REVIEWING_STEPS),
    },
  };
}

// The outputs of a reviewing stage that hold its entries.
export const reviewEntries = (review: ApiStage): ApiOutput[] => review.outputs.filter((o) => o.type === REVIEWING_STEPS[review.step] && o.contentSha256);

const pageIds = (pages: MusicPage[]) => pages.flatMap((p) => [p.output.id, p.image.id]);

// What a review reads (docs/stages/music.md, `review`), by output ids: the latest transcription (its extractions and
// the checks of the whole score), each page's layout and image, the latest observations and pieces. What runReview.ts
// records when the stage starts, and what a carried review is compared by (steps.ts): kept exactly when it would read
// the same. None while something is missing.
export function reviewInputIds(sources: MusicSources): string[] {
  const { rasterize, layout, transcription, observations, pieces } = sources;
  if (!transcription || !rasterize || !layout || !observations || !pieces) return [];
  return [...transcription.outputs.map((o) => o.id), ...pageIds(sources.pages), observations.output.id, pieces.output.id];
}

// What an `apply_review` reads: the same, and the entries of the reviews it applies.
export function applyReviewInputIds(sources: MusicSources): string[] {
  const { transcription, observations, pieces } = sources;
  if (!transcription || !transcription.checks || !observations || !pieces) return [];
  return [
    ...[...transcription.extractions.values(), transcription.checks].map((o) => o.id),
    ...transcription.reviews.flatMap(reviewEntries).map((o) => o.id),
    ...pageIds(sources.pages),
    observations.output.id,
    pieces.output.id,
  ];
}

// A stage's page count (`ApiStage.pageCount`, stored with its start): the selected pages, for every stage after
// `rasterize` (the owner's dec. 40, the code review's F7): the page images of the latest `rasterize` before it, or null
// without one. Run times divides by it (docs/statistics.md), and the run report reads it.
export function pageCountOf(earlier: readonly ApiStage[]): number | null {
  const rasterize = latestProducer(earlier, "page_image");
  return rasterize ? rasterize.outputs.filter((o) => o.type === "page_image").length : null;
}

// The same for a stage of the pipeline: from the stages before it.
export const pageCountBefore = (stages: readonly ApiStage[], stageId: string): number | null =>
  pageCountOf(stages.slice(0, Math.max(0, stages.findIndex((s) => s.id === stageId))));
