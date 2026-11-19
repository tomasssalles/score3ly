// What the code declares about each step (docs/overview.md §5.1): its title, its kind, its config form, and how its
// outputs are shown as artifacts. The database only stores a stage's step id.

import { pageOfItem, STEP_KINDS, systemOfItem, type StepId } from "@score3ly/core";
import type { ApiStage } from "./api";
import type { Artifact, StageKind } from "./pipeline";
import { whoOf, type ChainStage } from "./attribution.ts";
import { configError, configOf, resolveConfig, MAX_DPI, MIN_DPI } from "./rasterize.ts";
import type { PageRecipe, PdfRecipe } from "./recipes.ts";
import { FIX_LAYOUT_VERSION } from "./fixLayout.ts";
import { analyzeOutputs, FIX_METADATA_VERSION } from "./fixMetadata.ts";
import { FIX_OBSERVATIONS_VERSION } from "./fixObservations.ts";
import { FIX_SKEW_VERSION } from "./fixSkew.ts";
import { MAX_MAX_ANGLE, MIN_MAX_ANGLE, skewConfigError, skewConfigOf } from "./skewAnalysis.ts";
import { DEFAULT_ENGRAVE_CONFIG, engraveConfigOf, PAGE_SIZES } from "./engravePage.ts";
import { fixMeiStart } from "./fixMei.ts";
import { humanReviewStart } from "./humanReview.ts";
import { latestOutput, latestProducer, latestStage, musicSources, reviewInputIds } from "./stageInputs.ts";

// One field of a step's config form.
export type ConfigField = {
  key: string;
  label: string;
  // "modelConfig": an LLM stage's model config, picked from the configs, with "Apply to the remaining stages planned in
  // this pipeline" grouped under it (docs/llm.md, "Which config a stage uses").
  kind: "text" | "number" | "choice" | "modelConfig";
  options?: { value: string; label: string }[]; // a choice's
  hint?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
};

export type ConfigValues = Record<string, string | number>;

// What a config is checked against besides itself, and what its fields offer: the PDF's page count (null while
// unknown); the model configs (those not deleted, and the stage's own if it was deleted, marked so); how many LLM stages
// come after the stage, which the model config can be applied to as well.
export type ConfigContext = {
  pageCount: number | null;
  modelConfigs: { id: string; name: string; deleted: boolean; unsupported: boolean }[];
  laterLlmStages: number;
};

export type StepConfig = {
  fields: ConfigField[];
  read: (stored: Record<string, unknown> | null) => ConfigValues; // the stored config, with defaults
  // Why the values can't be used, or null. Checked before saving, so a stage is never replaced by one that can't run.
  check: (values: ConfigValues, context: ConfigContext) => string | null;
};

export type StepInfo = {
  title: string;
  kind: StageKind; // core's (`STEP_KINDS`): never changes for a step
  fixes: string[]; // the manual steps that can be added after it, by id
  config?: StepConfig; // none: nothing to set
  // The first is the main one. `earlier` are the stages before it in the pipeline, for its inputs.
  artifacts: (stage: ApiStage, earlier: ApiStage[]) => Artifact[];
};

// A step as declared here: everything but its kind, which is core's.
type StepDeclaration = Omit<StepInfo, "kind">;

// Every LLM stage's config: its model config, so far nothing else (docs/llm.md, "Which config a stage uses"). Another
// setting of an LLM step would be a field beside it; "Apply to the remaining stages…" changes only the model config.
export const LLM_CONFIG: StepConfig = {
  fields: [{ key: "modelConfigId", label: "Model", kind: "modelConfig" }],
  read: (stored) => ({ modelConfigId: typeof stored?.modelConfigId === "string" ? stored.modelConfigId : "" }),
  check: (values, { modelConfigs }) => {
    const picked = modelConfigs.find((c) => c.id === values.modelConfigId);
    if (!picked) return "Pick a model config.";
    if (picked.deleted) return `"${picked.name}" was deleted: pick another model config.`;
    return picked.unsupported ? `The app no longer supports "${picked.name}": pick another model config.` : null;
  },
};

// The page images of the latest `rasterize` before a stage: what each page is made from, by page number.
function pageRecipes(earlier: ApiStage[]): Map<number, PageRecipe> {
  const rasterize = latestProducer(earlier, "page_image");
  const recipes = new Map<number, PageRecipe>();
  for (const output of rasterize?.outputs ?? []) {
    const page = pageOfItem(output.item);
    if (output.type === "page_image" && page !== null && output.recipe) recipes.set(page, output.recipe as PageRecipe);
  }
  return recipes;
}

// What the code declares about each step; its kind is core's (`STEP_KINDS`). Ingest, Rasterize and Skew detection here,
// the others below, after what they use; all of them in `STEPS`.
const FIRST_STEPS = {
  ingest: {
    title: "Ingest",
    fixes: [],
    artifacts: (stage) =>
      stage.outputs.some((output) => output.type === "pdf")
        ? [{ id: `${stage.id}.pdf`, title: "Original PDF", kind: "pdf", count: 1 }]
        : [],
  },
  rasterize: {
    title: "Rasterize",
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
    title: "Skew detection",
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
} satisfies Partial<Record<StepId, StepDeclaration>>;

const layoutStep: StepDeclaration = {
  title: "Layout",
  fixes: ["fix_layout"],
  config: LLM_CONFIG,
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

const fixLayoutStep: StepDeclaration = {
  title: "Fix layout",
  fixes: [],
  // The pages of the layout before it, each with its own layout once saved, else the model's. While WIP, the
  // artifact is the editor.
  artifacts: (stage, earlier) => {
    const recipes = pageRecipes(earlier);
    const layout = latestStage(earlier, ["layout"]);
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

const fixSkewStep: StepDeclaration = {
  title: "Fix skew",
  fixes: [],
  // The pages of the skew analysis before it, each with its own lines once saved, else the analysis's. While WIP,
  // the artifact is the editor.
  artifacts: (stage, earlier) => {
    const recipes = pageRecipes(earlier);
    const skew = latestStage(earlier, ["skew_analysis"]);
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
  const layout = latestProducer(earlier, "layout");
  return (layout?.outputs ?? [])
    .filter((o) => o.type === "layout" && o.contentSha256 !== null)
    .flatMap((o) => {
      const page = pageOfItem(o.item);
      const recipe = page === null ? undefined : recipes.get(page);
      return page === null || !recipe ? [] : [{ page, recipe, layoutSha256: o.contentSha256! }];
    })
    .sort((a, b) => a.page - b.page);
}

const analyzeStep: StepDeclaration = {
  title: "Analyze",
  fixes: ["fix_metadata", "fix_observations"],
  config: LLM_CONFIG,
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
        analysis: { view: "metadata", sha256: metadata },
      });
    }
    if (observations) {
      artifacts.push({
        id: `${stage.id}.observations`,
        title: "Observations",
        kind: "json",
        count: 1,
        pages,
        analysis: { view: "observations", sha256: observations },
      });
    }
    return artifacts;
  },
};

const fixMetadataStep: StepDeclaration = {
  title: "Fix metadata",
  fixes: [],
  // The metadata the user saved, else `analyze`'s, with the pages. While WIP, the artifact is the form. The pages
  // carry their layouts, for the systems a piece can start at.
  artifacts: (stage, earlier) => {
    const parents = analyzeOutputs(latestStage(earlier, ["analyze"]));
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
          parents: { metadata: parents.metadata.id, pieces: parents.pieces?.id },
        },
        editor,
      },
    ];
  },
};

const fixObservationsStep: StepDeclaration = {
  title: "Fix observations",
  fixes: [],
  // The observations the user saved, else `analyze`'s, with the pages and their layouts (the boxes, and the systems
  // and bar lines places are picked from). While WIP, the artifact is the form.
  artifacts: (stage, earlier) => {
    const analyze = latestStage(earlier, ["analyze"]);
    const parent = analyze?.outputs.find((o) => o.item === "" && o.type === "observations" && o.contentSha256);
    if (!parent) return [];
    const own = stage.outputs.find((o) => o.item === "" && o.type === "observations")?.contentSha256;
    const editor = stage.status === "wip" ? { stageId: stage.id, step: "fix_observations" } : undefined;
    return [
      {
        id: `${stage.id}.observations`,
        title: "Observations",
        kind: "json",
        count: 1,
        pages: layoutPages(earlier),
        analysis: { view: "observations", sha256: own ?? parent.contentSha256!, parents: { observations: parent.id } },
        editor,
      },
    ];
  },
};

// The Transcription (§6) of a stage that produces the extraction (`transcribed`), as a later stage shows it: the
// systems with their music, issues and warnings. The pages of the latest layout come along, for the systems' crops,
// and the latest pieces, for the renderings. `extra`: a review's calls, whose entries the view applies to the issues, or
// an Apply review's, whose reverts and changes it shows.
function transcription(
  stage: ApiStage,
  transcribed: ApiStage,
  earlier: ApiStage[],
  extra: Pick<NonNullable<Artifact["extraction"]>, "review" | "apply" | "human"> = {},
): Artifact[] {
  const systems = transcribed.outputs
    .filter((o) => o.type === "extraction" && o.contentSha256 !== null)
    .map((o) => ({ item: o.item, sha256: o.contentSha256!, index: systemOfItem(o.item)?.index ?? 1 }));
  if (systems.length === 0) return [];
  const checksSha256 = transcribed.outputs.find((o) => o.item === "" && o.type === "score_checks")?.contentSha256 ?? null;
  const piecesSha256 = latestOutput(earlier, "pieces")?.output.contentSha256 ?? null;
  const pages = layoutPages(earlier);
  const chain = choosingChain([...earlier, stage]);
  const extraction = { systems, checksSha256, piecesSha256, chain: chain.slice(0, -1), who: chain.at(-1)!.who, ...extra };
  return [{ id: `${stage.id}.music`, title: "Transcription", kind: "music", count: systems.length, item: "System", pages, extraction }];
}

const extractStep: StepDeclaration = {
  title: "Extract",
  fixes: [],
  config: LLM_CONFIG,
  artifacts: (stage, earlier) => transcription(stage, stage, earlier),
};

const reviewStep: StepDeclaration = {
  title: "Review",
  fixes: [],
  config: LLM_CONFIG,
  // The Transcription it reviewed, with its issues as the review leaves them: its calls' entries, and, once it is
  // done, its agreements.
  artifacts: (stage, earlier) => {
    const transcribed = latestProducer(earlier, "extraction");
    if (!transcribed) return [];
    const calls = stage.outputs.filter((o) => o.type === "review" && o.contentSha256).map((o) => ({ item: o.item, sha256: o.contentSha256! }));
    if (calls.length === 0) return [];
    return transcription(stage, transcribed, earlier, { review: { stageId: stage.id, calls, done: stage.status === "done" } });
  },
};

const applyReviewStep: StepDeclaration = {
  title: "Apply review",
  fixes: [],
  config: LLM_CONFIG,
  // The new transcription, once it is stored (every call in), with what its calls reverted and changed.
  artifacts: (stage, earlier) => {
    const calls = stage.outputs.filter((o) => o.type === "apply_review" && o.contentSha256).map((o) => ({ item: o.item, sha256: o.contentSha256! }));
    return transcription(stage, stage, earlier, { apply: { stageId: stage.id, calls } });
  },
};

// A review done by a person (docs/stages/music.md, `human_review`), added with "Add Human review" after an Apply review,
// not as a fix. Its artifact is the Transcription it reviews, with its entries; while WIP, the screen for the review.
const humanReviewStep: StepDeclaration = {
  title: "Human review",
  fixes: [],
  artifacts: (stage, earlier) => {
    const transcribed = latestProducer(earlier, "extraction");
    if (!transcribed) return [];
    const sha256 = stage.outputs.find((o) => o.item === "" && o.type === "human_review")?.contentSha256 ?? null;
    const artifacts = transcription(stage, transcribed, earlier, { human: { stageId: stage.id, sha256 } });
    const editor = stage.status === "wip" ? { stageId: stage.id, step: "human_review" } : undefined;
    return artifacts.map((a) => ({ ...a, editor }));
  },
};

// The stages that choose or apply answers of issues, in the pipeline's order, with what they stored and their labels
// as the cards name them ("Review 2", "Human review 1"; attribution.ts).
export function choosingChain(stages: ApiStage[]): ChainStage[] {
  const turns = new Map<string, number>();
  const chain: ChainStage[] = [];
  for (const stage of stages) {
    const turn = (turns.get(stage.step) ?? 0) + 1;
    const who = whoOf(stage.step, turn);
    const sha256s = (type: string) => stage.outputs.filter((o) => o.type === type && o.contentSha256).map((o) => o.contentSha256!);
    if (stage.step === "extract" || stage.step === "apply_review") {
      const checks = stage.outputs.find((o) => o.item === "" && o.type === "score_checks")?.contentSha256 ?? null;
      chain.push({ who, step: stage.step, systems: sha256s("extraction"), checks });
    } else if (stage.step === "review") {
      chain.push({ who, step: "review", calls: sha256s("review"), done: stage.status === "done" });
    } else if (stage.step === "human_review") {
      chain.push({ who, step: "human_review", sha256: sha256s("human_review")[0] ?? null });
    } else continue;
    turns.set(stage.step, turn);
  }
  return chain;
}

const buildMeiStep: StepDeclaration = {
  title: "Build MEI",
  // "Fix MEI manually" is in the "⋮" of the stage that creates the MEI (§6).
  fixes: ["fix_mei"],
  // The MEI file, in the MEI view: the file beside its engraving, on pages of the default size (the PDF with the chosen
  // size is Engrave's).
  artifacts: (stage) => {
    const mei = stage.outputs.find((o) => o.item === "" && o.type === "mei" && o.contentSha256);
    if (!mei) return [];
    return [{ id: `${stage.id}.mei`, title: "MEI", kind: "mei", count: 1, engraving: { view: "mei", meiSha256: mei.contentSha256!, config: DEFAULT_ENGRAVE_CONFIG } }];
  },
};

const engraveStep: StepDeclaration = {
  title: "Engrave",
  fixes: [],
  config: {
    fields: [
      {
        key: "pageSize",
        label: "Page size",
        kind: "choice",
        options: Object.entries(PAGE_SIZES).map(([value, { label }]) => ({ value, label })),
      },
    ],
    read: (stored) => engraveConfigOf(stored),
    check: () => null,
  },
  // The PDF, made from its stored recipe (the MEI it engraved and the page size), shown as the file it is. Made by
  // today's code: a recipe of other versions or options isn't marked (decided; docs/stages/engrave.md).
  artifacts: (stage) => {
    const pdf = stage.outputs.find((o) => o.item === "" && o.type === "pdf" && o.recipe);
    const recipe = pdf?.recipe as Partial<PdfRecipe> | undefined;
    if (typeof recipe?.mei !== "string") return [];
    return [{ id: `${stage.id}.pdf`, title: "PDF", kind: "pdf", count: 1, engraving: { view: "pdf", meiSha256: recipe.mei, config: engraveConfigOf(recipe.config ?? null) } }];
  },
};

const fixMeiStep: StepDeclaration = {
  title: "Fix MEI",
  fixes: [],
  // The MEI, as the MEI view: the editor while WIP. Its texts are loaded by the view (fixMei.ts).
  artifacts: (stage, earlier) => {
    const editor = stage.status === "wip" ? { stageId: stage.id, step: "fix_mei" } : undefined;
    return [{ id: `${stage.id}.mei`, title: "MEI", kind: "mei", count: 1, fixMei: { stage, earlier }, editor }];
  },
};


// Every step, as `stepInfo` gives it: a step core knows that isn't declared here fails the typecheck.
const DECLARED: Record<StepId, StepDeclaration> = {
  ...FIRST_STEPS,
  layout: layoutStep,
  fix_layout: fixLayoutStep,
  fix_skew: fixSkewStep,
  analyze: analyzeStep,
  fix_metadata: fixMetadataStep,
  fix_observations: fixObservationsStep,
  extract: extractStep,
  review: reviewStep,
  apply_review: applyReviewStep,
  human_review: humanReviewStep,
  build_mei: buildMeiStep,
  engrave: engraveStep,
  fix_mei: fixMeiStep,
};
export const STEPS = Object.fromEntries(
  (Object.keys(DECLARED) as StepId[]).map((step) => [step, { ...DECLARED[step], kind: STEP_KINDS[step] }]),
) as Record<StepId, StepInfo>;

// What a manual step needs to be added after a stage (docs/database.md): its version, page count and inputs. `earlier`:
// the stages up to and including that one.
export const FIX_STARTS: Record<string, (after: ApiStage, earlier: ApiStage[]) => { stepVersion: number; pageCount: number | null; inputIds: string[] }> = {
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
  fix_observations: (after) => {
    const inputs = after.outputs.filter((o) => o.item === "" && o.type === "observations");
    return { stepVersion: FIX_OBSERVATIONS_VERSION, pageCount: after.pageCount, inputIds: inputs.map((o) => o.id) };
  },
  fix_mei: (after) => fixMeiStart(after),
  // Added with its Apply review ("Add Human review"), not as a fix; here for when it is carried.
  human_review: (after) => humanReviewStart(after),
};

// What a carried manual stage would read now (docs/overview.md §5.5): the inputs it would get if it were added now after the
// stage it fixes, the latest stage before it that isn't manual.
export function carriedInputs(stages: ApiStage[], index: number): string[] {
  // A further review reads what any review reads (§5.5: carried like a manual stage).
  if (stages[index].step === "review") return reviewInputIds(musicSources(stages.slice(0, index)));
  let after = index - 1;
  while (after >= 0 && stepInfo(stages[after].step).kind === "manual") after--;
  const start = FIX_STARTS[stages[index].step];
  if (after < 0 || !start) return [];
  return start(stages[after], stages.slice(0, after + 1)).inputIds;
}

// A step this version of the app doesn't know (e.g. from a newer one) is shown by its id, without artifacts.
export function stepInfo(step: string): StepInfo {
  return Object.hasOwn(STEPS, step) ? STEPS[step as StepId] : { title: step, kind: "computed", fixes: [], artifacts: () => [] };
}
