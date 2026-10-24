import { useEffect, useRef, useState } from "react";
import {
  addFixStage,
  dismissDropped,
  dropStage,
  editStage,
  fetchPipeline,
  finishStage,
  resolveStage,
  setRunMode,
  setStageConfig,
  stopStage,
  type ApiPipeline,
  type Project,
} from "./api";
import { FINISHERS } from "./finishers";
import { ArtifactContent, ArtifactView } from "./ArtifactView";
import { ConfirmDialog } from "./ConfirmDialog";
import { ExpandIcon } from "./icons";
import {
  currentStage,
  defaultArtifactId,
  findArtifact,
  findStage,
  nextStaleAt,
  progressOf,
  toPipeline,
  type LocalRun,
  type Pipeline,
  type RunMode,
  type Stage,
} from "./pipeline";
import { PipelinePanel, type PanelActions } from "./PipelinePanel";
import { ProgressRing } from "./ProgressRing";
import { ConfigDialog } from "./ConfigDialog";
import { RUNNERS } from "./runners";
import { CannotStart } from "./stageRunner";
import { useWakeLock } from "./wakeLock";
import { carriedInputs, FIX_STARTS, stepInfo, type ConfigContext } from "./steps";
import { onImagesDiffer, openPdfForImages } from "./pageImages";
import { download } from "./downloads";
import { StageDetails } from "./StageDetails";
import { useWide } from "./useWide";

const COLLAPSED_KEY = "pipelinePanelCollapsed";

// What the user must know before stages that already ran are replaced (DESIGN.md §5.5).
// The confirmation before a change that replaces stages that have run (DESIGN.md §5.5): the same text for every
// change, a sentence before it for a new config, the button naming the change.
const CONFIRM_TEXT =
  "Later pipeline stages may have to run again (if their inputs change). Manual fixes for later stages will be kept if their inputs stay the same, and dropped otherwise. This action cannot be undone.";

type Confirmation = { title: string; text: string[]; confirmLabel: string; action: () => void };

// Wide mode: the pipeline panel on the left (collapsible to a narrow strip), the artifact view on the right.
// Narrow mode: only the pipeline; an output or a stage's details the user picks covers the whole app until closed.
export function ProjectView({
  project,
  artifactId,
  stageId,
  onSelectArtifact,
  onShowStage,
  onCloseArtifact,
  onRename,
  onDelete,
  onChanged,
}: {
  project: Project;
  artifactId: string | null; // picked by the user (it's in the URL), or null
  stageId: string | null; // the stage whose details the user picked (in the URL), or null
  onSelectArtifact: (artifactId: string) => void;
  onShowStage: (stageId: string) => void;
  onCloseArtifact: () => void;
  onRename: () => void;
  onDelete: () => void;
  onChanged: () => void; // the project itself changed (e.g. its run mode)
}) {
  const wide = useWide();
  const [collapsed, setCollapsed] = useState(() => readFlag(COLLAPSED_KEY));
  const [mode, setMode] = useState<RunMode>(project.runMode);
  // null while loading.
  const [stored, setStored] = useState<ApiPipeline | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The stage this device is running, and how to stop it.
  const [local, setLocal] = useState<LocalRun | null>(null);
  const controller = useRef<AbortController | null>(null);
  // The latest run mode, for a run that is already going when it changes.
  const modeRef = useRef(mode);
  modeRef.current = mode;
  // The stage whose config is being edited.
  const [configuring, setConfiguring] = useState<{ stage: Stage; context: ConfigContext } | null>(null);
  const pipeline: Pipeline = stored ? toPipeline(mode, stored, local) : { mode, stages: [], dropped: [] };
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  // The panel scrolls to the current stage on opening the project, when an Auto run starts, and whenever
  // another stage becomes the current one (in both modes).
  const [scrollRequest, setScrollRequest] = useState(0);
  const scroll = () => setScrollRequest((n) => n + 1);
  const progress = progressOf(pipeline);
  const currentId = currentStage(pipeline)?.id;

  useEffect(() => {
    fetchPipeline(project).then(setStored, (err) => setError(`Loading the pipeline failed: ${err}`));
    // Leaving the project stops nothing on the server: a stage this device ran counts as interrupted once its
    // heartbeat is old, and can run again (DESIGN.md §5.8).
    return () => controller.current?.abort();
  }, [project.id]);

  // A stage running on another device turns "Interrupted" once its heartbeat is too old: the pipeline is fetched
  // again then, in case one came meanwhile.
  useEffect(() => {
    const at = stored ? nextStaleAt(stored, local) : null;
    if (at === null) return;
    const timer = setTimeout(() => {
      fetchPipeline(project).then(setStored, () => setStored((s) => (s ? { ...s } : s)));
    }, at - Date.now());
    return () => clearTimeout(timer);
  }, [stored, local?.stageId]);

  useEffect(() => {
    scroll();
  }, [currentId]);

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

  // An ID that doesn't exist (an old or edited URL, or a replaced stage) counts as no pick.
  const pickedArtifact = artifactId === null ? null : findArtifact(pipeline, artifactId);
  const pickedStage = stageId === null ? null : findStage(pipeline, stageId);
  const fallbackId = defaultArtifactId(pipeline);
  const shownArtifact = pickedArtifact ?? (fallbackId === null ? null : findArtifact(pipeline, fallbackId));

  // Narrow mode: what was last looked at stays selected after it is closed.
  const [lastPicked, setLastPicked] = useState<{ artifactId: string | null; stageId: string | null }>({
    artifactId: null,
    stageId: null,
  });
  const pickedArtifactId = pickedArtifact?.artifact.id ?? null;
  const pickedStageId = pickedStage?.id ?? null;
  useEffect(() => {
    if (pickedArtifactId !== null || pickedStageId !== null) {
      setLastPicked({ artifactId: pickedArtifactId, stageId: pickedStageId });
    }
  }, [pickedArtifactId, pickedStageId]);

  function collapse(value: boolean) {
    setCollapsed(value);
    writeFlag(COLLAPSED_KEY, value);
  }

  // Asks first if the change replaces stages that have already run (DESIGN.md §5.5).
  function change(apply: () => void, ask: boolean, confirmLabel: string, before = "") {
    if (!ask) return apply();
    setConfirmation({ title: "Are you sure?", text: [`${before}${CONFIRM_TEXT}`], confirmLabel, action: apply });
  }

  // Whether a change at this stage replaces stages that have already run: the stage itself, or one after it.
  function replacesWork(stageId: string): boolean {
    const i = pipeline.stages.findIndex((stage) => stage.id === stageId);
    return pipeline.stages.slice(i).some((stage) => stage.status !== "planned" && stage.status !== "ready");
  }

  // Whether a change right after this stage replaces stages that have already run.
  function replacesLater(stageId: string): boolean {
    const i = pipeline.stages.findIndex((stage) => stage.id === stageId);
    return i >= 0 && i + 1 < pipeline.stages.length && replacesWork(pipeline.stages[i + 1].id);
  }

  // Whether adding a fix after this stage replaces stages that have already run: the fix goes after the manual
  // stages that already follow it, which stay (DESIGN.md §6).
  function fixReplaces(stageId: string): boolean {
    let j = pipeline.stages.findIndex((stage) => stage.id === stageId) + 1;
    if (j <= 0) return false;
    while (j < pipeline.stages.length && pipeline.stages[j].kind === "manual") j++;
    return j < pipeline.stages.length && replacesWork(pipeline.stages[j].id);
  }

  // A new WIP manual stage: its editor opens.
  function opened(result: { stageId: string; pipeline: ApiPipeline }) {
    setStored(result.pipeline);
    onChanged();
    const stage = toPipeline(mode, result.pipeline).stages.find((s) => s.id === result.stageId);
    const artifact = stage?.artifacts[0];
    if (artifact) onSelectArtifact(artifact.id);
  }

  async function addFix(afterId: string, step: string) {
    const index = stored?.stages.findIndex((s) => s.id === afterId) ?? -1;
    const start = FIX_STARTS[step];
    if (!stored || index < 0 || !start) return;
    try {
      opened(await addFixStage(project, afterId, { step, ...start(stored.stages[index], stored.stages.slice(0, index + 1)) }));
    } catch (err) {
      setError(`Adding the stage failed: ${err}`);
    }
  }

  async function edit(stageId: string) {
    try {
      opened(await editStage(project, stageId));
    } catch (err) {
      setError(`Editing the stage failed: ${err}`);
    }
  }

  async function drop(stageId: string) {
    try {
      setStored(await dropStage(project, stageId));
      onChanged();
      scroll();
    } catch (err) {
      setError(`Dropping the stage failed: ${err}`);
    }
  }

  async function dismiss(id: number) {
    try {
      setStored(await dismissDropped(project, id));
    } catch (err) {
      setError(`Dismissing the card failed: ${err}`);
    }
  }

  // Finishes a WIP manual stage: what the step still has to record, then done. In Auto mode the pipeline carries on.
  const finishing = useRef(false);
  async function finish(stageId: string) {
    if (finishing.current) return;
    finishing.current = true;
    setError(null);
    try {
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
      setError(`Finishing the stage failed: ${err}`);
    } finally {
      finishing.current = false;
    }
  }

  // A carried manual stage whose turn has come is kept or dropped at once, in both modes (DESIGN.md §5.5): kept if
  // what it would read now is what it read. One at a time; whoever asks while it is on gets the same answer. Returns
  // the new pipeline, or null if there was nothing to do (or it failed).
  const resolving = useRef<Promise<ApiPipeline | null> | null>(null);
  function resolveCarried(latest: ApiPipeline): Promise<ApiPipeline | null> {
    if (resolving.current) return resolving.current;
    // The first stage that isn't done (a carried one may be done, and still waits).
    const index = latest.stages.findIndex((s) => s.carried || s.status !== "done");
    const stage = latest.stages[index];
    if (!stage?.carried) return Promise.resolve(null);
    resolving.current = (async () => {
      try {
        const { pipeline } = await resolveStage(project, stage.id, carriedInputs(latest.stages, index));
        setStored(pipeline);
        onChanged();
        return pipeline;
      } catch (err) {
        setError(`Checking "${stepInfo(stage.step).title}" failed: ${err}`);
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
    const current = currentStage(toPipeline(modeRef.current, latest));
    if (!current || (current.status !== "ready" && current.status !== "failed")) return;
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
      });
    } catch (err) {
      if (!abort.signal.aborted) {
        const message = err instanceof Error ? err.message : String(err);
        setError(err instanceof CannotStart ? `"${current.title}" can't run: ${message}` : message);
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
      setError(`Loading the pipeline failed: ${err}`);
      return;
    }
    setStored(next);
    onChanged();
    const position = latest.stages.indexOf(stage);
    const finished = next.stages[position]?.status === "done";
    if (finished && modeRef.current === "auto") await run(next);
  }

  async function stop() {
    const running = pipeline.stages.find((s) => s.status === "running");
    if (!running) return;
    controller.current?.abort();
    try {
      setStored(await stopStage(project, running.id));
      onChanged();
    } catch (err) {
      setError(`Stopping the stage failed: ${err}`);
    }
  }

  async function saveConfig(stage: Stage, config: unknown) {
    try {
      setStored(await setStageConfig(project, stage.id, config));
      onChanged();
      scroll();
    } catch (err) {
      setError(`Changing the config failed: ${err}`);
    }
  }

  // Fetches the pipeline again, e.g. after an editor saved a page. Errors don't matter: the next fetch catches up.
  function refresh() {
    fetchPipeline(project).then(setStored, () => {});
  }

  const actions: PanelActions = {
    selectArtifact: onSelectArtifact,
    showDetails: onShowStage,
    run: () => stored && run(stored),
    stop,
    finish: (id) => void finish(id),
    changeConfig: (id) => {
      const stage = findStage(pipeline, id);
      if (stage && stepInfo(stage.stepId).config) {
        // The PDF's page count, to check a page selection before saving. Unknown if the PDF can't be opened here.
        openPdfForImages(project.pdfSha256).then(
          ({ pageCount }) => setConfiguring({ stage, context: { pageCount } }),
          () => setConfiguring({ stage, context: { pageCount: null } }),
        );
      }
      else setError(`"${stage?.title}" has nothing to set.`);
    },
    addFix: (id, step) => change(() => void addFix(id, step), fixReplaces(id), "Add stage"),
    edit: (id) => change(() => void edit(id), replacesLater(id), "Edit stage"),
    // `engrave`'s files (§6, `engrave`, "Downloads"), with the report on the pipeline up to the stage.
    download: async (stageId, kind) => {
      const engraving = findStage(pipeline, stageId)?.artifacts.find((a) => a.engraving)?.engraving;
      const position = stored?.stages.findIndex((s) => s.id === stageId) ?? -1;
      if (!engraving || !stored || position < 0) return;
      try {
        await download(kind, project, stored.stages.slice(0, position + 1), engraving);
      } catch (err) {
        setError(`The download failed: ${err instanceof Error ? err.message : err}`);
      }
    },
    // Always asks: the stage's own work is lost.
    drop: (id) => change(() => void drop(id), true, "Drop stage"),
    dismissDropped: (id) => void dismiss(id),
    setMode: async (value) => {
      const previous = mode;
      setMode(value);
      try {
        await setRunMode(project, value);
        onChanged();
      } catch (err) {
        setMode(previous);
        setError(`Changing the run mode failed: ${err}`);
      }
    },
  };

  const configForm = configuring ? stepInfo(configuring.stage.stepId).config : undefined;
  const configDialog = configuring && configForm && (
    <ConfigDialog
      title={configuring.stage.title}
      config={configForm}
      values={configForm.read(stored?.stages.find((s) => s.id === configuring.stage.id)?.config ?? null)}
      context={configuring.context}
      onSave={(values) => {
        const { stage } = configuring;
        // No manual stage has a config: if one ever has, this text must change (§5.5).
        change(() => saveConfig(stage, values), replacesWork(stage.id), "Change config", "This stage will have to run again with the new config. ");
      }}
      onCancel={() => setConfiguring(null)}
    />
  );

  const dialog = confirmation && (
    <ConfirmDialog
      title={confirmation.title}
      text={confirmation.text}
      confirmLabel={confirmation.confirmLabel}
      onConfirm={() => {
        setConfirmation(null);
        confirmation.action();
      }}
      onCancel={() => setConfirmation(null)}
    />
  );

  const panel = (selectedArtifactId: string | null, detailsStageId: string | null, onCollapse?: () => void) => (
    <PipelinePanel
      project={project}
      pipeline={pipeline}
      progress={progress}
      selectedArtifactId={selectedArtifactId}
      detailsStageId={detailsStageId}
      scrollRequest={scrollRequest}
      actions={actions}
      onCollapse={onCollapse}
      onRename={onRename}
      onDelete={onDelete}
      error={error}
    />
  );

  if (!wide) {
    const selected =
      pickedArtifact || pickedStage ? { artifactId: pickedArtifactId, stageId: pickedStageId } : lastPicked;
    return (
      <div className="project-view narrow">
        {panel(selected.artifactId, selected.stageId)}
        {pickedStage ? (
          <ArtifactView label={`${pickedStage.title}: details`} onClose={onCloseArtifact}>
            <StageDetails stage={pickedStage} />
          </ArtifactView>
        ) : (
          pickedArtifact && (
            <ArtifactView label={pickedArtifact.artifact.title} onClose={onCloseArtifact}>
              <ArtifactContent project={project} artifact={pickedArtifact.artifact} onEdited={refresh} />
            </ArtifactView>
          )
        )}
        {dialog}
        {configDialog}
      </div>
    );
  }

  return (
    <div className={collapsed ? "project-view wide collapsed" : "project-view wide"}>
      <aside className="side">
        {collapsed ? (
          <div className="strip">
            <button
              type="button"
              className="icon-button"
              aria-label="Expand the pipeline"
              title="Expand the pipeline"
              onClick={() => collapse(false)}
            >
              <ExpandIcon />
            </button>
            <div className="strip-progress">
              <ProgressRing value={progress.pipeline} label="Pipeline" size={28} />
              <span>Pipeline</span>
            </div>
            {progress.stage !== null && (
              <div className="strip-progress">
                <ProgressRing value={progress.stage} label="Stage" size={28} />
                <span>Stage</span>
              </div>
            )}
          </div>
        ) : (
          panel(pickedStage ? null : (shownArtifact?.artifact.id ?? null), pickedStage?.id ?? null, () => collapse(true))
        )}
      </aside>
      {pickedStage ? (
        <ArtifactView label={`${pickedStage.title}: details`}>
          <StageDetails stage={pickedStage} />
        </ArtifactView>
      ) : (
        shownArtifact && (
          <ArtifactView label={shownArtifact.artifact.title}>
            <ArtifactContent project={project} artifact={shownArtifact.artifact} onEdited={refresh} />
          </ArtifactView>
        )
      )}
      {dialog}
      {configDialog}
    </div>
  );
}

// A remembered per-browser preference. Storage may be unavailable (private mode), so failures are ignored.
function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // Not remembered, then.
  }
}
