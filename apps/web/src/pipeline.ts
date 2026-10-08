// The project's pipeline as the UI shows it (DESIGN.md §5.6): its stages, first to last, each with the outputs it
// produced. For now the stages are mock data (mockPipeline.ts), to design the UI before the real ones exist; the
// types are a first guess at what the real data will look like.

export type StageKind = "computed" | "llm" | "manual";

export type StageStatus =
  | "done"
  | "running"
  | "failed"
  | "wip" // a manual stage the user is working on, until they finish it
  | "ready" // its turn: it can run (in Manual mode, with its Run button)
  | "planned"; // not its turn yet: shown dimmed

export type OutputKind = "pdf" | "images" | "json" | "lilypond";

// One tile in a stage's card: a single artifact, or a group of similar ones (e.g. all the system crops), which
// the artifact view shows one after the other.
export type Output = {
  id: string; // unique within the project, used in the URL
  title: string;
  kind: OutputKind;
  count: number; // 1 for a single artifact
  item?: "Page" | "System"; // what each artifact of a group is
};

export type Stage = {
  id: string; // unique within the project, used in the URL
  step: string; // step id@version
  title: string;
  kind: StageKind;
  status: StageStatus;
  model?: string; // LLM stages
  seconds?: number; // run time, once done
  cost?: number; // US dollars, LLM stages once done
  note?: string; // one short fact about the result, e.g. "3 boxes moved"
  error?: string; // failed stages
  progress: number; // from 0 to 1 while running
  outputs: Output[]; // the first is the main one; shown once the stage is done (or while a manual one is worked on)
  config: Record<string, string>;
  fixes: string[]; // the manual stages that can be added after it, e.g. "Fix system boxes"
};

export type RunMode = "auto" | "manual";

export type Pipeline = { mode: RunMode; stages: Stage[] };

// Fractions from 0 to 1. `stage` is null while no stage is running.
export type Progress = { stage: number | null; pipeline: number };

export function hasOutputs(stage: Stage): boolean {
  return stage.status === "done" || stage.status === "wip";
}

export function runningStage(pipeline: Pipeline): Stage | null {
  return pipeline.stages.find((stage) => stage.status === "running") ?? null;
}

// The stage where the pipeline is: the first one that isn't done, or else the last one. The panel scrolls to it.
export function currentStage(pipeline: Pipeline): Stage | null {
  return pipeline.stages.find((stage) => stage.status !== "done") ?? pipeline.stages.at(-1) ?? null;
}

// Whether the pipeline can be started (or resumed) from where it is.
export function canRun(pipeline: Pipeline): boolean {
  const current = currentStage(pipeline);
  return current !== null && (current.status === "ready" || current.status === "failed");
}

// What the artifact view shows when the user hasn't picked anything: the latest stage's main output.
export function defaultOutputId(pipeline: Pipeline): string | null {
  const stage = pipeline.stages.filter(hasOutputs).at(-1);
  return stage?.outputs[0]?.id ?? null;
}

export function findOutput(pipeline: Pipeline, outputId: string): { stage: Stage; output: Output } | null {
  for (const stage of pipeline.stages) {
    if (!hasOutputs(stage)) continue;
    const output = stage.outputs.find((o) => o.id === outputId);
    if (output) return { stage, output };
  }
  return null;
}

export function findStage(pipeline: Pipeline, stageId: string): Stage | null {
  return pipeline.stages.find((stage) => stage.id === stageId) ?? null;
}

// The running stage counts with its own progress. The total is a best guess: manual stages and extra review
// rounds add stages, so a change only moves the indicator a little (DESIGN.md §5.6).
export function progressOf(pipeline: Pipeline): Progress {
  const { stages } = pipeline;
  if (stages.length === 0) return { stage: null, pipeline: 0 };
  const done = stages.filter((stage) => stage.status === "done").length;
  const running = runningStage(pipeline);
  return { stage: running?.progress ?? null, pipeline: (done + (running?.progress ?? 0)) / stages.length };
}
