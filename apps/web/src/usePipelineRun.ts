// Running the pipeline from the project view (docs/project-view.md; docs/database.md, "An interrupted run"): Run, and in
// Auto mode the stages after it; Finish of a manual stage; the carried manual stages kept or dropped at their turn;
// Stop; and, while this device runs a stage, the leave guard, the question before closing the tab and the wake lock.
// The run belongs to the project view: leaving the project gives it up.

import { useEffect, useRef, useState } from "react";
import { failure, failStage, fetchPipeline, finishStage, resolveStage, stopStage, type ApiPipeline, type Project } from "./api";
import { FINISHERS } from "./finishers";
import { settled } from "./saving";
import { canRun, currentStage, firstNotDone, ranToDone, toPipeline, type LocalRun, type Pipeline, type RunMode } from "./pipeline";
import { RUNNERS } from "./runners";
import { CannotStart, failsTheStage, LEAVING } from "./stageRunner";
import { useWakeLock } from "./wakeLock";
import { setRunningProject } from "./leaveGuard";
import { carriedInputs, stepInfo } from "./steps";
import { onImagesDiffer } from "./pageImages";
import { errorText } from "@score3ly/core";

// Finish while an edit couldn't be saved (docs/project-view.md, "Saving edits").
const UNSAVED_FINISH = "The stage can't be finished yet: some of your edits couldn't be saved. Retry saving them in the editor, then finish.";

export type PipelineRun = {
  local: LocalRun | null; // the stage this device is running, and how far it is
  run: (latest: ApiPipeline) => Promise<void>;
  finish: (stageId: string) => Promise<void>;
  stop: (pipeline: Pipeline) => Promise<void>;
};

export function usePipelineRun({
  project,
  stored,
  setStored,
  mode,
  setError,
  onChanged,
  quiet,
  scroll,
}: {
  project: Project;
  stored: ApiPipeline | null;
  setStored: (pipeline: ApiPipeline) => void;
  mode: RunMode;
  setError: (error: string | null) => void;
  onChanged: () => void; // the project itself changed
  quiet: () => void; // the user's own change: no toasts for a while
  scroll: () => void; // the panel scrolls to the current stage
}): PipelineRun {
  // The stage this device is running, and how to stop it.
  const [local, setLocal] = useState<LocalRun | null>(null);
  const controller = useRef<AbortController | null>(null);
  // The latest run mode, for a run that is already going when it changes.
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // Leaving the project gives up a run this device makes: the stage is released, failed as interrupted with its
  // outputs kept, and can run again at once (docs/database.md, "An interrupted run").
  useEffect(() => () => controller.current?.abort(LEAVING), [project.id]);

  // While this device runs a stage, closing or reloading the tab asks first: the run stops, and an LLM answer still
  // on its way is lost, although it is paid for. Browsers show their own text, not ours.
  const runningHere = local !== null;
  useEffect(() => {
    if (!runningHere) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [runningHere]);
  // And the screen stays on meanwhile, so that a phone doesn't go to sleep and pause the run.
  useWakeLock(runningHere);
  // Leaving the project inside the app asks first too (App.tsx): the run belongs to this view.
  useEffect(() => {
    setRunningProject(runningHere ? project.id : null);
    return () => setRunningProject(null);
  }, [runningHere, project.id]);

  // Finishes a WIP manual stage: what the step still has to record, then done. In Auto mode the pipeline carries on.
  const finishing = useRef(false);
  async function finish(stageId: string) {
    if (finishing.current) return;
    finishing.current = true;
    quiet();
    setError(null);
    try {
      // Every edit saved first (saving.ts), the text being typed too; one that couldn't be saved holds Finish back.
      if (!(await settled(stageId))) {
        setError(UNSAVED_FINISH);
        return;
      }
      const latest = await fetchPipeline(project);
      const stage = latest.stages.find((s) => s.id === stageId);
      if (!stage || stage.status !== "wip") return;
      const finisher = FINISHERS[stage.step];
      const note = finisher ? await finisher(project, stage, latest) : undefined;
      await finishStage(project, stageId, { status: "done", note });
      const next = await fetchPipeline(project);
      setStored(next);
      onChanged();
      if (modeRef.current === "auto") await run(next);
    } catch (err) {
      setError(failure("Finishing the stage failed", err));
    } finally {
      finishing.current = false;
    }
  }

  // A carried manual stage whose turn has come is kept or dropped at once, in both modes (docs/overview.md §5.5): kept if
  // what it would read now is what it read. One at a time; whoever asks while it is on gets the same answer. Returns
  // the new pipeline, or null if there was nothing to do (or it failed).
  const resolving = useRef<Promise<ApiPipeline | null> | null>(null);
  function resolveCarried(latest: ApiPipeline): Promise<ApiPipeline | null> {
    if (resolving.current) return resolving.current;
    // The first stage that isn't done (a carried one may be done, and still waits).
    const index = firstNotDone(latest.stages);
    const stage = latest.stages[index];
    if (!stage?.carried) return Promise.resolve(null);
    resolving.current = (async () => {
      try {
        const { pipeline } = await resolveStage(project, stage.id, carriedInputs(latest.stages, index));
        setStored(pipeline);
        onChanged();
        return pipeline;
      } catch (err) {
        setError(failure(`Checking "${stepInfo(stage.step).title}" failed`, err));
        return null;
      } finally {
        resolving.current = null;
      }
    })();
    return resolving.current;
  }
  useEffect(() => {
    if (stored && local === null) void resolveCarried(stored);
  }, [stored, local === null]);

  // Runs the stage whose turn it is, and in Auto mode the ones after it, until one fails, the user stops, or a
  // stage that can't run yet comes up. A carried manual stage on the way is kept or dropped first.
  async function run(latest: ApiPipeline) {
    const resolved = await resolveCarried(latest);
    if (resolved) return run(resolved);
    const shown = toPipeline(modeRef.current, latest);
    const current = currentStage(shown);
    if (!current || !canRun(shown)) return;
    const stage = latest.stages.find((s) => s.id === current.id)!;
    const runner = RUNNERS[stage.step];
    if (!runner) {
      setError(`"${current.title}" can't run yet: it isn't built.`);
      return;
    }
    setError(null);
    const abort = new AbortController();
    controller.current = abort;
    setLocal({ stageId: stage.id, progress: 0 });
    scroll();
    // Images this run makes that differ from the stored ones' fingerprints show on its card (§8.3).
    const unwatch = onImagesDiffer(() => setLocal((l) => l && { ...l, imagesDiffer: true }));
    try {
      await runner({
        project,
        stage,
        pipeline: latest,
        signal: abort.signal,
        progress: (fraction) => setLocal((l) => l && { ...l, progress: fraction }),
        item: (item) => setLocal((l) => l && { ...l, item }),
      });
    } catch (err) {
      // An error before the run's start (runPlan records the later ones): the stage's failure, shown on its card, unless
      // the user has to do something first (`CannotStart`) or the Worker refused the start.
      if (!abort.signal.aborted) {
        const message = errorText(err);
        if (!failsTheStage(err)) setError(err instanceof CannotStart ? `"${current.title}" can't run: ${message}` : message);
        else await failStage(project, stage.id, message).catch(() => setError(message));
      }
    } finally {
      unwatch();
      setLocal(null);
      controller.current = null;
    }
    if (abort.signal.aborted) return;
    let next: ApiPipeline;
    try {
      next = await fetchPipeline(project);
    } catch (err) {
      setError(failure("Loading the pipeline failed", err));
      return;
    }
    setStored(next);
    onChanged();
    if (ranToDone(latest.stages, stage.id, next.stages) && modeRef.current === "auto") await run(next);
  }

  // Stops the running stage (on this device, or another: the Worker stops it either way).
  async function stop(pipeline: Pipeline) {
    quiet();
    const running = pipeline.stages.find((s) => s.status === "running");
    if (!running) return;
    controller.current?.abort();
    try {
      setStored(await stopStage(project, running.id));
      onChanged();
    } catch (err) {
      setError(failure("Stopping the stage failed", err));
    }
  }

  return { local, run, finish, stop };
}
