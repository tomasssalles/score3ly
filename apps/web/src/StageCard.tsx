import { DropdownMenu, type MenuItem } from "./DropdownMenu";
import { FittedText } from "./FittedText";
import {
  AnalyzeIcon,
  ExtractIcon,
  ComputedIcon,
  DataIcon,
  DocumentIcon,
  ImageIcon,
  IngestIcon,
  LayoutIcon,
  LlmIcon,
  ManualIcon,
  MoreIcon,
  MusicIcon,
  PlayIcon,
  RetryIcon,
  SkewIcon,
  StopIcon,
} from "./icons";
import { hasArtifacts, type Artifact, type RunMode, type Stage, type StageKind } from "./pipeline";
import { ProgressBar } from "./ProgressBar";
import { KIND_LABELS } from "./StageDetails";
import { duration } from "./time";

export type StageActions = {
  selectArtifact: (artifactId: string) => void;
  showDetails: (stageId: string) => void;
  run: () => void;
  stop: () => void;
  finish: (stageId: string) => void;
  changeConfig: (stageId: string) => void;
  addFix: (stageId: string, step: string) => void;
  edit: (stageId: string) => void;
  drop: (stageId: string) => void;
};

// Each automated step has its own icon (DESIGN.md §5.6); manual stages all show their kind's, a wrench. A step
// without one shows its kind's.
const STEP_ICONS: Record<string, () => React.JSX.Element> = {
  ingest: IngestIcon,
  rasterize: ImageIcon,
  skew_analysis: SkewIcon,
  layout: LayoutIcon,
  analyze: AnalyzeIcon,
  extract: ExtractIcon,
};

const KIND_ICONS: Record<StageKind, () => React.JSX.Element> = {
  ingest: IngestIcon,
  computed: ComputedIcon,
  llm: LlmIcon,
  manual: ManualIcon,
};

// One stage of the pipeline: what it is, how it went, what it can do next, and its artifacts as tiles.
// A planned stage (not its turn yet) is only a dimmed title.
export function StageCard({
  stage,
  mode,
  busy,
  selectedArtifactId,
  detailsShown,
  actions,
}: {
  stage: Stage;
  mode: RunMode;
  busy: boolean; // a stage is running: nothing may change until it stops
  selectedArtifactId: string | null;
  detailsShown: boolean;
  actions: StageActions;
}) {
  const Icon = STEP_ICONS[stage.stepId] ?? KIND_ICONS[stage.kind];
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

      {hasArtifacts(stage) && stage.artifacts.length > 0 && (
        <ul className="output-grid">
          {stage.artifacts.map((artifact) => (
            <li key={artifact.id}>
              <ArtifactTile
                artifact={artifact}
                selected={artifact.id === selectedArtifactId}
                onSelect={() => actions.selectArtifact(artifact.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

// The model config on a line of its own, shortened in the middle if it doesn't fit (§5.7), then the facts.
function Facts({ stage }: { stage: Stage }) {
  const facts: (string | undefined)[] = [];
  if (stage.status === "done") {
    if (stage.seconds !== undefined) facts.push(duration(stage.seconds));
    facts.push(stage.note);
  }
  if (stage.status === "wip") facts.push("Not finished yet");
  const shown = facts.filter(Boolean);
  return (
    <>
      {stage.model && (
        <p className="stage-facts stage-model">
          <FittedText text={stage.model} lines={1} />
        </p>
      )}
      {shown.length > 0 && <p className="stage-facts">{shown.join(" · ")}</p>}
    </>
  );
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
  if (busy || stage.kind === "ingest") return groups;
  const changes: MenuItem[] = [];
  if (stage.kind === "manual") {
    if (stage.status === "done") changes.push({ label: "Edit", onSelect: () => actions.edit(stage.id) });
  } else {
    changes.push({ label: "Change config", onSelect: () => actions.changeConfig(stage.id) });
  }
  if (stage.status === "done") {
    for (const fix of stage.fixes) changes.push({ label: `${fix.title} manually`, onSelect: () => actions.addFix(stage.id, fix.step) });
  }
  if (changes.length > 0) groups.push(changes);
  if (stage.droppable) {
    groups.push([{ label: "Drop stage", danger: true, onSelect: () => actions.drop(stage.id) }]);
  }
  return groups;
}

// An artifact as a tile: an icon for its kind, never a thumbnail (DESIGN.md §5.6). A group says how many items it has.
function ArtifactTile({
  artifact,
  selected,
  onSelect,
}: {
  artifact: Artifact;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" className="output-tile" aria-current={selected ? "true" : undefined} onClick={onSelect}>
      <span className="output-thumb">
        <ArtifactIcon artifact={artifact} />
        {artifact.count > 1 && <span className="output-count">×{artifact.count}</span>}
      </span>
      <span className="output-title">{artifact.title}</span>
    </button>
  );
}

function ArtifactIcon({ artifact }: { artifact: Artifact }) {
  if (artifact.kind === "pdf") return <DocumentIcon />;
  if (artifact.kind === "images") return <ImageIcon />;
  if (artifact.kind === "json") return <DataIcon />;
  return <MusicIcon />;
}
