// The project's pipeline as the UI shows it (DESIGN.md §5.6): its stages, first to last, each with its artifacts.
// Built from what the Worker stores (api.ts) and what the code declares about each step (steps.ts).

import type { ApiPipeline, ApiStage, RunMode } from "./api";
import type { PageRecipe } from "./rasterize.ts";
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
  // Page images: what each one is made from, and, for lines drawn over it, the stored lines (a PageSkew).
  // With `layoutSha256`, the stored layout (a PageLayout): the page straightened as it says, with its boxes.
  // `item` and `parentId` (the output a manual stage corrects) are there for an editor.
  pages?: { page: number; recipe: PageRecipe; linesSha256?: string; layoutSha256?: string; item?: string; parentId?: string }[];
  editor?: { stageId: string; step: string }; // a WIP manual stage's artifact: shown as its step's editor
  // `analyze`'s metadata or observations: the stored JSON, shown as a view with links into the pages (`pages`).
  // `parents`: for the forms of `fix_metadata` and `fix_observations`, the outputs of `analyze` they correct.
  analysis?: { view: "metadata" | "observations"; sha256: string; parents?: { metadata?: string; pieces?: string; observations?: string } };
};

export type Stage = {
  id: string; // unique within the project, used in the URL
  stepId: string;
  step: string; // step id@version
  title: string;
  kind: StageKind;
  status: StageStatus;
  model?: string; // LLM stages: the model config's name, else its model string (DESIGN.md §7.2)
  seconds?: number; // run time, once done
  cost?: number; // US dollars, LLM stages once done
  note?: string; // one short fact about the result, e.g. "3 boxes moved"
  error?: string; // failed stages
  progress: number; // from 0 to 1 while running; known only on the device that runs the stage
  artifacts: Artifact[]; // the first is the main one; shown once the stage is done (or while a manual one is worked on)
  config: Record<string, string>;
  fixes: { step: string; title: string }[]; // the manual stages that can be added after it, e.g. "Fix skew"
  droppable: boolean; // not part of the recipe (DESIGN.md §5.5)
};

export type Pipeline = { mode: RunMode; stages: Stage[] };

export const MODES: RunMode[] = ["auto", "manual"];
export const MODE_LABELS: Record<RunMode, string> = { auto: "Auto", manual: "Manual" };

// Fractions from 0 to 1. `stage` is null while no stage is running.
export type Progress = { stage: number | null; pipeline: number };

// A running stage whose heartbeat is older than this was interrupted (the app was closed): it can run again
// (DESIGN.md §5.8). The same limit as the Worker's.
export const STALE_MS = 3 * 60 * 1000;

// The stage this device is running, and how far it is: only the device that runs a stage knows (§5.1).
export type LocalRun = { stageId: string; progress: number };

// The pipeline as the Worker stores it, made ready to show. The first planned stage after the finished ones is
// the one whose turn it is: "ready". A stage running elsewhere shows no progress; one whose heartbeat stopped
// counts as failed, and can run again.
export function toPipeline(mode: RunMode, stored: ApiPipeline, local: LocalRun | null = null, now = Date.now()): Pipeline {
  const stages = stored.stages.map((s, i) => {
    const stage = toStage(s, stored.stages.slice(0, i), fixesAfter(stored.stages, i));
    if (local?.stageId === s.id) return { ...stage, status: "running" as const, progress: local.progress };
    if (s.status === "running" && (s.heartbeatAt === null || now - Date.parse(s.heartbeatAt) > STALE_MS)) {
      return { ...stage, status: "failed" as const, error: "Interrupted: the app was closed while this stage ran." };
    }
    return stage;
  });
  const next = stages.findIndex((stage) => stage.status !== "done");
  if (next >= 0 && stages[next].status === "planned") stages[next] = { ...stages[next], status: "ready" };
  return { mode, stages };
}

// The manual stages right after stage `i`: a fix of that stage goes after them (the Worker puts it there), and one
// already among them isn't offered again (DESIGN.md §6).
function fixesAfter(stages: ApiStage[], i: number): ApiStage[] {
  const after = stages.slice(i + 1);
  const end = after.findIndex((s) => stepInfo(s.step).kind !== "manual");
  return end < 0 ? after : after.slice(0, end);
}

function toStage(stored: ApiStage, earlier: ApiStage[], following: ApiStage[]): Stage {
  const info = stepInfo(stored.step);
  // Stopped stages aren't in a pipeline; if one shows up anyway, it can run again like a failed one.
  const status: StageStatus = stored.status === "stopped" ? "failed" : stored.status;
  const seconds =
    info.kind !== "ingest" && stored.startedAt && stored.finishedAt
      ? (Date.parse(stored.finishedAt) - Date.parse(stored.startedAt)) / 1000
      : undefined;
  return {
    id: stored.id,
    stepId: stored.step,
    step: stored.stepVersion === null ? stored.step : `${stored.step}@${stored.stepVersion}`,
    title: info.title,
    kind: info.kind,
    status,
    seconds,
    model: stored.modelConfig ? (stored.modelConfig.name ?? stored.modelConfig.model) : undefined,
    cost: stored.costUsd ?? undefined,
    note: stored.note ?? undefined,
    error: stored.error ?? undefined,
    progress: 0,
    artifacts: info.artifacts(stored, earlier),
    config: Object.fromEntries(
      Object.entries(stored.config ?? {}).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)]),
    ),
    fixes: info.fixes.filter((step) => !following.some((s) => s.step === step)).map((step) => ({ step, title: stepInfo(step).title })),
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
