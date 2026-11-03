// Runs `engrave` (docs/stages/engrave.md): the latest MEI (`fix_mei`'s right before it, else `build_mei`'s), engraved by
// Verovio with the config's page size and made into a PDF. The stage's one output (item '', type `pdf`) is the PDF's
// recipe; the PDF itself is cached on the device and made again where it is missing (engraving.ts).

import { keyOf } from "@score3ly/core";
import { ENGRAVE_VERSION, engraveConfigOf, latestMei, pdfPageCount } from "./engrave";
import { engravedPdf, pdfRecipe } from "./engraving";
import { CannotStart, runPlan, type StageRun } from "./stageRunner";

export async function runEngrave(run: StageRun): Promise<void> {
  const { stage, pipeline } = run;
  const earlier = pipeline.stages.slice(0, pipeline.stages.findIndex((s) => s.id === stage.id));
  const mei = latestMei(earlier);
  if ("missing" in mei) throw new CannotStart(mei.missing);
  const rasterize = [...earlier].reverse().find((s) => s.step === "rasterize");
  const config = engraveConfigOf(stage.config);
  const recipe = pdfRecipe(mei.sha256, config);
  const recipeKey = await keyOf(recipe);
  let pages = 0;
  await runPlan(run, {
    stepVersion: ENGRAVE_VERSION,
    config,
    stageKey: await keyOf({ step: "engrave", version: ENGRAVE_VERSION, recipe }),
    pageCount: rasterize?.outputs.filter((o) => o.type === "page_image").length ?? null,
    inputIds: [mei.id],
    note: () => `${pages} page${pages === 1 ? "" : "s"}`,
    items: [
      {
        item: "",
        type: "pdf",
        make: async () => {
          const pdf = await engravedPdf({ view: "pdf", meiSha256: mei.sha256, config });
          pages = pdfPageCount(new TextDecoder("latin1").decode(await pdf.arrayBuffer()));
          return { recipeKey, recipe, inputIds: [mei.id] };
        },
      },
    ],
  });
}
