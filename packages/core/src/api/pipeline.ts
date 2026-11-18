// A project's pipeline as the Worker's API sends it (`GET /api/projects/<id>/pipeline`, and the answers of the requests
// that change it): the stages as stored, in order, with their outputs (docs/database.md).

// A stage's status in a pipeline. A stored stage can also be "stopped", but a stopped stage has left the pipeline (a
// planned copy took its place), so a pipeline never holds one.
export type StageStatus = "planned" | "running" | "failed" | "done" | "wip";

export type Pipeline = { stages: Stage[]; dropped: Dropped[] };

// A manual stage dropped at its turn because its inputs changed (docs/overview.md §5.5): a card where it was, after the
// stage with `afterStageId`, until dismissed. Several after the same stage are in the order they were dropped.
export type Dropped = { id: number; afterStageId: string; step: string };

// What a stage's card shows of its model config: its name, model, whether it was deleted, and whether the app no longer
// supports it (docs/llm.md, "No longer supported").
export type StageModelConfig = { name: string; model: string; deleted: boolean; unsupported: boolean };

export type Stage = {
  id: string;
  step: string; // the step's id (`StepId`); its kind and title are declared in code
  stepVersion: number | null; // set when the stage starts
  status: StageStatus;
  config: Record<string, unknown> | null; // the step's config: null while planned with the defaults
  pageCount: number | null; // the pages its inputs cover, set when it starts
  error: string | null;
  note: string | null;
  startedAt: string | null;
  heartbeatAt: string | null; // written once a minute while running
  // A running stage whose heartbeat stopped, or a failed one whose run was given up when its project was left (released;
  // docs/database.md, "An interrupted run"): decided by the Worker, on its clock, when it read the pipeline. It can run
  // again.
  interrupted: boolean;
  finishedAt: string | null;
  // Its run time (decided 2026-11-17): the summed time of its runs, each from its start to its end (or to its last
  // heartbeat, interrupted), in milliseconds. Null for a stage that never ran: planned, manual, Ingest.
  runMs: number | null;
  modelConfig: StageModelConfig | null; // LLM stages: the model config it names
  costUsd: number | null; // what its LLM calls cost, VAT included (docs/llm.md, "VAT")
  // A manual stage carried through a re-run, waiting for its turn to be kept or dropped (docs/overview.md §5.5).
  carried: boolean;
  // Part of the recipe, or added by the user (a further review and its `apply_review`, a manual stage).
  inRecipe: boolean;
  outputs: Output[];
};

export type Output = {
  id: string;
  item: string; // '' for the whole score, 'p3' for a page, 'p3/s2' for a system on it
  type: string; // e.g. 'pdf', 'page_image'
  contentSha256: string | null; // stored content, in R2
  recipeKey: string | null; // computed images: the hash of the recipe
  recipe: unknown; // computed images: the recipe
};

// The answers of the requests that run and change stages (apps/worker/src/pipeline.ts).
// `start`: the stage started, with the id of this run, which the run's outputs, heartbeats and end send
// (docs/database.md, "An interrupted run"), and whether an earlier run's outputs were kept for it to resume from (not
// when that run had another stage key); or a finished stage with the same key took its place (`reused`, its id).
export type StartAnswer = { reused: false; stageId: string; runId: string; keptOutputs: boolean } | { reused: true; stageId: string };
// `outputs`: the recorded outputs' ids, in the order they were sent.
export type OutputsAnswer = { ids: string[] };
// `fix`, `review`, `human-review`, `edit`: the new stage and the pipeline with it.
export type AddedStage = { stageId: string; pipeline: Pipeline };
// `resolve`: whether the carried stage was kept, and the pipeline.
export type Resolved = { kept: boolean; pipeline: Pipeline };
