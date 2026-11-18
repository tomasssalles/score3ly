// The steps (docs/overview.md §5.1, §6): their ids and kinds, and the recipe. The web app declares the rest of what it
// knows about each step (title, config form, artifacts) by these ids; the Worker needs the kinds to give LLM stages their
// model config and to add, carry and drop manual stages.

// A stage's kind (docs/overview.md §5.1): never changes for a step (docs/database.md).
export type StageKind = "ingest" | "computed" | "llm" | "manual";

// Every step's kind, in the order its stages come in a pipeline (a manual step right after the step it fixes). A step's
// kind never changes: add new steps here, but never edit an entry.
export const STEP_KINDS = {
  ingest: "ingest",
  rasterize: "computed",
  skew_analysis: "computed",
  fix_skew: "manual",
  layout: "llm",
  fix_layout: "manual",
  analyze: "llm",
  fix_metadata: "manual",
  fix_observations: "manual",
  extract: "llm",
  review: "llm",
  apply_review: "llm",
  human_review: "manual",
  build_mei: "computed",
  fix_mei: "manual",
  engrave: "computed",
} as const satisfies Record<string, StageKind>;

export type StepId = keyof typeof STEP_KINDS;

// The planned stages, in order (docs/overview.md §6). New projects get all of them; Ingest is done from the start.
export const RECIPE = ["ingest", "rasterize", "skew_analysis", "layout", "analyze", "extract", "review", "apply_review", "build_mei", "engrave"] as const satisfies readonly StepId[];

// Every step, in the order of a pipeline (`STEP_KINDS`).
export const STEP_IDS = Object.keys(STEP_KINDS) as StepId[];

// The steps of one kind, in the order of a pipeline.
export function stepsOfKind<K extends StageKind>(kind: K): { [S in StepId]: (typeof STEP_KINDS)[S] extends K ? S : never }[StepId][] {
  return STEP_IDS.filter((step) => STEP_KINDS[step] === kind) as never;
}

// A further review (docs/overview.md §5.5): a review the user added, not the recipe's. It is carried through a re-run
// like a manual stage once it has run, and dropped with the `apply_review` that follows it.
export function isFurtherReview(stage: { step: string; inRecipe: boolean }): boolean {
  return stage.step === "review" && !stage.inRecipe;
}

// Whether a stage can be dropped (docs/overview.md §5.5): a manual one, or a further review. The recipe's stages can't.
export function isDroppable(stage: { step: string; inRecipe: boolean }): boolean {
  return (STEP_KINDS as Record<string, StageKind>)[stage.step] === "manual" || isFurtherReview(stage);
}
