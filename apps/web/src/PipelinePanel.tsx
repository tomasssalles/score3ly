import { useEffect, useRef } from "react";
import type { Project } from "./api";
import { DropdownMenu } from "./DropdownMenu";
import { FittedText } from "./FittedText";
import { CollapseIcon, MoreIcon, PlayIcon, StopIcon } from "./icons";
import { canRun, currentStage, runningStage, type Pipeline, type Progress, type RunMode } from "./pipeline";
import { ProgressBar } from "./ProgressBar";
import { StageCard, type StageActions } from "./StageCard";
import { ago, shortDate } from "./time";

export type PanelActions = StageActions & {
  setMode: (mode: RunMode) => void;
  mockFail: () => void;
  mockReset: () => void;
};

// The current project's pipeline: a small head that stays in view (the project, the run mode, the progress and,
// in Auto mode, Run or Stop), and below it the stages, first to last, which scroll.
export function PipelinePanel({
  project,
  pipeline,
  progress,
  selectedOutputId,
  detailsStageId,
  scrollRequest,
  actions,
  onCollapse,
  onRename,
}: {
  project: Project;
  pipeline: Pipeline;
  progress: Progress;
  selectedOutputId: string | null; // highlighted: shown (wide mode) or last looked at (narrow mode)
  detailsStageId: string | null; // the stage whose details are shown
  scrollRequest: number; // scrolls to the current stage whenever it changes
  actions: PanelActions;
  onCollapse?: () => void; // wide mode only
  onRename: () => void;
}) {
  const list = useRef<HTMLOListElement>(null);
  const busy = runningStage(pipeline) !== null;
  const currentId = currentStage(pipeline)?.id;
  const firstScroll = useRef(true);

  useEffect(() => {
    const card = list.current?.querySelector(`[data-stage-id="${currentId}"]`);
    // Jump on opening the project, glide afterwards.
    card?.scrollIntoView({ block: "center", behavior: firstScroll.current ? "instant" : "smooth" });
    firstScroll.current = false;
    // Only a new request scrolls, not every change of the current stage.
  }, [scrollRequest]);

  return (
    <div className="pipeline-panel">
      <div className="panel-head">
        <div className="panel-title">
          <h2>
            <FittedText text={project.name} lines={1} />
          </h2>
          <div className="panel-actions">
            {/* Project actions. Deleting isn't built yet: picking it only closes the menu. */}
            <DropdownMenu
              icon={<MoreIcon />}
              label="Project actions"
              groups={[[{ label: "Rename", onSelect: onRename }], [{ label: "Delete project", danger: true }]]}
            />
            {onCollapse && (
              <button type="button" className="icon-button" aria-label="Collapse the pipeline" onClick={onCollapse}>
                <CollapseIcon />
              </button>
            )}
          </div>
        </div>
        <div className="panel-controls">
          <div className="mode-switch" role="group" aria-label="Run mode">
            {(["auto", "manual"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={pipeline.mode === mode}
                onClick={() => actions.setMode(mode)}
              >
                {mode === "auto" ? "Auto" : "Manual"}
              </button>
            ))}
          </div>
          <ProgressBar value={progress.pipeline} label="Pipeline" />
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
                <PlayIcon />
                Run
              </button>
            ))}
        </div>
      </div>

      <p className="project-dates">
        Created {shortDate(project.createdAt)} · changed {ago(project.lastModifiedAt)}
      </p>

      <ol className="stage-list" ref={list}>
        {pipeline.stages.map((stage) => (
          <StageCard
            key={stage.id}
            stage={stage}
            mode={pipeline.mode}
            busy={busy}
            selectedOutputId={selectedOutputId}
            detailsShown={stage.id === detailsStageId}
            actions={actions}
          />
        ))}
      </ol>

      {/* Only while the stages are mock data. */}
      <div className="mock-controls">
        <span>Mock</span>
        <button type="button" className="button-secondary" disabled={!busy} onClick={actions.mockFail}>
          Fail the running stage
        </button>
        <button type="button" className="button-secondary" onClick={actions.mockReset}>
          Reset
        </button>
      </div>
    </div>
  );
}
