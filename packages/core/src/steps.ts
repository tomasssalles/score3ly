// The steps (docs/overview.md §5.1, §6): their ids and kinds, and the recipe. The web app declares the rest of what it
// knows about each step (title, config form, artifacts) by these ids; the Worker needs the kinds to give LLM stages their
// model config and to add, carry and drop manual stages.

// A stage's kind (docs/overview.md §5.1): never changes for a step (docs/database.md).
export type StageKind = "ingest" | "computed" | "llm" | "manual";

// Every step's kind. A step's kind never changes: add new steps here, but never edit an entry.
export const STEP_KINDS = {
  ingest: "ingest",
  rasterize: "computed",
  skew_analysis: "computed",
  layout: "llm",
  analyze: "llm",
  extract: "llm",
  review: "llm",
  apply_review: "llm",
  build_mei: "computed",
  engrave: "computed",
  fix_skew: "manual",
  fix_layout: "manual",
  fix_metadata: "manual",
  fix_observations: "manual",
  human_review: "manual",
  fix_mei: "manual",
} as const satisfies Record<string, StageKind>;

export type StepId = keyof typeof STEP_KINDS;

// The planned stages, in order (docs/overview.md §6). New projects get all of them; Ingest is done from the start.
export const RECIPE = ["ingest", "rasterize", "skew_analysis", "layout", "analyze", "extract", "review", "apply_review", "build_mei", "engrave"] as const satisfies readonly StepId[];

// The steps of one kind, in the order of `STEP_KINDS`.
export function stepsOfKind<K extends StageKind>(kind: K): { [S in StepId]: (typeof STEP_KINDS)[S] extends K ? S : never }[StepId][] {
  return (Object.keys(STEP_KINDS) as StepId[]).filter((step) => STEP_KINDS[step] === kind) as never;
}
