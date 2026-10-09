import { DropdownMenu, type MenuItem } from "./DropdownMenu";
import type { Project } from "./api";
import { ComputedIcon, DataIcon, LlmIcon, ManualIcon, MoreIcon, MusicIcon, PlayIcon, RetryIcon, StopIcon } from "./icons";
import { MockPage, MockSystem } from "./mockContent";
import { canDrop } from "./mockPipeline";
import { dollars } from "./money";
import { pdfUrl } from "./pdf";
import { PdfThumb } from "./PdfThumb";
import { hasOutputs, type Output, type RunMode, type Stage, type StageKind } from "./pipeline";
import { ProgressBar } from "./ProgressBar";
import { KIND_LABELS } from "./StageDetails";
import { duration } from "./time";

export type StageActions = {
  selectOutput: (outputId: string) => void;
  showDetails: (stageId: string) => void;
  run: () => void;
  stop: () => void;
  finish: (stageId: string) => void;
  changeConfig: (stageId: string) => void;
  addFix: (stageId: string, title: string) => void;
  edit: (stageId: string) => void;
  drop: (stageId: string) => void;
};

const KIND_ICONS: Record<StageKind, () => React.JSX.Element> = {
  computed: ComputedIcon,
  llm: LlmIcon,
  manual: ManualIcon,
};

// One stage of the pipeline: what it is, how it went, what it can do next, and its outputs as tiles.
// A planned stage (not its turn yet) is only a dimmed title.
export function StageCard({
  project,
  stage,
  mode,
  busy,
  selectedOutputId,
  detailsShown,
  actions,
}: {
  project: Project;
  stage: Stage;
  mode: RunMode;
  busy: boolean; // a stage is running: nothing may change until it stops
  selectedOutputId: string | null;
  detailsShown: boolean;
  actions: StageActions;
}) {
  const Icon = KIND_ICONS[stage.kind];
  const planned = stage.status === "planned";
  const classes = ["stage-card", stage.status, detailsShown ? "selected" : ""].join(" ");

  return (
    <li className={classes} data-stage-id={stage.id}>
      <div className="stage-head">
        <span className="stage-kind" title={KIND_LABELS[stage.kind]}>
          <Icon />
        </span>
        <h3 className="stage-title">
          {stage.title}
          {stage.status === "wip" && <span className="badge">WIP</span>}
        </h3>
        <DropdownMenu icon={<MoreIcon />} label={`${stage.title}: actions`} groups={menu(stage, busy, actions)} />
      </div>

      {!planned && <Facts stage={stage} />}
      {stage.status === "running" && <ProgressBar value={stage.progress} label={`${stage.title}: progress`} />}
      {stage.status === "failed" && <p className="stage-error">{stage.error}</p>}
      <StageButton stage={stage} mode={mode} actions={actions} />

      {hasOutputs(stage) && stage.outputs.length > 0 && (
        <ul className="output-grid">
          {stage.outputs.map((output) => (
            <li key={output.id}>
              <OutputTile
                project={project}
                output={output}
                selected={output.id === selectedOutputId}
                onSelect={() => actions.selectOutput(output.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function Facts({ stage }: { stage: Stage }) {
  const facts = [stage.model];
  if (stage.status === "done") {
    if (stage.seconds !== undefined) facts.push(duration(stage.seconds));
    if (stage.cost !== undefined) facts.push(dollars(stage.cost));
    facts.push(stage.note);
  }
  if (stage.status === "wip") facts.push("Not finished yet");
  const shown = facts.filter(Boolean);
  return shown.length > 0 ? <p className="stage-facts">{shown.join(" · ")}</p> : null;
}

// What a Run button says: "Retry" for a stage that failed.
export function RunLabel({ retry }: { retry: boolean }) {
  return retry ? (
    <>
      <RetryIcon />
      Retry
    </>
  ) : (
    <>
      <PlayIcon />
      Run
    </>
  );
}

// Run and Stop sit on the stage in Manual mode (in Auto mode they are in the panel's head). Finish ends a manual
// stage, in both modes.
function StageButton({ stage, mode, actions }: { stage: Stage; mode: RunMode; actions: StageActions }) {
  if (stage.status === "wip") {
    return (
      <button type="button" className="button-primary stage-button" onClick={() => actions.finish(stage.id)}>
        Finish
      </button>
    );
  }
  if (mode !== "manual") return null;
  if (stage.status === "ready" || stage.status === "failed") {
    return (
      <button type="button" className="button-run stage-button" onClick={actions.run}>
        <RunLabel retry={stage.status === "failed"} />
      </button>
    );
  }
  if (stage.status === "running") {
    return (
      <button type="button" className="button-stop stage-button" onClick={actions.stop}>
        <StopIcon />
        Stop
      </button>
    );
  }
  return null;
}

function menu(stage: Stage, busy: boolean, actions: StageActions): MenuItem[][] {
  const groups: MenuItem[][] = [[{ label: "Show details", onSelect: () => actions.showDetails(stage.id) }]];
  if (busy || stage.id === "ingest") return groups;
  const changes: MenuItem[] = [];
  if (stage.kind === "manual") {
    if (stage.status === "done") changes.push({ label: "Edit", onSelect: () => actions.edit(stage.id) });
  } else {
    changes.push({ label: "Change config", onSelect: () => actions.changeConfig(stage.id) });
  }
  if (stage.status === "done") {
    for (const fix of stage.fixes) changes.push({ label: `Add: ${fix}`, onSelect: () => actions.addFix(stage.id, fix) });
  }
  if (changes.length > 0) groups.push(changes);
  if (canDrop(stage)) {
    groups.push([{ label: "Drop stage", danger: true, onSelect: () => actions.drop(stage.id) }]);
  }
  return groups;
}

// An output as a tile: a picture of its first item, or an icon. A group says how many items it has.
function OutputTile({
  project,
  output,
  selected,
  onSelect,
}: {
  project: Project;
  output: Output;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" className="output-tile" aria-current={selected ? "true" : undefined} onClick={onSelect}>
      <span className="output-thumb">
        <Thumb project={project} output={output} />
        {output.count > 1 && <span className="output-count">×{output.count}</span>}
      </span>
      <span className="output-title">{output.title}</span>
    </button>
  );
}

function Thumb({ project, output }: { project: Project; output: Output }) {
  if (output.kind === "images") {
    return output.item === "System" ? <MockSystem index={0} /> : <MockPage index={0} boxes={output.id.includes("boxes")} />;
  }
  if (output.kind === "pdf") return <PdfThumb url={pdfUrl(project.pdfSha256)} />;
  if (output.kind === "json") return <DataIcon />;
  return <MusicIcon />;
}
