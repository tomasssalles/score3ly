// Finishing a `fix_metadata` stage (docs/stages/analyze.md): the metadata and where the pieces start are recorded, from what the
// user saved, else from `analyze`'s. Finishing confirms nothing: only what the user confirmed is.

import { piecesOf } from "./analyze.ts";
import { fetchJsonContent, putJson, recordOutputs, type ApiPipeline, type ApiStage, type Project } from "./api";
import { normalizeMetadata, type StoredMetadata } from "./analyze.ts";
import { analyzeOutputs, changedFields, confirmedFields, fixNote } from "./fixMetadata";
import { latestStage, scoreOutput } from "./stageInputs";

// The ids of `analyze`'s outputs that `fix_metadata` corrects (its pieces are missing from a version-1 `analyze`).
export type MetadataParents = { metadata: string; pieces?: string };

// The two outputs for some metadata.
export async function metadataOutputs(m: StoredMetadata, parents: MetadataParents) {
  const parent = parents.metadata;
  return [
    {
      item: "",
      type: "metadata",
      contentSha256: await putJson(m),
      parentOutputId: parent,
      inputIds: [parent],
    },
    {
      item: "",
      type: "pieces",
      contentSha256: await putJson(piecesOf(m)),
      parentOutputId: parents.pieces,
      inputIds: [parent],
    },
  ];
}

export async function finishFixMetadata(project: Project, stage: ApiStage, pipeline: ApiPipeline): Promise<string> {
  const index = pipeline.stages.findIndex((s) => s.id === stage.id);
  const found = analyzeOutputs(latestStage(pipeline.stages.slice(0, index), ["analyze"]));
  if (!found) throw new Error("There is no analysis before this stage.");
  const parents = { metadata: found.metadata.id, pieces: found.pieces?.id };
  const original = normalizeMetadata(await fetchJsonContent(found.metadata.contentSha256!));
  const saved = scoreOutput(stage, "metadata");
  const current = saved ? normalizeMetadata(await fetchJsonContent(saved.contentSha256!)) : original;
  await recordOutputs(project, stage.id, await metadataOutputs(current, parents));
  return fixNote(changedFields(original, current), confirmedFields(current));
}
