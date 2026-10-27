// Runs `engrave` (docs/stages/engrave.md): the full score's MEI, built from the latest extraction, its layout, the pieces and the
// metadata, or taken as it is from `fix_mei` right before it, stored as the stage's one output (item '', type
// `mei`). The engraving itself is made when it is shown or downloaded (EngravingView.tsx).

import { LENS_VERSION } from "@score3ly/notation";
import { fetchJsonContent, fetchTextContent, putContent } from "./api";
import { ENGRAVE_VERSION, engraveConfigOf, engraveInput, engraveNote, engraveStageKey, loadScore, meiNote, meiText, sourceIds } from "./engrave";
import { CannotStart, runPlan, type StageRun } from "./stageRunner";

export async function runEngrave(run: StageRun): Promise<void> {
  const { stage, pipeline } = run;
  const earlier = pipeline.stages.slice(0, pipeline.stages.findIndex((s) => s.id === stage.id));
  const input = engraveInput(earlier);
  if ("missing" in input) throw new CannotStart(input.missing);
  const rasterize = [...earlier].reverse().find((s) => s.step === "rasterize");
  const config = engraveConfigOf(stage.config);

  const inputIds = "edited" in input ? [input.edited.id] : sourceIds(input.built);
  let note: string;
  let make: () => Promise<string>; // the stored MEI's hash
  if ("edited" in input) {
    const { sha256 } = input.edited;
    note = meiNote(await fetchTextContent(sha256));
    make = async () => sha256;
  } else {
    const { score, metadata } = await loadScore(input.built, fetchJsonContent);
    note = engraveNote(score);
    make = () => putContent(new TextEncoder().encode(meiText(score, metadata)), "application/xml");
  }
  await runPlan(run, {
    stepVersion: ENGRAVE_VERSION,
    config,
    stageKey: await engraveStageKey(config, input, LENS_VERSION),
    // All selected pages: the header comes from the metadata, read from every page (§5.8).
    pageCount: rasterize?.outputs.filter((o) => o.type === "page_image").length ?? null,
    inputIds,
    note,
    items: [{ item: "", type: "mei", make: async () => ({ contentSha256: await make(), inputIds }) }],
  });
}
