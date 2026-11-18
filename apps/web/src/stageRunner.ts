// Running a stage in the browser (docs/overview.md §5.5, docs/database.md): the step's code says what the stage's items are and how
// each is made; this does the rest. It starts the stage (or finds a finished one with the same key and stops
// there), skips the items a failed run already recorded, records each output as soon as it is made, with how long the
// item took and what it found in the caches (itemTiming.ts), reports progress, sends a heartbeat once a minute, and
// finishes the stage: done, or failed with the error.

import {
  fetchJsonContent,
  finishStage,
  recordOutputs,
  sendHeartbeat,
  startStage,
  type ApiPipeline,
  type ApiStage,
  type NewOutput,
  type Project,
  type StageStart,
} from "./api.ts";
import { timed } from "./itemTiming.ts";
import type { ItemProgress } from "./callProgress.ts";
import { errorText } from "@score3ly/core";

export type StageRun = {
  project: Project;
  stage: ApiStage;
  pipeline: ApiPipeline; // the project's pipeline as stored, for the stage's inputs
  signal: AbortSignal; // aborted when the user stops the stage
  progress: (fraction: number) => void;
  item?: (item: ItemProgress) => void; // the item it works on, and the characters received for it (callProgress.ts)
};

// A stage that can't start, e.g. a page selection beyond the PDF's last page. Nothing has been recorded.
export class CannotStart extends Error {}

export type StageItem = {
  item: string;
  type: string;
  make: () => Promise<Omit<NewOutput, "item" | "type" | "timing">>;
};

// One of the stage's outputs once its items are done: made in this run, or recorded by an earlier one that failed or
// was interrupted.
export type FinalOutput = { item: string; type: string; contentSha256: string | null; recipe: unknown };

// The note is the card's short result, e.g. "12 pages": text, or computed once the items are done, from the stage's
// final outputs (all of them, not only this run's: a resumed run makes only the missing items).
export type StagePlan = StageStart & { items: StageItem[]; note: string | ((outputs: FinalOutput[]) => string | Promise<string>) };

// The stored JSON of the outputs of one type, in their order: from `made` (what this run made, by item) where it is
// there, else fetched.
export function contentsOf<T>(outputs: FinalOutput[], type: string, made: ReadonlyMap<string, T>): Promise<T[]> {
  return Promise.all(
    outputs
      .filter((o) => o.type === type)
      .map(async (o) => made.get(o.item) ?? ((await fetchJsonContent(o.contentSha256!)) as T)),
  );
}

const HEARTBEAT_MS = 60 * 1000;

export async function runPlan(run: StageRun, plan: StagePlan): Promise<void> {
  const { project, stage, signal } = run;
  const { items, note, ...start } = plan;
  const started = await startStage(project, stage.id, start);
  if (started.reused) return;
  const { runId } = started;
  // A failed or interrupted run's outputs stay: only the missing items are made. Unless that run had another key (the
  // app was updated meanwhile): then the Worker dropped them, and every item is made again.
  const recorded = new Map(started.keptOutputs ? stage.outputs.map((o) => [`${o.type}\u0000${o.item}`, o]) : []);
  const final: FinalOutput[] = [];
  const heartbeat = setInterval(() => sendHeartbeat(project, stage.id, runId).catch(() => {}), HEARTBEAT_MS);
  try {
    for (const [i, item] of items.entries()) {
      if (signal.aborted) return;
      const earlier = recorded.get(`${item.type}\u0000${item.item}`);
      if (earlier) final.push(earlier);
      else {
        run.item?.({ item: item.item, chars: null });
        const { value: output, timing } = await timed(item.make);
        if (signal.aborted) return;
        await recordOutputs(project, stage.id, [{ ...output, item: item.item, type: item.type, timing }], runId);
        final.push({ item: item.item, type: item.type, contentSha256: output.contentSha256 ?? null, recipe: output.recipe ?? null });
      }
      run.progress((i + 1) / items.length);
    }
    if (!signal.aborted) {
      const text = typeof note === "function" ? await note(final) : note;
      if (!signal.aborted) await finishStage(project, stage.id, { status: "done", note: text }, runId);
    }
  } catch (err) {
    if (signal.aborted) return;
    const message = errorText(err);
    await finishStage(project, stage.id, { status: "failed", error: message }, runId).catch(() => {});
  } finally {
    clearInterval(heartbeat);
  }
}
