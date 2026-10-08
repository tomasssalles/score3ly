// The project's pipeline as the UI shows it. For now it holds only the original PDF; the stages come later
// (DESIGN.md §5). Each item declares its main artifact, which is what the artifact view shows by default.

import type { Project } from "./api";

export type Artifact = {
  id: string; // unique within the project, used in the URL
  title: string;
  kind: "pdf";
};

export type PipelineItem = {
  id: string;
  title: string;
  detail: string;
  artifacts: Artifact[];
  mainArtifactId: string;
};

// Fractions from 0 to 1. `stage` is null while no stage is running.
export type Progress = { stage: number | null; pipeline: number };

export function pipelineFor(project: Project): PipelineItem[] {
  return [
    {
      id: "pdf",
      title: "Original PDF",
      detail: project.pdfFilename,
      artifacts: [{ id: "pdf", title: "Original PDF", kind: "pdf" }],
      mainArtifactId: "pdf",
    },
  ];
}

// What the artifact view shows when the user hasn't picked anything: the latest item's main artifact.
export function defaultArtifactId(items: PipelineItem[]): string | null {
  return items.at(-1)?.mainArtifactId ?? null;
}

export function findArtifact(
  items: PipelineItem[],
  artifactId: string,
): { item: PipelineItem; artifact: Artifact } | null {
  for (const item of items) {
    const artifact = item.artifacts.find((a) => a.id === artifactId);
    if (artifact) return { item, artifact };
  }
  return null;
}

// No stages yet: made-up values, to see what the progress circles look like.
export function progressOf(_items: PipelineItem[]): Progress {
  return { stage: 0.15, pipeline: 0.7 };
}
