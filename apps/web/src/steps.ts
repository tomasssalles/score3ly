// What the code declares about each step (DESIGN.md §5.1): its title, its kind, its config form, and how its
// outputs are shown as artifacts. The database only stores a stage's step id.

import type { ApiStage } from "./api";
import type { Artifact, StageKind } from "./pipeline";
import { configError, configOf, resolveConfig, MAX_DPI, MIN_DPI, pageOfItem, type PageRecipe } from "./rasterize.ts";
import { FIX_LAYOUT_VERSION } from "./fixLayout.ts";
import { analyzeOutputs, FIX_METADATA_VERSION } from "./fixMetadata.ts";
import { FIX_SKEW_VERSION } from "./fixSkew.ts";
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

// What a config is checked against besides itself: the PDF's page count (null while unknown).
export type ConfigContext = { pageCount: number | null };

export type StepConfig = {
  fields: ConfigField[];
  read: (stored: Record<string, unknown> | null) => ConfigValues; // the stored config, with defaults
  // Why the values can't be used, or null. Checked before saving, so a stage is never replaced by one that can't run.
  check: (values: ConfigValues, context: ConfigContext) => string | null;
};

export type StepInfo = {
  title: string;
  kind: StageKind; // never changes for a step (steps.test.ts)
  optional: boolean; // added by the user, not part of the recipe: can be dropped
  fixes: string[]; // the manual steps that can be added after it, by id
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
      check: (values, { pageCount }) => {
        const config = { pages: String(values.pages).trim(), dpi: Number(values.dpi) };
        if (pageCount === null) return configError(config);
        const resolved = resolveConfig(config, pageCount);
        return "error" in resolved ? resolved.error : null;
      },
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
    fixes: ["fix_skew"],
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
  fixes: ["fix_layout"],
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

STEPS.fix_layout = {
  title: "Fix layout",
  kind: "manual",
  optional: true,
  fixes: [],
  // The pages of the layout before it, each with its own layout once saved, else the model's. While WIP, the
  // artifact is the editor.
  artifacts: (stage, earlier) => {
    const recipes = pageRecipes(earlier);
    const layout = [...earlier].reverse().find((s) => s.step === "layout");
    const own = new Map(stage.outputs.filter((o) => o.type === "layout").map((o) => [o.item, o]));
    const pages = (layout?.outputs ?? [])
      .filter((output) => output.type === "layout" && output.contentSha256 !== null)
      .flatMap((output) => {
        const page = pageOfItem(output.item);
        const recipe = page === null ? undefined : recipes.get(page);
        const layoutSha256 = own.get(output.item)?.contentSha256 ?? output.contentSha256!;
        return page === null || !recipe ? [] : [{ page, recipe, layoutSha256, item: output.item, parentId: output.id }];
      })
      .sort((a, b) => a.page - b.page);
    if (pages.length === 0) return [];
    const editor = stage.status === "wip" ? { stageId: stage.id, step: "fix_layout" } : undefined;
    return [{ id: `${stage.id}.layout`, title: "Layout", kind: "images", count: pages.length, item: "Page", pages, editor }];
  },
};

STEPS.fix_skew = {
  title: "Fix skew",
  kind: "manual",
  optional: true,
  fixes: [],
  // The pages of the skew analysis before it, each with its own lines once saved, else the analysis's. While WIP,
  // the artifact is the editor.
  artifacts: (stage, earlier) => {
    const recipes = pageRecipes(earlier);
    const skew = [...earlier].reverse().find((s) => s.step === "skew_analysis");
    const own = new Map(stage.outputs.filter((o) => o.type === "lines").map((o) => [o.item, o]));
    const pages = (skew?.outputs ?? [])
      .filter((output) => output.type === "skew" && output.contentSha256 !== null)
      .flatMap((output) => {
        const page = pageOfItem(output.item);
        const recipe = page === null ? undefined : recipes.get(page);
        const linesSha256 = own.get(output.item)?.contentSha256 ?? output.contentSha256!;
        return page === null || !recipe ? [] : [{ page, recipe, linesSha256, item: output.item, parentId: output.id }];
      })
      .sort((a, b) => a.page - b.page);
    if (pages.length === 0) return [];
    const editor = stage.status === "wip" ? { stageId: stage.id, step: "fix_skew" } : undefined;
    return [{ id: `${stage.id}.lines`, title: "Lines", kind: "images", count: pages.length, item: "Page", pages, editor }];
  },
};

// The pages of the latest layout (`layout` or `fix_layout`) before a stage, with their page images.
function layoutPages(earlier: ApiStage[]): { page: number; recipe: PageRecipe; layoutSha256: string }[] {
  const recipes = pageRecipes(earlier);
  const layout = [...earlier].reverse().find((s) => s.step === "layout" || s.step === "fix_layout");
  return (layout?.outputs ?? [])
    .filter((o) => o.type === "layout" && o.contentSha256 !== null)
    .flatMap((o) => {
      const page = pageOfItem(o.item);
      const recipe = page === null ? undefined : recipes.get(page);
      return page === null || !recipe ? [] : [{ page, recipe, layoutSha256: o.contentSha256! }];
    })
    .sort((a, b) => a.page - b.page);
}

STEPS.analyze = {
  title: "Analyze",
  kind: "llm",
  optional: false,
  fixes: ["fix_metadata"],
  // The metadata, with the pages as they are (to look for a field), and the observations, with the pages as the
  // layout numbers them (§6).
  artifacts: (stage, earlier) => {
    const pages = layoutPages(earlier);
    const of = (type: string) => stage.outputs.find((o) => o.item === "" && o.type === type)?.contentSha256 ?? null;
    const metadata = of("metadata");
    const observations = of("observations");
    const artifacts: Artifact[] = [];
    if (metadata) {
      artifacts.push({
        id: `${stage.id}.metadata`,
        title: "Metadata",
        kind: "json",
        count: 1,
        pages,
        analysis: { view: "metadata", sha256: metadata, confirmed: false },
      });
    }
    if (observations) {
      artifacts.push({
        id: `${stage.id}.observations`,
        title: "Observations",
        kind: "json",
        count: 1,
        pages,
        analysis: { view: "observations", sha256: observations, confirmed: false },
      });
    }
    return artifacts;
  },
};

STEPS.fix_metadata = {
  title: "Fix metadata",
  kind: "manual",
  optional: true,
  fixes: [],
  // The metadata the user saved, else `analyze`'s, with the pages. While WIP, the artifact is the form. The pages
  // carry their layouts, for the systems a piece can start at.
  artifacts: (stage, earlier) => {
    const parents = analyzeOutputs([...earlier].reverse().find((s) => s.step === "analyze"));
    if (!parents) return [];
    const own = stage.outputs.find((o) => o.item === "" && o.type === "metadata")?.contentSha256;
    const editor = stage.status === "wip" ? { stageId: stage.id, step: "fix_metadata" } : undefined;
    return [
      {
        id: `${stage.id}.metadata`,
        title: "Metadata",
        kind: "json",
        count: 1,
        pages: layoutPages(earlier),
        analysis: {
          view: "metadata",
          sha256: own ?? parents.metadata.contentSha256!,
          confirmed: false,
          parents: { metadata: parents.metadata.id, pieces: parents.pieces?.id },
        },
        editor,
      },
    ];
  },
};

// What a manual step needs to be added after a stage (DESIGN.md §5.8): its version, page count and inputs.
export const FIX_STARTS: Record<string, (after: ApiStage) => { stepVersion: number; pageCount: number | null; inputIds: string[] }> = {
  fix_skew: (after) => {
    const inputs = after.outputs.filter((o) => o.type === "skew");
    return { stepVersion: FIX_SKEW_VERSION, pageCount: inputs.length, inputIds: inputs.map((o) => o.id) };
  },
  fix_layout: (after) => {
    const inputs = after.outputs.filter((o) => o.type === "layout");
    return { stepVersion: FIX_LAYOUT_VERSION, pageCount: inputs.length, inputIds: inputs.map((o) => o.id) };
  },
  fix_metadata: (after) => {
    const inputs = after.outputs.filter((o) => o.item === "" && (o.type === "metadata" || o.type === "pieces"));
    return { stepVersion: FIX_METADATA_VERSION, pageCount: after.pageCount, inputIds: inputs.map((o) => o.id) };
  },
};

// A step this version of the app doesn't know (e.g. from a newer one) is shown by its id, without artifacts.
export function stepInfo(step: string): StepInfo {
  return STEPS[step] ?? { title: step, kind: "computed", optional: false, fixes: [], artifacts: () => [] };
}
