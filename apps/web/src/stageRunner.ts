// Running a stage in the browser (DESIGN.md §5.5, §5.8): the step's code says what the stage's items are and how
// each is made; this does the rest. It starts the stage (or finds a finished one with the same key and stops
// there), skips the items a failed run already recorded, records each output as soon as it is made, reports
// progress, sends a heartbeat once a minute, and finishes the stage: done, or failed with the error.

import {
  finishStage,
  recordOutputs,
  sendHeartbeat,
  startStage,
  type ApiPipeline,
  type ApiStage,
  type NewOutput,
  type Project,
  type StageStart,
} from "./api";

export type StageRun = {
  project: Project;
  stage: ApiStage;
  pipeline: ApiPipeline; // the project's pipeline as stored, for the stage's inputs
  signal: AbortSignal; // aborted when the user stops the stage
  progress: (fraction: number) => void;
};

// A stage that can't start, e.g. a page selection beyond the PDF's last page. Nothing has been recorded.
export class CannotStart extends Error {}

export type StageItem = {
  item: string;
  type: string;
  make: () => Promise<Omit<NewOutput, "item" | "type">>;
};

export type StagePlan = StageStart & { items: StageItem[]; note: string };

const HEARTBEAT_MS = 60 * 1000;

export async function runPlan(run: StageRun, plan: StagePlan): Promise<void> {
  const { project, stage, signal } = run;
  const { items, note, ...start } = plan;
  const started = await startStage(project, stage.id, start);
  if (started.reused) return;
  // A failed or interrupted run's outputs stay: only the missing items are made.
  const recorded = new Set(stage.outputs.map((o) => `${o.type}\u0000${o.item}`));
  const heartbeat = setInterval(() => sendHeartbeat(project, stage.id).catch(() => {}), HEARTBEAT_MS);
  try {
    for (const [i, item] of items.entries()) {
      if (signal.aborted) return;
      if (!recorded.has(`${item.type}\u0000${item.item}`)) {
        const output = await item.make();
        if (signal.aborted) return;
        await recordOutputs(project, stage.id, [{ ...output, item: item.item, type: item.type }]);
      }
      run.progress((i + 1) / items.length);
    }
    if (!signal.aborted) await finishStage(project, stage.id, { status: "done", note });
  } catch (err) {
    if (signal.aborted) return;
    const message = err instanceof Error ? err.message : String(err);
    await finishStage(project, stage.id, { status: "failed", error: message }).catch(() => {});
  } finally {
    clearInterval(heartbeat);
  }
}
