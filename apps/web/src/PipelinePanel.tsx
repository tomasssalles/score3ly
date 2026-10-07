import type { Project } from "./api";
import { CollapseIcon, DocumentIcon } from "./icons";
import { type PipelineItem, type Progress } from "./pipeline";
import { ProgressRing } from "./ProgressRing";
import { ago } from "./time";

// The current project: basic info, progress, and the pipeline's items. Picking an item shows its main artifact.
export function PipelinePanel({
  project,
  items,
  progress,
  selectedItemId,
  onSelect,
  onCollapse,
}: {
  project: Project;
  items: PipelineItem[];
  progress: Progress;
  selectedItemId: string | null; // highlighted in wide mode
  onSelect: (item: PipelineItem) => void;
  onCollapse?: () => void; // wide mode only
}) {
  return (
    <div className="pipeline-panel">
      <div className="panel-head">
        <div className="project-info">
          <h2>{project.name}</h2>
          <p>
            Created {new Date(project.createdAt).toLocaleDateString()} · changed {ago(project.lastModifiedAt)}
          </p>
        </div>
        {onCollapse && (
          <button type="button" className="icon-button" aria-label="Collapse the pipeline" onClick={onCollapse}>
            <CollapseIcon />
          </button>
        )}
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
                <span className="item-detail">{item.detail}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
