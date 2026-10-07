import { useState } from "react";
import type { Project } from "./api";
import { ArtifactView } from "./ArtifactView";
import { PipelineIcon } from "./icons";
import { defaultArtifactId, findArtifact, pipelineFor, progressOf, type PipelineItem } from "./pipeline";
import { PipelinePanel } from "./PipelinePanel";
import { ProgressRing } from "./ProgressRing";
import { useWide } from "./useWide";

const COLLAPSED_KEY = "pipelinePanelCollapsed";

// Wide mode: the pipeline panel on the left (collapsible to a narrow strip), the artifact view on the right.
// Narrow mode: only the pipeline; an artifact the user picks covers the whole app until it is closed.
export function ProjectView({
  project,
  artifactId,
  onSelectArtifact,
  onCloseArtifact,
}: {
  project: Project;
  artifactId: string | null; // picked by the user (it's in the URL), or null
  onSelectArtifact: (artifactId: string) => void;
  onCloseArtifact: () => void;
}) {
  const wide = useWide();
  const [collapsed, setCollapsed] = useState(() => readFlag(COLLAPSED_KEY));
  const items = pipelineFor(project);
  const progress = progressOf(items);

  // An artifact ID that doesn't exist (an old or edited URL) counts as no pick.
  const picked = artifactId === null ? null : findArtifact(items, artifactId);
  const fallbackId = defaultArtifactId(items);
  const shown = picked ?? (fallbackId === null ? null : findArtifact(items, fallbackId));

  function collapse(value: boolean) {
    setCollapsed(value);
    writeFlag(COLLAPSED_KEY, value);
  }

  const select = (item: PipelineItem) => onSelectArtifact(item.mainArtifactId);

  if (!wide) {
    return (
      <div className="project-view narrow">
        <PipelinePanel project={project} items={items} progress={progress} selectedItemId={null} onSelect={select} />
        {picked && <ArtifactView project={project} artifact={picked.artifact} onClose={onCloseArtifact} />}
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
              <PipelineIcon />
            </button>
            <ProgressRing value={progress.stage} label="Current stage" size={24} />
            <ProgressRing value={progress.pipeline} label="Pipeline" size={24} />
          </div>
        ) : (
          <PipelinePanel
            project={project}
            items={items}
            progress={progress}
            selectedItemId={shown?.item.id ?? null}
            onSelect={select}
            onCollapse={() => collapse(true)}
          />
        )}
      </aside>
      {shown && <ArtifactView project={project} artifact={shown.artifact} />}
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
