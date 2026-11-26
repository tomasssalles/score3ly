// Finishing a `fix_observations` stage (docs/stages/analyze.md): the observations are recorded, from what the user saved, else
// from `analyze`'s. Finishing confirms nothing: only what the user confirmed is.

import { fetchJsonContent, putJson, recordOutputs, type ApiPipeline, type ApiStage, type Project } from "./api";
import type { StoredObservations } from "./analyze";
import { fixNote } from "./fixMetadata";
import { changedItems, confirmedItems, normalizeObservations } from "./fixObservations";
import { latestStage, scoreOutput } from "./stageInputs";

// The output for some observations: item '', type `observations`, its parent `analyze`'s.
export async function observationsOutput(o: StoredObservations, parent: string) {
  return {
    item: "",
    type: "observations",
    contentSha256: await putJson(o),
    parentOutputId: parent,
    inputIds: [parent],
  };
}

export async function finishFixObservations(project: Project, stage: ApiStage, pipeline: ApiPipeline): Promise<string> {
  const index = pipeline.stages.findIndex((s) => s.id === stage.id);
  const analyze = latestStage(pipeline.stages.slice(0, index), ["analyze"]);
  const parent = analyze ? scoreOutput(analyze, "observations") : undefined;
  if (!parent) throw new Error("There is no analysis before this stage.");
  const original = normalizeObservations(await fetchJsonContent(parent.contentSha256!));
  const saved = scoreOutput(stage, "observations");
  const current = saved ? normalizeObservations(await fetchJsonContent(saved.contentSha256!)) : original;
  await recordOutputs(project, stage.id, [await observationsOutput(current, parent.id)]);
  return fixNote(changedItems(original, current), confirmedItems(current));
}
