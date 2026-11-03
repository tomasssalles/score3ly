// Runs `build_mei` (docs/stages/engrave.md): the full score's MEI, built from the latest extraction, its layout, the
// pieces and the metadata, stored as the stage's one output (item '', type `mei`).

import { LENS_VERSION } from "@score3ly/notation";
import { fetchJsonContent, putContent } from "./api";
import { BUILD_MEI_VERSION, buildMeiStageKey, engraveNote, engraveSources, loadScore, meiText, sourceIds } from "./engrave";
import { CannotStart, runPlan, type StageRun } from "./stageRunner";

export async function runBuildMei(run: StageRun): Promise<void> {
  const { stage, pipeline } = run;
  const earlier = pipeline.stages.slice(0, pipeline.stages.findIndex((s) => s.id === stage.id));
  const sources = engraveSources(earlier);
  if ("missing" in sources) throw new CannotStart(sources.missing);
  const rasterize = [...earlier].reverse().find((s) => s.step === "rasterize");
  const inputIds = sourceIds(sources);
  const { score, metadata } = await loadScore(sources, fetchJsonContent);
  await runPlan(run, {
    stepVersion: BUILD_MEI_VERSION,
    config: {},
    stageKey: await buildMeiStageKey(sources, LENS_VERSION),
    // All selected pages: the header comes from the metadata, read from every page (§5.8).
    pageCount: rasterize?.outputs.filter((o) => o.type === "page_image").length ?? null,
    inputIds,
    note: engraveNote(score),
    items: [
      {
        item: "",
        type: "mei",
        make: async () => ({ contentSha256: await putContent(new TextEncoder().encode(meiText(score, metadata)), "application/xml"), inputIds }),
      },
    ],
  });
}
