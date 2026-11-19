// Finishing a `fix_mei` stage (docs/stages/engrave.md): the text last saved is applied, if it passes the checks.

import type { ApiPipeline, ApiStage, Project } from "./api.ts";
import { loadFixMei, problemText, saveText } from "./fixMei.ts";
import { changesNote, linesChanged } from "./meiChecks.ts";

// Finishing applies the text last saved: it must pass the checks. Returns the card's result, the lines changed.
export async function finishFixMei(project: Project, stage: ApiStage, pipeline: ApiPipeline): Promise<string> {
  const earlier = pipeline.stages.slice(0, pipeline.stages.findIndex((s) => s.id === stage.id));
  const { base, draft } = await loadFixMei(project, stage, earlier);
  const { checkMeiText } = await import("./meiValidation");
  const problems = await checkMeiText(draft);
  if (problems.length > 0) {
    const more = problems.length > 1 ? ` (and ${problems.length - 1} more)` : "";
    throw new Error(`the MEI doesn't pass the checks. ${problemText(problems[0])}${more}. Apply it in the editor to see them all.`);
  }
  await saveText(project, stage.id, draft, ["mei_draft", "mei"]);
  return changesNote(linesChanged(base, draft));
}
