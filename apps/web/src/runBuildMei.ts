// Runs `build_mei` (docs/stages/engrave.md): the full score's MEI, built from the latest extraction, its layout, the
// pieces and the metadata, stored as the stage's one output (item '', type `mei`).

import { LENS_VERSION, MEI_BUILDER_VERSION } from "@score3ly/notation";
import { fetchJsonContent, putContent } from "./api";
import { BUILD_MEI_VERSION, buildMeiStageKey, engraveNote, engraveSources, loadScore, meiText, sourceIds } from "./engrave";
import { CannotStart, runPlan, type StageRun } from "./stageRunner";
import { pageCountOf } from "./stageInputs";

export async function runBuildMei(run: StageRun): Promise<void> {
  const { stage, pipeline } = run;
  const earlier = pipeline.stages.slice(0, pipeline.stages.findIndex((s) => s.id === stage.id));
  const sources = engraveSources(earlier);
  if ("missing" in sources) throw new CannotStart(sources.missing);
  const inputIds = sourceIds(sources);
  const { score, metadata } = await loadScore(sources, fetchJsonContent);
  await runPlan(run, {
    stepVersion: BUILD_MEI_VERSION,
    config: {},
    stageKey: await buildMeiStageKey(sources, { lensVersion: LENS_VERSION, meiBuilderVersion: MEI_BUILDER_VERSION }),
    pageCount: pageCountOf(earlier),
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
