// Finishing a `fix_observations` stage (docs/stages/analyze.md): the observations are recorded, from what the user saved, else
// from `analyze`'s. Finishing confirms nothing: only what the user confirmed is.

import { fetchJsonContent, putContent, recordOutputs, type ApiPipeline, type ApiStage, type Project } from "./api";
import type { StoredObservations } from "./analyze";
import { jsonBytes } from "./finishFixMetadata";
import { fixNote } from "./fixMetadata";
import { changedItems, confirmedItems, normalizeObservations } from "./fixObservations";

// The output for some observations: item '', type `observations`, its parent `analyze`'s.
export async function observationsOutput(o: StoredObservations, parent: string) {
  return {
    item: "",
    type: "observations",
    contentSha256: await putContent(jsonBytes(o), "application/json"),
    parentOutputId: parent,
    inputIds: [parent],
  };
}

export async function finishFixObservations(project: Project, stage: ApiStage, pipeline: ApiPipeline): Promise<string> {
  const index = pipeline.stages.findIndex((s) => s.id === stage.id);
  const analyze = pipeline.stages.slice(0, index).reverse().find((s) => s.step === "analyze");
  const parent = analyze?.outputs.find((o) => o.item === "" && o.type === "observations" && o.contentSha256);
  if (!parent) throw new Error("There is no analysis before this stage.");
  const original = normalizeObservations(await fetchJsonContent(parent.contentSha256!));
  const saved = stage.outputs.find((o) => o.item === "" && o.type === "observations" && o.contentSha256);
  const current = saved ? normalizeObservations(await fetchJsonContent(saved.contentSha256!)) : original;
  await recordOutputs(project, stage.id, [await observationsOutput(current, parent.id)]);
  return fixNote(changedItems(original, current), confirmedItems(current));
}
