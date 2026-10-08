import { useEffect, useState } from "react";
import type { Project } from "./api";
import { ArtifactView, OutputContent } from "./ArtifactView";
import { ConfirmDialog } from "./ConfirmDialog";
import { ExpandIcon } from "./icons";
import * as mock from "./mockPipeline";
import { currentStage, defaultOutputId, findOutput, findStage, progressOf, runningStage, type Pipeline } from "./pipeline";
import { PipelinePanel, type PanelActions } from "./PipelinePanel";
import { ProgressRing } from "./ProgressRing";
import { StageDetails } from "./StageDetails";
import { useWide } from "./useWide";

const COLLAPSED_KEY = "pipelinePanelCollapsed";
const TICK = 100; // ms between steps of the mock simulation

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
}: {
  project: Project;
  artifactId: string | null; // picked by the user (it's in the URL), or null
  stageId: string | null; // the stage whose details the user picked (in the URL), or null
  onSelectArtifact: (artifactId: string) => void;
  onShowStage: (stageId: string) => void;
  onCloseArtifact: () => void;
  onRename: () => void;
}) {
  const wide = useWide();
  const [collapsed, setCollapsed] = useState(() => readFlag(COLLAPSED_KEY));
  const [pipeline, setPipeline] = useState(() => mock.mockPipeline(project));
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  // The panel scrolls to the current stage on opening the project, and when an Auto run starts or moves on.
  const [scrollRequest, setScrollRequest] = useState(0);
  const scroll = () => setScrollRequest((n) => n + 1);
  const progress = progressOf(pipeline);
  const running = runningStage(pipeline);
  const currentId = currentStage(pipeline)?.id;

  // The mock simulation: the running stage moves on a little every tick.
  useEffect(() => {
    if (running === null) return;
    const seconds = running.kind === "llm" ? 6 : 2;
    const timer = window.setInterval(() => setPipeline((p) => mock.advance(p, TICK / 1000 / seconds)), TICK);
    return () => window.clearInterval(timer);
  }, [running?.id]);

  useEffect(() => {
    if (pipeline.mode === "auto" && running !== null) scroll();
  }, [currentId]);

  // An ID that doesn't exist (an old or edited URL, or a replaced stage) counts as no pick.
  const pickedOutput = artifactId === null ? null : findOutput(pipeline, artifactId);
  const pickedStage = stageId === null ? null : findStage(pipeline, stageId);
  const fallbackId = defaultOutputId(pipeline);
  const shownOutput = pickedOutput ?? (fallbackId === null ? null : findOutput(pipeline, fallbackId));

  // Narrow mode: what was last looked at stays selected after it is closed.
  const [lastPicked, setLastPicked] = useState<{ outputId: string | null; stageId: string | null }>({
    outputId: null,
    stageId: null,
  });
  const pickedOutputId = pickedOutput?.output.id ?? null;
  const pickedStageId = pickedStage?.id ?? null;
  useEffect(() => {
    if (pickedOutputId !== null || pickedStageId !== null) {
      setLastPicked({ outputId: pickedOutputId, stageId: pickedStageId });
    }
  }, [pickedOutputId, pickedStageId]);

  function collapse(value: boolean) {
    setCollapsed(value);
    writeFlag(COLLAPSED_KEY, value);
  }

  // Asks first if the change replaces stages that have already run (DESIGN.md §5.5).
  function change(stageId: string, apply: (p: Pipeline) => Pipeline, ask: boolean) {
    const run = () => {
      setPipeline(apply);
      scroll();
    };
    if (!ask) return run();
    const stage = findStage(pipeline, stageId);
    setConfirmation({
      title: `Overwrite the pipeline from "${stage?.title}"?`,
      text: [
        "Everything from here on is overwritten. There is no undo.",
        "Changing one stage can change, and is likely to change, the rest of the pipeline. Wherever a stage's input stays exactly the same, its earlier result is reused: LLM calls already paid for are not paid for again, and manual fixes are kept. Everywhere else, calls are paid for again and manual work is dropped.",
      ],
      confirmLabel: "Overwrite",
      action: run,
    });
  }

  const auto = pipeline.mode === "auto";
  const actions: PanelActions = {
    selectOutput: onSelectArtifact,
    showDetails: onShowStage,
    run: () => {
      setPipeline(mock.start);
      if (auto) scroll();
    },
    stop: () => setPipeline(mock.stop),
    finish: (id) => {
      setPipeline((p) => mock.finish(p, id));
      if (auto) scroll();
    },
    // The real app opens the stage's config first; the mock goes straight to what follows.
    changeConfig: (id) => {
      const stage = findStage(pipeline, id);
      if (stage?.status !== "done" && stage?.status !== "failed") return;
      change(id, (p) => mock.rerun(p, id, p.mode === "auto"), true);
    },
    rerun: (id) =>
      change(id, (p) => mock.rerun(p, id, true), findStage(pipeline, id)?.status === "done"),
    addFix: (id, title) => change(id, (p) => mock.addFix(p, id, title), mock.replacesWork(pipeline, id)),
    edit: (id) => change(id, (p) => mock.edit(p, id), mock.replacesWork(pipeline, id)),
    discard: (id) =>
      setConfirmation({
        title: `Discard "${findStage(pipeline, id)?.title}"?`,
        text: ["The changes made in this stage are lost."],
        confirmLabel: "Discard",
        danger: true,
        action: () => setPipeline((p) => mock.discard(p, id)),
      }),
    setMode: (mode) => setPipeline((p) => mock.setMode(p, mode)),
    mockFail: () => setPipeline(mock.fail),
    mockReset: () => {
      setPipeline(mock.mockPipeline(project));
      scroll();
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

  const panel = (selectedOutputId: string | null, detailsStageId: string | null, onCollapse?: () => void) => (
    <PipelinePanel
      project={project}
      pipeline={pipeline}
      progress={progress}
      selectedOutputId={selectedOutputId}
      detailsStageId={detailsStageId}
      scrollRequest={scrollRequest}
      actions={actions}
      onCollapse={onCollapse}
      onRename={onRename}
    />
  );

  if (!wide) {
    const selected = pickedOutput || pickedStage ? { outputId: pickedOutputId, stageId: pickedStageId } : lastPicked;
    return (
      <div className="project-view narrow">
        {panel(selected.outputId, selected.stageId)}
        {pickedStage ? (
          <ArtifactView label={`${pickedStage.title}: details`} onClose={onCloseArtifact}>
            <StageDetails stage={pickedStage} />
          </ArtifactView>
        ) : (
          pickedOutput && (
            <ArtifactView label={pickedOutput.output.title} onClose={onCloseArtifact}>
              <OutputContent project={project} output={pickedOutput.output} />
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
          panel(pickedStage ? null : (shownOutput?.output.id ?? null), pickedStage?.id ?? null, () => collapse(true))
        )}
      </aside>
      {pickedStage ? (
        <ArtifactView label={`${pickedStage.title}: details`}>
          <StageDetails stage={pickedStage} />
        </ArtifactView>
      ) : (
        shownOutput && (
          <ArtifactView label={shownOutput.output.title}>
            <OutputContent project={project} output={shownOutput.output} />
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
