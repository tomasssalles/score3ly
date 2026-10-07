import type { Project } from "./api";
import { DropdownMenu } from "./DropdownMenu";
import { FittedText } from "./FittedText";
import { CollapseIcon, DocumentIcon, MoreIcon } from "./icons";
import { type PipelineItem, type Progress } from "./pipeline";
import { ProgressRing } from "./ProgressRing";
import { ago, shortDate } from "./time";

// The current project: basic info, progress, and the pipeline's items. Picking an item shows its main artifact.
export function PipelinePanel({
  project,
  items,
  progress,
  selectedItemId,
  onSelect,
  onCollapse,
  onRename,
}: {
  project: Project;
  items: PipelineItem[];
  progress: Progress;
  selectedItemId: string | null; // highlighted: the item shown (wide mode) or last looked at (narrow mode)
  onSelect: (item: PipelineItem) => void;
  onCollapse?: () => void; // wide mode only
  onRename: () => void;
}) {
  return (
    <div className="pipeline-panel">
      <div className="panel-head">
        <div className="project-info">
          <h2>
            <FittedText text={project.name} lines={3} />
          </h2>
          <p>
            Created {shortDate(project.createdAt)} · changed {ago(project.lastModifiedAt)}
          </p>
        </div>
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

      <div className="progress-row">
        <div className="progress-item">
          <ProgressRing value={progress.stage} label="Current stage" />
          <span>
            Stage
            <small>{progress.stage === null ? "nothing running" : `${Math.round(progress.stage * 100)}%`}</small>
          </span>
        </div>
        <div className="progress-item">
          <ProgressRing value={progress.pipeline} label="Pipeline" />
          <span>
            Pipeline
            <small>{Math.round(progress.pipeline * 100)}%</small>
          </span>
        </div>
      </div>

      <ol className="pipeline-items">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="pipeline-item"
              aria-current={item.id === selectedItemId ? "true" : undefined}
              onClick={() => onSelect(item)}
            >
              <DocumentIcon />
              <span className="item-text">
                <span className="item-title">{item.title}</span>
                <FittedText className="item-detail" text={item.detail} lines={3} />
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
