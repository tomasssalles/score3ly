// What finishing a manual stage records besides marking it done, by step (DESIGN.md §5.8): the outputs of the items
// the person didn't change. Returns the card's note.

import type { ApiPipeline, ApiStage, Project } from "./api";
import { finishFixLayout } from "./finishFixLayout";
import { finishFixMetadata } from "./finishFixMetadata";
import { finishFixSkew } from "./finishFixSkew";

export const FINISHERS: Record<string, (project: Project, stage: ApiStage, pipeline: ApiPipeline) => Promise<string>> = {
  fix_skew: finishFixSkew,
  fix_layout: finishFixLayout,
  fix_metadata: finishFixMetadata,
};
