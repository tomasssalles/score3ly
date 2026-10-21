// Runs `engrave` (DESIGN.md §6): the full score's MEI, built from the latest extraction, its layout, the pieces and the
// metadata, stored as the stage's one output (item '', type `mei`). The engraving itself is made when it is shown or
// downloaded (EngravingView.tsx).

import { LENS_VERSION, meiString } from "@score3ly/notation";
import { REPOSITORY_URL } from "./about";
import { fetchJsonContent, putContent } from "./api";
import { ENGRAVE_VERSION, engraveConfigOf, engraveNote, engraveSources, engraveStageKey, loadScore, sourceIds } from "./engrave";
import { CannotStart, runPlan, type StageRun } from "./stageRunner";

export async function runEngrave(run: StageRun): Promise<void> {
  const { stage, pipeline } = run;
  const earlier = pipeline.stages.slice(0, pipeline.stages.findIndex((s) => s.id === stage.id));
  const sources = engraveSources(earlier);
  if ("missing" in sources) throw new CannotStart(sources.missing);
  const rasterize = [...earlier].reverse().find((s) => s.step === "rasterize");
  const config = engraveConfigOf(stage.config);

  const { score, metadata } = await loadScore(sources, fetchJsonContent);
  await runPlan(run, {
    stepVersion: ENGRAVE_VERSION,
    config,
    stageKey: await engraveStageKey(config, sources, LENS_VERSION),
    // All selected pages: the header comes from the metadata, read from every page (§5.8).
    pageCount: rasterize?.outputs.filter((o) => o.type === "page_image").length ?? null,
    inputIds: sourceIds(sources),
    note: engraveNote(score),
    items: [
      {
        item: "",
        type: "mei",
        make: async () => {
          const mei = meiString(score, { metadata, application: { name: "score3ly", version: __APP_VERSION__, url: REPOSITORY_URL } });
          const contentSha256 = await putContent(new TextEncoder().encode(mei), "application/xml");
          return { contentSha256, inputIds: sourceIds(sources) };
        },
      },
    ],
  });
}
