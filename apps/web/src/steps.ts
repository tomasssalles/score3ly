// What the code declares about each step (DESIGN.md §5.1): its title, its kind, its config form, and how its
// outputs are shown as artifacts. The database only stores a stage's step id.

import type { ApiStage } from "./api";
import type { Artifact, StageKind } from "./pipeline";
import { configError, configOf, MAX_DPI, MIN_DPI, pageOfItem, type PageRecipe } from "./rasterize.ts";
import { MAX_MAX_ANGLE, MIN_MAX_ANGLE, skewConfigError, skewConfigOf } from "./skewAnalysis.ts";

// One field of a step's config form.
export type ConfigField = {
  key: string;
  label: string;
  kind: "text" | "number";
  hint?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
};

export type ConfigValues = Record<string, string | number>;

export type StepConfig = {
  fields: ConfigField[];
  read: (stored: Record<string, unknown> | null) => ConfigValues; // the stored config, with defaults
  check: (values: ConfigValues) => string | null; // why the values can't be used, or null
};

export type StepInfo = {
  title: string;
  kind: StageKind; // never changes for a step (steps.test.ts)
  optional: boolean; // added by the user, not part of the recipe: can be dropped
  fixes: string[]; // the manual stages that can be added after it
  config?: StepConfig; // none: nothing to set
  // The first is the main one. `earlier` are the stages before it in the pipeline, for its inputs.
  artifacts: (stage: ApiStage, earlier: ApiStage[]) => Artifact[];
};

// The page images of the latest `rasterize` before a stage: what each page is made from, by page number.
function pageRecipes(earlier: ApiStage[]): Map<number, PageRecipe> {
  const rasterize = [...earlier].reverse().find((stage) => stage.step === "rasterize");
  const recipes = new Map<number, PageRecipe>();
  for (const output of rasterize?.outputs ?? []) {
    const page = pageOfItem(output.item);
    if (output.type === "page_image" && page !== null && output.recipe) recipes.set(page, output.recipe as PageRecipe);
  }
  return recipes;
}

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
    config: {
      fields: [
        {
          key: "pages",
          label: "Pages",
          kind: "text",
          placeholder: "All pages",
          hint: 'The PDF\'s own page numbers, counted from 1, not the numbers printed on the pages. For example "1, 41-47": the cover, for the metadata, and one piece.',
        },
        {
          key: "dpi",
          label: "Resolution for vector pages (dpi)",
          kind: "number",
          min: MIN_DPI,
          max: MAX_DPI,
          step: 1,
          hint: "Scanned pages keep their own resolution.",
        },
      ],
      read: (stored) => configOf(stored),
      check: (values) => configError({ pages: String(values.pages).trim(), dpi: Number(values.dpi) }),
    },
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
  skew_analysis: {
    title: "Skew analysis",
    kind: "computed",
    optional: false,
    fixes: [],
    config: {
      fields: [
        {
          key: "maxAngle",
          label: "Maximum angle (degrees)",
          kind: "number",
          min: MIN_MAX_ANGLE,
          max: MAX_MAX_ANGLE,
          step: 0.1,
          hint: "Lines more skewed than this aren't looked for. Raise it for very crooked pages where no lines were found; the analysis takes longer.",
        },
      ],
      read: (stored) => skewConfigOf(stored),
      check: (values) => skewConfigError({ maxAngle: Number(values.maxAngle) }),
    },
    artifacts: (stage, earlier) => {
      const recipes = pageRecipes(earlier);
      const pages = stage.outputs
        .filter((output) => output.type === "skew" && output.contentSha256 !== null)
        .flatMap((output) => {
          const page = pageOfItem(output.item);
          const recipe = page === null ? undefined : recipes.get(page);
          return page === null || !recipe ? [] : [{ page, recipe, linesSha256: output.contentSha256! }];
        })
        .sort((a, b) => a.page - b.page);
      return pages.length === 0
        ? []
        : [{ id: `${stage.id}.lines`, title: "Staff lines", kind: "images", count: pages.length, item: "Page", pages }];
    },
  },
};

STEPS.layout = {
  title: "Layout",
  kind: "llm",
  optional: false,
  fixes: [],
  artifacts: (stage, earlier) => {
    const recipes = pageRecipes(earlier);
    const pages = stage.outputs
      .filter((output) => output.type === "layout" && output.contentSha256 !== null)
      .flatMap((output) => {
        const page = pageOfItem(output.item);
        const recipe = page === null ? undefined : recipes.get(page);
        return page === null || !recipe ? [] : [{ page, recipe, layoutSha256: output.contentSha256! }];
      })
      .sort((a, b) => a.page - b.page);
    return pages.length === 0
      ? []
      : [{ id: `${stage.id}.layout`, title: "Layout", kind: "images", count: pages.length, item: "Page", pages }];
  },
};

// A step this version of the app doesn't know (e.g. from a newer one) is shown by its id, without artifacts.
export function stepInfo(step: string): StepInfo {
  return STEPS[step] ?? { title: step, kind: "computed", optional: false, fixes: [], artifacts: () => [] };
}
