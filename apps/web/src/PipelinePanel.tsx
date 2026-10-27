import { Fragment, useEffect, useRef } from "react";
import type { Project } from "./api";
import { DropdownMenu } from "./DropdownMenu";
import { FittedText } from "./FittedText";
import { ChevronDownIcon, CollapseIcon, MoreIcon, StopIcon } from "./icons";
import { canRun, currentStage, MODE_LABELS, MODES, pipelineState, runningStage, stateLabel, type Pipeline, type Progress, type RunMode } from "./pipeline";
import { ProgressBar } from "./ProgressBar";
import { DroppedCard, RunLabel, StageCard, type StageActions } from "./StageCard";
import { when } from "./time";

export type PanelActions = StageActions & {
  setMode: (mode: RunMode) => void;
  dismissDropped: (id: number) => void;
};


// The current project's pipeline: a small head that stays in view (the project, the run mode, the progress and,
// in Auto mode, Run or Stop), and below it the stages, first to last, which scroll.
export function PipelinePanel({
  project,
  pipeline,
  progress,
  selectedArtifactId,
  detailsStageId,
  scrollRequest,
  actions,
  onCollapse,
  onRename,
  onDelete,
  error,
}: {
  project: Project;
  pipeline: Pipeline;
  progress: Progress;
  selectedArtifactId: string | null; // highlighted: shown (wide mode) or last looked at (narrow mode)
  detailsStageId: string | null; // the stage whose details are shown
  scrollRequest: number; // scrolls to the current stage whenever it changes
  actions: PanelActions;
  onCollapse?: () => void; // wide mode only
  onRename: () => void;
  onDelete: () => void;
  error: string | null; // loading or changing the pipeline failed
}) {
  const list = useRef<HTMLOListElement>(null);
  const busy = runningStage(pipeline) !== null;
  const state = pipelineState(pipeline);
  const currentId = currentStage(pipeline)?.id;
  const firstScroll = useRef(true);

  useEffect(() => {
    const card = list.current?.querySelector(`[data-stage-id="${currentId}"]`);
    // Jump on opening the project, glide afterwards.
    card?.scrollIntoView({ block: "center", behavior: firstScroll.current ? "instant" : "smooth" });
    firstScroll.current = false;
    // Only a new request scrolls.
  }, [scrollRequest]);

  return (
    <div className="pipeline-panel">
      <div className="panel-head">
        <div className="panel-title">
          <h2>
            <FittedText text={project.name} lines={1} />
          </h2>
          <div className="panel-actions">
            <DropdownMenu
              icon={<MoreIcon />}
              label="Project actions"
              groups={[[{ label: "Rename", onSelect: onRename }], [{ label: "Delete project", danger: true, onSelect: onDelete }]]}
            />
            {onCollapse && (
              <button type="button" className="icon-button" aria-label="Collapse the pipeline" onClick={onCollapse}>
                <CollapseIcon />
              </button>
            )}
          </div>
        </div>
        <div className="panel-controls">
          <DropdownMenu
            className="mode-picker"
            buttonClassName="mode-button"
            icon={
              <>
                {MODE_LABELS[pipeline.mode]}
                <ChevronDownIcon />
              </>
            }
            label="Run mode"
            groups={[
              MODES.map((mode) => ({
                label: MODE_LABELS[mode],
                current: mode === pipeline.mode,
                onSelect: () => actions.setMode(mode),
              })),
            ]}
          />
          {/* The bar is the pipeline's; the line under it says where the pipeline is (docs/project-view.md, "Progress"). */}
          <div className="head-progress">
            <ProgressBar value={progress.pipeline} label="Pipeline" />
            {state && <span className={state.kind === "failed" ? "head-state failed" : "head-state"}>{stateLabel(state)}</span>}
          </div>
          {pipeline.mode === "auto" &&
            (busy ? (
              <button type="button" className="button-stop small" onClick={actions.stop}>
                <StopIcon />
                Stop
              </button>
            ) : (
              <button
                type="button"
                className="button-run small"
                disabled={!canRun(pipeline)}
                title={currentStage(pipeline)?.status === "wip" ? "Finish the manual stage first" : undefined}
                onClick={actions.run}
              >
                <RunLabel retry={currentStage(pipeline)?.status === "failed"} />
              </button>
            ))}
        </div>
        {/* In the head, so it stays in view while the list scrolls to the current stage. */}
        {error && <p className="panel-error">{error}</p>}
      </div>

      <p className="project-dates">
        Created {when(project.createdAt)} · changed {when(project.lastModifiedAt)}
      </p>

      <ol className="stage-list" ref={list}>
        {pipeline.stages.map((stage) => (
          <Fragment key={stage.id}>
            <StageCard
              stage={stage}
              mode={pipeline.mode}
              busy={busy}
              selectedArtifactId={selectedArtifactId}
              detailsShown={stage.id === detailsStageId}
              actions={actions}
            />
            {pipeline.dropped
              .filter((dropped) => dropped.afterStageId === stage.id)
              .map((dropped) => (
                <DroppedCard key={`dropped-${dropped.id}`} dropped={dropped} onDismiss={() => actions.dismissDropped(dropped.id)} />
              ))}
          </Fragment>
        ))}
      </ol>
    </div>
  );
}
