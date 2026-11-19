import { useEffect, useState } from "react";
import {
  failure,
  addFixStage,
  addHumanReviewStage,
  addReviewStage,
  dismissDropped,
  dropStage,
  editStage,
  fetchModelConfig,
  fetchModelConfigs,
  fetchPipeline,
  setRunMode,
  setStageConfig,
  type ApiPipeline,
  type Project,
} from "./api";
import { ArtifactContent, ArtifactView } from "./ArtifactView";
import { ConfirmDialog } from "./ConfirmDialog";
import { CheckIcon, ChevronRightIcon, PauseIcon, WarningIcon } from "./ui/icons";
import {
  asksFirst,
  currentStage,
  defaultArtifactId,
  findArtifact,
  findStage,
  pipelineState,
  progressOf,
  stateLabel,
  toPipeline,
  type Pipeline,
  type Progress,
  type RerunChange,
  type RunMode,
  type Stage,
} from "./pipeline";
import { PipelinePanel, type PanelActions } from "./PipelinePanel";
import { ProgressRing } from "./ui/ProgressRing";
import { ConfigDialog } from "./ConfigDialog";
import { FIX_STARTS, stepInfo, type ConfigContext } from "./steps";
import { humanReviewStart } from "./humanReview";
import { openPdfForImages } from "./pageImages";
import { download } from "./downloads";
import { StageDetails } from "./StageDetails";
import { snapshotOf } from "./toasts";
import { useQuietTime, useToasts } from "./useToasts";
import { usePipelineRun } from "./usePipelineRun";
import { useWide } from "./useWide";
import { DEVICE_KEYS, readDevice, writeDevice } from "./deviceStorage";

// The confirmation before a change that replaces stages that have run (docs/overview.md §5.5): the same text for every
// change, a sentence before it for a new config, the button naming the change.
const CONFIRM_TEXT =
  "Later pipeline stages may have to run again (if their inputs change). Manual fixes for later stages will be kept if their inputs stay the same, and dropped otherwise. This action cannot be undone.";

type Confirmation = { title: string; text: string[]; confirmLabel: string; action: () => void };

// A stage running on another device: the pipeline is fetched this often, to show where it is.
const POLL_MS = 5000;

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
  onExport,
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
  onExport: () => void;
  onDelete: () => void;
  onChanged: () => void; // the project itself changed (e.g. its run mode)
}) {
  const wide = useWide();
  const [collapsed, setCollapsed] = useState(() => readDevice(DEVICE_KEYS.pipelinePanelCollapsed) === "1");
  const [mode, setMode] = useState<RunMode>(project.runMode);
  // null while loading.
  const [stored, setStored] = useState<ApiPipeline | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The user's own changes make no toasts for a while.
  const { quiet, isQuiet } = useQuietTime();
  // The panel scrolls to the current stage on opening the project, when an Auto run starts, and whenever
  // another stage becomes the current one (in both modes), and when the last stage is done, to show the downloads.
  const [scrollRequest, setScrollRequest] = useState(0);
  const scroll = () => setScrollRequest((n) => n + 1);
  // Run, Finish and Stop, and the stage this device is running.
  const { local, run, finish, stop } = usePipelineRun({ project, stored, setStored, mode, setError, onChanged, quiet, scroll });
  // The stage whose config is being edited.
  const [configuring, setConfiguring] = useState<{ stage: Stage; context: ConfigContext } | null>(null);
  const pipeline: Pipeline = stored ? toPipeline(mode, stored, local) : { mode, stages: [], dropped: [] };
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const progress = progressOf(pipeline);
  const currentId = currentStage(pipeline)?.id;
  const allDone = pipelineState(pipeline)?.kind === "done";

  useEffect(() => {
    fetchPipeline(project).then(setStored, (err) => setError(failure("Loading the pipeline failed", err)));
  }, [project.id]);

  // A stage running on another device: this one looks every few seconds, to show where the pipeline is, and that it
  // was interrupted once the Worker says so (its heartbeat too old).
  const runningElsewhere = pipeline.stages.some((s) => s.status === "running" && !s.runningHere);
  useEffect(() => {
    if (!runningElsewhere) return;
    const timer = setInterval(() => fetchPipeline(project).then(setStored, () => {}), POLL_MS);
    return () => clearInterval(timer);
  }, [runningElsewhere]);

  useEffect(() => {
    scroll();
  }, [currentId, allDone]);

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

  // Toasts only in narrow mode, while an artifact or a stage's details covers the pipeline.
  const covered = !wide && (pickedArtifact !== null || pickedStage !== null);
  const toast = useToasts(stored ? snapshotOf(pipeline) : null, covered, isQuiet);
  useEffect(() => {
    if (pickedArtifactId !== null || pickedStageId !== null) {
      setLastPicked({ artifactId: pickedArtifactId, stageId: pickedStageId });
    }
  }, [pickedArtifactId, pickedStageId]);

  function collapse(value: boolean) {
    setCollapsed(value);
    writeDevice(DEVICE_KEYS.pipelinePanelCollapsed, value ? "1" : "0");
  }

  // Asks first if the change replaces stages that have already run (docs/overview.md §5.5; `asksFirst`).
  function change(stageId: string, kind: RerunChange, apply: () => void, confirmLabel: string, before = "") {
    if (!asksFirst(pipeline.stages, kind, stageId)) return apply();
    setConfirmation({ title: "Are you sure?", text: [`${before}${CONFIRM_TEXT}`], confirmLabel, action: apply });
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
    quiet();
    const index = stored?.stages.findIndex((s) => s.id === afterId) ?? -1;
    const start = FIX_STARTS[step];
    if (!stored || index < 0 || !start) return;
    try {
      opened(await addFixStage(project, afterId, { step, ...start(stored.stages[index], stored.stages.slice(0, index + 1)) }));
    } catch (err) {
      setError(failure("Adding the stage failed", err));
    }
  }

  // A further review and its Apply review, planned, right after an Apply review.
  async function addReview(afterId: string) {
    quiet();
    try {
      const result = await addReviewStage(project, afterId);
      setStored(result.pipeline);
      onChanged();
      scroll();
    } catch (err) {
      setError(failure("Adding the review failed", err));
    }
  }

  // A human review, WIP, and its Apply review, planned, right after a done Apply review: its screen opens.
  async function addHumanReview(afterId: string) {
    quiet();
    const after = stored?.stages.find((s) => s.id === afterId);
    if (!after) return;
    try {
      opened(await addHumanReviewStage(project, afterId, humanReviewStart(after)));
    } catch (err) {
      setError(failure("Adding the human review failed", err));
    }
  }

  async function edit(stageId: string) {
    quiet();
    try {
      opened(await editStage(project, stageId));
    } catch (err) {
      setError(failure("Editing the stage failed", err));
    }
  }

  async function drop(stageId: string) {
    quiet();
    try {
      setStored(await dropStage(project, stageId));
      onChanged();
      scroll();
    } catch (err) {
      setError(failure("Dropping the stage failed", err));
    }
  }

  async function dismiss(id: number) {
    quiet();
    try {
      setStored(await dismissDropped(project, id));
    } catch (err) {
      setError(failure("Dismissing the card failed", err));
    }
  }

  async function saveConfig(stage: Stage, config: unknown, applyModelConfigToLater = false) {
    quiet();
    try {
      setStored(await setStageConfig(project, stage.id, config, applyModelConfigToLater));
      onChanged();
      scroll();
    } catch (err) {
      setError(failure("Changing the config failed", err));
    }
  }

  // Fetches the pipeline again, e.g. after an editor saved a page. Errors don't matter: the next fetch catches up.
  function refresh() {
    fetchPipeline(project).then(setStored, () => {});
  }

  const actions: PanelActions = {
    selectArtifact: onSelectArtifact,
    showDetails: onShowStage,
    run: () => {
      quiet();
      if (stored) void run(stored);
    },
    stop: () => void stop(pipeline),
    finish: (id) => void finish(id),
    changeConfig: (id) => {
      const stage = findStage(pipeline, id);
      if (!stage) return;
      if (!stepInfo(stage.stepId).config) setError(`"${stage.title}" has nothing to set.`);
      else {
        const llm = stage.kind === "llm";
        const position = pipeline.stages.indexOf(stage);
        void Promise.all([
          // The PDF's page count, to check a page selection before saving. Unknown if the PDF can't be opened here.
          llm ? null : openPdfForImages(project.pdfSha256).then(({ pageCount }) => pageCount, () => null),
          // The model configs to pick from (an LLM stage's), its own included if it was deleted (docs/llm.md).
          llm ? modelConfigsFor(stored?.stages[position]?.config ?? null) : [],
        ]).then(
          ([pageCount, modelConfigs]) => {
            const laterLlmStages = pipeline.stages.slice(position + 1).filter((s) => s.kind === "llm").length;
            setConfiguring({ stage, context: { pageCount, modelConfigs, laterLlmStages } });
          },
          (err) => setError(failure("The model configs couldn't be loaded", err)),
        );
      }
    },
    addFix: (id, step) => change(id, "addFix", () => void addFix(id, step), "Add stage"),
    addReview: (id) => change(id, "addReview", () => void addReview(id), "Add Review"),
    addHumanReview: (id) => change(id, "addHumanReview", () => void addHumanReview(id), "Add Human review"),
    edit: (id) => change(id, "edit", () => void edit(id), "Edit stage"),
    // `engrave`'s files (§6, `engrave`, "Downloads"), with the report on the pipeline up to the stage.
    download: async (stageId, kind) => {
      const engraving = findStage(pipeline, stageId)?.artifacts.find((a) => a.engraving)?.engraving;
      const position = stored?.stages.findIndex((s) => s.id === stageId) ?? -1;
      if (!engraving || !stored || position < 0) return;
      try {
        await download(kind, project, stored.stages.slice(0, position + 1), engraving);
      } catch (err) {
        setError(failure("The download failed", err));
      }
    },
    // Always asks: the stage's own work is lost.
    drop: (id) => change(id, "drop", () => void drop(id), "Drop stage"),
    dismissDropped: (id) => void dismiss(id),
    setMode: async (value) => {
      quiet();
      const previous = mode;
      setMode(value);
      try {
        await setRunMode(project, value);
        onChanged();
      } catch (err) {
        setMode(previous);
        setError(failure("Changing the run mode failed", err));
      }
    },
  };

  const configForm = configuring ? stepInfo(configuring.stage.stepId).config : undefined;
  // The stage's config as stored, in the form's values: what the dialog starts from, and what a save is compared with.
  const initial = configuring && configForm?.read(stored?.stages.find((s) => s.id === configuring.stage.id)?.config ?? null);
  const configDialog = configuring && configForm && initial && (
    <ConfigDialog
      title={configuring.stage.title}
      config={configForm}
      values={initial}
      context={configuring.context}
      onSave={(values, applyModelConfigToLater) => {
        const { stage } = configuring;
        const changed = configForm.fields.some((f) => values[f.key] !== initial[f.key]);
        // No manual stage has a config: if one ever has, this text must change (§5.5).
        const before =
          (changed ? "This stage will have to run again with the new config. " : "") +
          (applyModelConfigToLater ? "The remaining stages planned in this pipeline will use its model config too. " : "");
        change(stage.id, "config", () => saveConfig(stage, values, applyModelConfigToLater), "Change config", before);
      }}
      onClose={() => setConfiguring(null)}
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
      onExport={onExport}
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
        {toast && covered && (
          <div key={toast.key} className="toast" role="status">
            {toast.text.map((segment, i) => (segment.bold ? <strong key={i}>{segment.text}</strong> : segment.text))}
          </div>
        )}
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
              <ChevronRightIcon />
            </button>
            <StripProgress pipeline={pipeline} progress={progress} />
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

// The collapsed panel's progress (docs/project-view.md, "Progress"): the pipeline's circle, with a check once it is done,
// and below it where the pipeline is: the running stage's circle (a grey spinner if it runs on another device, whose
// progress isn't known here), a red triangle if it failed, an empty circle with a pause sign if it waits for the user;
// each with the stage's name.
function StripProgress({ pipeline, progress }: { pipeline: Pipeline; progress: Progress }) {
  const state = pipelineState(pipeline);
  if (!state) return null;
  const done = state.kind === "done";
  return (
    <>
      <div className="strip-progress">
        <span className="ring-with-mark">
          <ProgressRing value={done ? 1 : progress.pipeline} label="Pipeline" size={28} />
          {done && (
            <span className="ring-mark done">
              <CheckIcon />
            </span>
          )}
        </span>
        <span>Pipeline</span>
      </div>
      {!done && (
        <div className="strip-progress" title={stateLabel(state)}>
          {state.kind === "running" && state.here && <ProgressRing value={state.stage.progress} label="Stage" size={28} />}
          {state.kind === "running" && !state.here && <span className="spinner" role="progressbar" aria-label="Stage" />}
          {state.kind === "failed" && (
            <span className="strip-failed" aria-label={stateLabel(state)}>
              <WarningIcon />
            </span>
          )}
          {state.kind === "waiting" && (
            <span className="ring-with-mark" aria-label={stateLabel(state)}>
              <ProgressRing value={null} label="Stage" size={28} />
              <span className="ring-mark">
                <PauseIcon />
              </span>
            </span>
          )}
          <span className="strip-stage-name">{state.stage.title}</span>
        </div>
      )}
    </>
  );
}

// The model configs an LLM stage's config form offers: those not deleted, and the stage's own if it was deleted, marked
// so (it shows as the current one, and can't be picked anew; docs/llm.md). Those the app no longer supports are marked
// too, and the form offers only the others.
async function modelConfigsFor(config: Record<string, unknown> | null): Promise<{ id: string; name: string; deleted: boolean; unsupported: boolean }[]> {
  const configs = (await fetchModelConfigs()).map((c) => ({ id: c.id, name: c.name, deleted: false, unsupported: c.unsupported !== null }));
  const own = typeof config?.modelConfigId === "string" ? config.modelConfigId : null;
  if (own && !configs.some((c) => c.id === own)) {
    const deleted = await fetchModelConfig(own).catch(() => null);
    if (deleted) configs.push({ id: deleted.id, name: deleted.name, deleted: true, unsupported: deleted.unsupported !== null });
  }
  return configs;
}
