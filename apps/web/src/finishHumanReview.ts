// Finishing a `human_review` stage (docs/stages/music.md, `human_review`): its entries are recorded, what the user saved,
// else none, so the `apply_review` after it has them to read.

import { fetchJsonContent, putContent, recordOutputs, type ApiPipeline, type ApiStage, type Project } from "./api";
import { jsonBytes } from "./finishFixMetadata";
import { humanReviewNote, unwritten, type StoredHumanReview } from "./humanReview";

export async function finishHumanReview(project: Project, stage: ApiStage, _pipeline: ApiPipeline): Promise<string> {
  const saved = stage.outputs.find((o) => o.item === "" && o.type === "human_review" && o.contentSha256);
  const stored: StoredHumanReview = saved ? ((await fetchJsonContent(saved.contentSha256!)) as StoredHumanReview) : { entries: [] };
  // An issue of the user's own needs its correction (docs/stages/music.md, `human_review`).
  const open = unwritten(stored);
  if (open.length > 0) {
    throw new Error(
      `${open.length === 1 ? `Issue ${open[0]} has` : `Issues ${open.join(", ")} have`} no correction yet: write it, or delete the issue. Everything else is kept.`,
    );
  }
  if (!saved) {
    await recordOutputs(project, stage.id, [{ item: "", type: "human_review", contentSha256: await putContent(jsonBytes(stored), "application/json") }]);
  }
  return humanReviewNote(stored);
}
