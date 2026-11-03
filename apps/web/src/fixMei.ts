// The `fix_mei` step (docs/stages/engrave.md): the user edits the full score's MEI as text, after `build_mei` and right
// before `engrave`. It reads `build_mei`'s MEI, its parent, like every fix reads the output it corrects. Its outputs
// (item '', all overwritten while WIP): `mei_base`, the MEI it started from, written when the editor first opens (what
// "lines changed" counts against); `mei_draft`, the text as last saved; `mei`, the text last applied (it passed the
// checks). The editor is FixMeiView.tsx; finishing, finishFixMei below.

import { fetchTextContent, putContent, recordOutputs, type ApiPipeline, type ApiStage, type Project } from "./api.ts";
import { changesNote, linesChanged, type MeiProblem } from "./meiChecks.ts";

export const FIX_MEI_VERSION = 1;

export type FixMeiType = "mei_base" | "mei_draft" | "mei";

export function ownOutput(stage: ApiStage, type: FixMeiType): string | null {
  return stage.outputs.find((o) => o.item === "" && o.type === type)?.contentSha256 ?? null;
}

// `build_mei`'s MEI, the output a `fix_mei` after it corrects.
function parentMei(buildMei: ApiStage) {
  return buildMei.outputs.find((o) => o.item === "" && o.type === "mei" && o.contentSha256) ?? null;
}

// What adding the stage after `build_mei` records: its MEI as the input, and its page count.
export function fixMeiStart(buildMei: ApiStage): { stepVersion: number; pageCount: number | null; inputIds: string[] } {
  const mei = parentMei(buildMei);
  if (buildMei.step !== "build_mei" || !mei) throw new Error(`"Fix MEI" can't start: the MEI hasn't been built yet.`);
  return { stepVersion: FIX_MEI_VERSION, pageCount: buildMei.pageCount, inputIds: [mei.id] };
}

// Stores a text as the stage's outputs of the given types.
export async function saveText(project: Project, stageId: string, text: string, types: FixMeiType[]): Promise<string> {
  const contentSha256 = await putContent(new TextEncoder().encode(text), "application/xml");
  await recordOutputs(project, stageId, types.map((type) => ({ item: "", type, contentSha256 })));
  return contentSha256;
}

export type FixMeiTexts = { base: string; draft: string; applied: string };

// The stage's texts: what it saved, else what it started from: the latest `build_mei`'s MEI, saved the first time while
// the stage is WIP.
export async function loadFixMei(project: Project, stage: ApiStage, earlier: ApiStage[]): Promise<FixMeiTexts> {
  const text = async (type: FixMeiType) => {
    const sha256 = ownOutput(stage, type);
    return sha256 ? fetchTextContent(sha256) : null;
  };
  let base = await text("mei_base");
  if (base === null) {
    const buildMei = [...earlier].reverse().find((s) => s.step === "build_mei");
    const mei = buildMei && parentMei(buildMei);
    if (!mei) throw new Error("The MEI hasn't been built yet.");
    base = await fetchTextContent(mei.contentSha256!);
    if (stage.status === "wip") await saveText(project, stage.id, base, ["mei_base"]);
  }
  const applied = (await text("mei")) ?? base;
  const draft = (await text("mei_draft")) ?? applied;
  return { base, draft, applied };
}

// A problem as one line of text.
export const problemText = (p: MeiProblem): string => (p.line === null ? p.message : `Line ${p.line}: ${p.message}`);

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
