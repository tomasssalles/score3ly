import { useEffect, useState } from "react";
import { fetchPipeline, setRunMode, type Project } from "./api";
import { ArtifactContent, ArtifactView } from "./ArtifactView";
import { ConfirmDialog } from "./ConfirmDialog";
import { ExpandIcon } from "./icons";
import {
  currentStage,
  defaultArtifactId,
  findArtifact,
  findStage,
  progressOf,
  toPipeline,
  type Pipeline,
  type RunMode,
} from "./pipeline";
import { PipelinePanel, type PanelActions } from "./PipelinePanel";
import { ProgressRing } from "./ProgressRing";
import { StageDetails } from "./StageDetails";
import { useWide } from "./useWide";

const COLLAPSED_KEY = "pipelinePanelCollapsed";

// What the user must know before stages that already ran are replaced (DESIGN.md §5.5).
const OVERWRITE_TEXT = [
  "Everything from here on is overwritten. There is no undo.",
  "Changing one stage can change, and is likely to change, the rest of the pipeline. Wherever a stage's input stays exactly the same, its earlier result is reused: LLM calls already paid for are not paid for again, and manual fixes are kept. Everywhere else, calls are paid for again and manual work is dropped.",
];

type Confirmation = { title: string; text: string[]; confirmLabel: string; danger?: boolean; action: () => void };

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
  onChanged,
}: {
  project: Project;
  artifactId: string | null; // picked by the user (it's in the URL), or null
  stageId: string | null; // the stage whose details the user picked (in the URL), or null
  onSelectArtifact: (artifactId: string) => void;
  onShowStage: (stageId: string) => void;
  onCloseArtifact: () => void;
  onRename: () => void;
  onChanged: () => void; // the project itself changed (e.g. its run mode)
}) {
  const wide = useWide();
  const [collapsed, setCollapsed] = useState(() => readFlag(COLLAPSED_KEY));
  const [mode, setMode] = useState<RunMode>(project.runMode);
  // null while loading.
  const [stored, setStored] = useState<Awaited<ReturnType<typeof fetchPipeline>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pipeline: Pipeline = stored ? toPipeline(mode, stored) : { mode, stages: [] };
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  // The panel scrolls to the current stage on opening the project, when an Auto run starts, and whenever
  // another stage becomes the current one (in both modes).
  const [scrollRequest, setScrollRequest] = useState(0);
  const scroll = () => setScrollRequest((n) => n + 1);
  const progress = progressOf(pipeline);
  const currentId = currentStage(pipeline)?.id;

  useEffect(() => {
    fetchPipeline(project).then(setStored, (err) => setError(`Loading the pipeline failed: ${err}`));
  }, [project.id]);

  useEffect(() => {
    scroll();
  }, [currentId]);

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
  function change(stageId: string, apply: () => void, ask: boolean) {
    if (!ask) return apply();
    const stage = findStage(pipeline, stageId);
    setConfirmation({
      title: `Overwrite the pipeline from "${stage?.title}"?`,
      text: OVERWRITE_TEXT,
      confirmLabel: "Overwrite",
      action: apply,
    });
  }

  // Whether a change at this stage replaces stages after it that have already run.
  function replacesWork(stageId: string): boolean {
    const i = pipeline.stages.findIndex((stage) => stage.id === stageId);
    return pipeline.stages.slice(i + 1).some((stage) => stage.status !== "planned" && stage.status !== "ready");
  }

  // Running and changing stages isn't built yet: no stage can run, and Ingest offers none of these.
  const notBuilt = () => {};
  const actions: PanelActions = {
    selectArtifact: onSelectArtifact,
    showDetails: onShowStage,
    run: notBuilt,
    stop: notBuilt,
    finish: notBuilt,
    changeConfig: (id) => change(id, notBuilt, replacesWork(id)),
    addFix: (id) => change(id, notBuilt, replacesWork(id)),
    edit: (id) => change(id, notBuilt, replacesWork(id)),
    // Always asks: the stage's own work is lost, and perhaps the stages after it too.
    drop: (id) =>
      setConfirmation({
        title: `Drop "${findStage(pipeline, id)?.title}"?`,
        text: [
          "The stage is removed, and the work done in it is lost. There is no undo.",
          ...(replacesWork(id) ? OVERWRITE_TEXT : []),
        ],
        confirmLabel: "Drop stage",
        danger: true,
        action: notBuilt,
      }),
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

  const dialog = confirmation && (
    <ConfirmDialog
      title={confirmation.title}
      text={confirmation.text}
      confirmLabel={confirmation.confirmLabel}
      danger={confirmation.danger}
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
              <ArtifactContent project={project} artifact={pickedArtifact.artifact} />
            </ArtifactView>
          )
        )}
        {dialog}
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
            <ArtifactContent project={project} artifact={shownArtifact.artifact} />
          </ArtifactView>
        )
      )}
      {dialog}
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
