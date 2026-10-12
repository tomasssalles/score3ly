// Runs `rasterize` (DESIGN.md §6): every selected page's image is made (or found in the device's cache) and its
// recipe recorded. The images are made now, not only when needed, because they are needed right away: they are
// the stage's artifact, shown when it finishes, and a page that can't be drawn should fail this stage, not a later
// one.

import { keyOf } from "./keys";
import { openPdfForImages, pageImage } from "./pageImages";
import { configOf, pageItem, pageRecipe, RASTERIZE_VERSION, resolveConfig, stageKey } from "./rasterize";
import { CannotStart, runPlan, type StageRun } from "./stageRunner";

export async function runRasterize(run: StageRun): Promise<void> {
  const { project, stage, pipeline } = run;
  const pdfOutput = pipeline.stages.flatMap((s) => s.outputs).find((o) => o.type === "pdf");
  if (!pdfOutput) throw new CannotStart("The pipeline has no PDF.");
  const { pageCount, pdfjsVersion } = await openPdfForImages(project.pdfSha256);
  const resolved = resolveConfig(configOf(stage.config), pageCount);
  if ("error" in resolved) throw new CannotStart(resolved.error);
  const { config, pages } = resolved;
  await runPlan(run, {
    stepVersion: RASTERIZE_VERSION,
    config,
    stageKey: await stageKey(config, project.pdfSha256, pdfjsVersion),
    pageCount: pages.length,
    inputIds: [pdfOutput.id],
    note: pages.length === 1 ? "1 page" : `${pages.length} pages`,
    items: pages.map((page) => ({
      item: pageItem(page),
      type: "page_image",
      make: async () => {
        const recipe = pageRecipe(project.pdfSha256, page, config.dpi, pdfjsVersion);
        await pageImage(recipe);
        return { recipeKey: await keyOf(recipe), recipe, inputIds: [pdfOutput.id] };
      },
    })),
  });
}
