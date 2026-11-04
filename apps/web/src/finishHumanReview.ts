// Finishing a `human_review` stage (docs/stages/music.md, `human_review`): its entries are recorded, what the user saved,
// else none, so the `apply_review` after it has them to read.

import { fetchJsonContent, putContent, recordOutputs, type ApiPipeline, type ApiStage, type Project } from "./api";
import { jsonBytes } from "./finishFixMetadata";
import { humanReviewNote, ownIssueProblems, placedSystems, type StoredHumanReview } from "./humanReview";
import type { PageLayout } from "./layout";
import { pageOfItem } from "./rasterize";

export async function finishHumanReview(project: Project, stage: ApiStage, pipeline: ApiPipeline): Promise<string> {
  const saved = stage.outputs.find((o) => o.item === "" && o.type === "human_review" && o.contentSha256);
  const stored: StoredHumanReview = saved ? ((await fetchJsonContent(saved.contentSha256!)) as StoredHumanReview) : { entries: [] };
  // Every clarification needs its text, and boxes that keep the rules (docs/stages/music.md, `human_review`): checked
  // here, not while the user draws.
  if (stored.entries.some((e) => "newIssue" in e)) {
    const index = pipeline.stages.findIndex((s) => s.id === stage.id);
    const layout = pipeline.stages.slice(0, index).reverse().find((s) => s.step === "layout" || s.step === "fix_layout");
    const pages = await Promise.all(
      (layout?.outputs ?? [])
        .filter((o) => o.type === "layout" && o.contentSha256)
        .map(async (o) => ({ page: pageOfItem(o.item) ?? 0, systems: ((await fetchJsonContent(o.contentSha256!)) as PageLayout).systems })),
    );
    const problems = ownIssueProblems(stored, placedSystems(pages));
    if (problems.length > 0) {
      throw new Error(`${problems.map((p) => `Clarification ${p.id}: ${p.problem}`).join(" ")} Everything else is kept.`);
    }
  }
  if (!saved) {
    await recordOutputs(project, stage.id, [{ item: "", type: "human_review", contentSha256: await putContent(jsonBytes(stored), "application/json") }]);
  }
  return humanReviewNote(stored);
}
