// Runs `engrave` (docs/stages/engrave.md): the latest MEI (`fix_mei`'s right before it, else `build_mei`'s), engraved by
// Verovio with the config's page size and made into a PDF. The stage's one output (item '', type `pdf`) is the PDF's
// recipe; the PDF itself is cached on the device and made again where it is missing (engraving.ts).

import { keyOf } from "@score3ly/core";
import { ENGRAVE_VERSION, engraveConfigOf, latestMei, pdfPageCount } from "./engrave";
import { engravedPdf } from "./engraving";
import { pdfRecipe } from "./recipes";
import { CannotStart, runPlan, type StageRun } from "./stageRunner";
import { latestProducer } from "./stageInputs";
import { count } from "./format.ts";

export async function runEngrave(run: StageRun): Promise<void> {
  const { stage, pipeline } = run;
  const earlier = pipeline.stages.slice(0, pipeline.stages.findIndex((s) => s.id === stage.id));
  const mei = latestMei(earlier);
  if ("missing" in mei) throw new CannotStart(mei.missing);
  const rasterize = latestProducer(earlier, "page_image");
  const config = engraveConfigOf(stage.config);
  const recipe = pdfRecipe(mei.sha256, config);
  const recipeKey = await keyOf(recipe);
  let pages: number | null = null;
  const countPages = async () => pdfPageCount(new TextDecoder("latin1").decode(await (await engravedPdf({ view: "pdf", meiSha256: mei.sha256, config })).arrayBuffer()));
  await runPlan(run, {
    stepVersion: ENGRAVE_VERSION,
    config,
    stageKey: await keyOf({ step: "engrave", version: ENGRAVE_VERSION, recipe }),
    pageCount: rasterize?.outputs.filter((o) => o.type === "page_image").length ?? null,
    inputIds: [mei.id],
    // Counted from the PDF, made again (or found on the device) when an earlier run recorded it.
    note: async () => {
      return count(pages ?? (await countPages()), "page");
    },
    items: [
      {
        item: "",
        type: "pdf",
        make: async () => {
          pages = await countPages();
          return { recipeKey, recipe, inputIds: [mei.id] };
        },
      },
    ],
  });
}
