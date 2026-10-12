// The project's pipeline as the UI shows it (DESIGN.md §5.6): its stages, first to last, each with its artifacts.
// Built from what the Worker stores (api.ts) and what the code declares about each step (steps.ts).

import type { ApiPipeline, ApiStage, RunMode } from "./api";
import { stepInfo } from "./steps.ts";

export type { RunMode } from "./api";

export type StageKind = "ingest" | "computed" | "llm" | "manual";

export type StageStatus =
  | "done"
  | "running"
  | "failed"
  | "wip" // a manual stage the user is working on, until they finish it
  | "ready" // its turn: it can run (in Manual mode, with its Run button)
  | "planned"; // not its turn yet: shown dimmed

export type ArtifactKind = "pdf" | "images" | "json" | "music";

// One tile in a stage's card: what the user sees of the stage's outputs (DESIGN.md §5.2). A group of similar
// items (e.g. all the system crops) is one artifact, which the artifact view shows one item after the other.
export type Artifact = {
  id: string; // unique within the project, used in the URL
  title: string;
  kind: ArtifactKind;
  count: number; // 1 for a single item
  item?: "Page" | "System"; // what each item of a group is
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
  progress: number; // from 0 to 1 while running; known only on the device that runs the stage
  artifacts: Artifact[]; // the first is the main one; shown once the stage is done (or while a manual one is worked on)
  config: Record<string, string>;
  fixes: string[]; // the manual stages that can be added after it, e.g. "Fix system boxes"
  droppable: boolean; // not part of the recipe (DESIGN.md §5.5)
};

export type Pipeline = { mode: RunMode; stages: Stage[] };

// Fractions from 0 to 1. `stage` is null while no stage is running.
export type Progress = { stage: number | null; pipeline: number };

// The pipeline as the Worker stores it, made ready to show. The first planned stage after the finished ones is
// the one whose turn it is: "ready".
export function toPipeline(mode: RunMode, stored: ApiPipeline): Pipeline {
  const stages = stored.stages.map(toStage);
  const next = stages.findIndex((stage) => stage.status !== "done");
  if (next >= 0 && stages[next].status === "planned") stages[next] = { ...stages[next], status: "ready" };
  return { mode, stages };
}

function toStage(stored: ApiStage): Stage {
  const info = stepInfo(stored.step);
  // Stopped stages aren't in a pipeline; if one shows up anyway, it can run again like a failed one.
  const status: StageStatus = stored.status === "stopped" ? "failed" : stored.status;
  const seconds =
    info.kind !== "ingest" && stored.startedAt && stored.finishedAt
      ? (Date.parse(stored.finishedAt) - Date.parse(stored.startedAt)) / 1000
      : undefined;
  return {
    id: stored.id,
    step: stored.stepVersion === null ? stored.step : `${stored.step}@${stored.stepVersion}`,
    title: info.title,
    kind: info.kind,
    status,
    seconds,
    note: stored.note ?? undefined,
    error: stored.error ?? undefined,
    progress: 0,
    artifacts: info.artifacts(stored),
    config: Object.fromEntries(
      Object.entries(stored.config ?? {}).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)]),
    ),
    fixes: info.fixes,
    droppable: info.kind === "manual" || info.optional,
  };
}

export function hasArtifacts(stage: Stage): boolean {
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

// What the artifact view shows when the user hasn't picked anything: the latest stage's main artifact.
export function defaultArtifactId(pipeline: Pipeline): string | null {
  const stage = pipeline.stages.filter(hasArtifacts).at(-1);
  return stage?.artifacts[0]?.id ?? null;
}

export function findArtifact(pipeline: Pipeline, artifactId: string): { stage: Stage; artifact: Artifact } | null {
  for (const stage of pipeline.stages) {
    if (!hasArtifacts(stage)) continue;
    const artifact = stage.artifacts.find((a) => a.id === artifactId);
    if (artifact) return { stage, artifact };
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
