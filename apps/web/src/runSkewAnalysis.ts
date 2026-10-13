// Runs `skew_analysis` (DESIGN.md §6): per page of the latest `rasterize` before it, the page image (from the
// device's cache, or drawn again) is measured in the Web Worker, and what was found is stored as JSON in R2: the
// lines are what later stages and `fix_skew` build on, and must not move when measured again on another device.

import { putContent } from "./api";
import { canonicalJson } from "./keys";
import { measureSkew, pageImage } from "./pageImages";
import type { PageRecipe } from "./rasterize";
import { pageOfItem } from "./rasterize";
import { SKEW_ANALYSIS_VERSION, skewConfigError, skewConfigOf, skewNote, skewStageKey } from "./skewAnalysis";
import { CannotStart, runPlan, type StageRun } from "./stageRunner";

export async function runSkewAnalysis(run: StageRun): Promise<void> {
  const { stage, pipeline } = run;
  const position = pipeline.stages.findIndex((s) => s.id === stage.id);
  const rasterize = pipeline.stages
    .slice(0, position)
    .reverse()
    .find((s) => s.step === "rasterize");
  const pages = (rasterize?.outputs ?? [])
    .filter((o) => o.type === "page_image" && o.recipe !== null && o.recipeKey !== null)
    .map((o) => ({ output: o, page: pageOfItem(o.item) ?? 0, recipe: o.recipe as PageRecipe }))
    .sort((a, b) => a.page - b.page);
  if (!rasterize || rasterize.status !== "done" || pages.length === 0) {
    throw new CannotStart("there are no page images: Rasterize hasn't run.");
  }
  const config = skewConfigOf(stage.config);
  const error = skewConfigError(config);
  if (error) throw new CannotStart(error);

  let withLines = 0;
  await runPlan(run, {
    stepVersion: SKEW_ANALYSIS_VERSION,
    config,
    stageKey: await skewStageKey(
      config,
      pages.map((p) => p.output.recipeKey!),
    ),
    pageCount: pages.length,
    inputIds: pages.map((p) => p.output.id),
    // Pages recorded by a failed run aren't measured again, so they aren't counted: the note may then say less.
    note: () => skewNote(withLines, pages.length),
    items: pages.map(({ output, recipe }) => ({
      item: output.item,
      type: "skew",
      make: async () => {
        const { png } = await pageImage(recipe);
        const skew = await measureSkew(png, config.maxAngle);
        if (skew.lines.length > 0) withLines++;
        const json = new TextEncoder().encode(canonicalJson(skew));
        const contentSha256 = await putContent(json, "application/json");
        return { contentSha256, inputIds: [output.id] };
      },
    })),
  });
}
