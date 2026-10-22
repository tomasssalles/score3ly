// The `final_touches` step (DESIGN.md §6): the user edits the full score's MEI as text, right before `engrave`. Its
// outputs (item '', all overwritten while WIP): `mei_base`, the MEI `engrave` would have built, written when the editor
// first opens (what "lines changed" counts against); `mei_draft`, the text as last saved; `mei`, the text last
// applied (it passed the checks). The editor is FinalTouchesView.tsx; finishing, finishFinalTouches below.

import { fetchJsonContent, fetchTextContent, putContent, recordOutputs, type ApiPipeline, type ApiStage, type Project } from "./api.ts";
import { engraveSources, loadScore, meiText, sourceIds, type EngraveSources } from "./engrave.ts";
import { changesNote, linesChanged, type MeiProblem } from "./meiChecks.ts";

export const FINAL_TOUCHES_VERSION = 1;

export type FinalTouchesType = "mei_base" | "mei_draft" | "mei";

export function ownOutput(stage: ApiStage, type: FinalTouchesType): string | null {
  return stage.outputs.find((o) => o.item === "" && o.type === type)?.contentSha256 ?? null;
}

// What adding the stage after the latest extraction records (`earlier`: the stages up to and including that one).
export function finalTouchesStart(earlier: ApiStage[]): { stepVersion: number; pageCount: number | null; inputIds: string[] } {
  const sources = engraveSources(earlier);
  if ("missing" in sources) throw new Error(`Final touches can't start: ${sources.missing}`);
  const rasterize = [...earlier].reverse().find((s) => s.step === "rasterize");
  return {
    stepVersion: FINAL_TOUCHES_VERSION,
    pageCount: rasterize?.outputs.filter((o) => o.type === "page_image").length ?? null,
    inputIds: sourceIds(sources),
  };
}

// Stores a text as the stage's outputs of the given types.
export async function saveText(project: Project, stageId: string, text: string, types: FinalTouchesType[]): Promise<string> {
  const contentSha256 = await putContent(new TextEncoder().encode(text), "application/xml");
  await recordOutputs(project, stageId, types.map((type) => ({ item: "", type, contentSha256 })));
  return contentSha256;
}

export type FinalTouchesTexts = { base: string; draft: string; applied: string };

// The stage's texts: what it saved, else what it started from. The start is built from the same sources as
// `engrave`'s MEI and, while the stage is WIP, saved the first time.
export async function loadFinalTouches(project: Project, stage: ApiStage, earlier: ApiStage[]): Promise<FinalTouchesTexts> {
  const text = async (type: FinalTouchesType) => {
    const sha256 = ownOutput(stage, type);
    return sha256 ? fetchTextContent(sha256) : null;
  };
  let base = await text("mei_base");
  if (base === null) {
    const sources: EngraveSources | { missing: string } = engraveSources(earlier);
    if ("missing" in sources) throw new Error(`The MEI can't be built: ${sources.missing}`);
    const { score, metadata } = await loadScore(sources, fetchJsonContent);
    base = meiText(score, metadata);
    if (stage.status === "wip") await saveText(project, stage.id, base, ["mei_base"]);
  }
  const applied = (await text("mei")) ?? base;
  const draft = (await text("mei_draft")) ?? applied;
  return { base, draft, applied };
}

// A problem as one line of text.
export const problemText = (p: MeiProblem): string => (p.line === null ? p.message : `Line ${p.line}: ${p.message}`);

// Finishing applies the text last saved: it must pass the checks. Returns the card's result, the lines changed.
export async function finishFinalTouches(project: Project, stage: ApiStage, pipeline: ApiPipeline): Promise<string> {
  const earlier = pipeline.stages.slice(0, pipeline.stages.findIndex((s) => s.id === stage.id));
  const { base, draft } = await loadFinalTouches(project, stage, earlier);
  const { checkMeiText } = await import("./meiValidation");
  const problems = await checkMeiText(draft);
  if (problems.length > 0) {
    const more = problems.length > 1 ? ` (and ${problems.length - 1} more)` : "";
    throw new Error(`the MEI doesn't pass the checks. ${problemText(problems[0])}${more}. Apply it in the editor to see them all.`);
  }
  await saveText(project, stage.id, draft, ["mei_draft", "mei"]);
  return changesNote(linesChanged(base, draft));
}
