// What the code declares about each step (DESIGN.md §5.1): its title, its kind, and how its outputs are shown as
// artifacts. The database only stores a stage's step id.

import type { ApiStage } from "./api";
import type { Artifact, StageKind } from "./pipeline";
import { pageOfItem, type PageRecipe } from "./rasterize.ts";

export type StepInfo = {
  title: string;
  kind: StageKind; // never changes for a step (steps.test.ts)
  optional: boolean; // added by the user, not part of the recipe: can be dropped
  fixes: string[]; // the manual stages that can be added after it
  artifacts: (stage: ApiStage) => Artifact[]; // the first is the main one
};

export const STEPS: Record<string, StepInfo> = {
  ingest: {
    title: "Ingest",
    kind: "ingest",
    optional: false,
    fixes: [],
    artifacts: (stage) =>
      stage.outputs.some((output) => output.type === "pdf")
        ? [{ id: `${stage.id}.pdf`, title: "Original PDF", kind: "pdf", count: 1 }]
        : [],
  },
  rasterize: {
    title: "Rasterize",
    kind: "computed",
    optional: false,
    fixes: [],
    artifacts: (stage) => {
      const pages = stage.outputs
        .filter((output) => output.type === "page_image" && output.recipe !== null)
        .map((output) => ({ page: pageOfItem(output.item) ?? 0, recipe: output.recipe as PageRecipe }))
        .sort((a, b) => a.page - b.page);
      return pages.length === 0
        ? []
        : [{ id: `${stage.id}.pages`, title: "Page images", kind: "images", count: pages.length, item: "Page", pages }];
    },
  },
};

// A step this version of the app doesn't know (e.g. from a newer one) is shown by its id, without artifacts.
export function stepInfo(step: string): StepInfo {
  return STEPS[step] ?? { title: step, kind: "computed", optional: false, fixes: [], artifacts: () => [] };
}
