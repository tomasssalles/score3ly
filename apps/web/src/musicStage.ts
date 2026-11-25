// What `review` and `apply_review` share (docs/stages/music.md): the transcription they read, loaded and matched with
// the layout; their images, crops with the issues' boxes drawn on them; and the log of what the stage's earlier calls
// changed, which each call's prompt carries after the parts every call shares (docs/llm.md, "Prompt caching"). Each
// runner keeps its calls.

import type { SizeLimit } from "@score3ly/imaging";
import { fetchJsonContent, type ApiOutput, type ModelConfig } from "./api";
import { MARGINS } from "./crops";
import type { ImageSource, StoredExtraction, StoredScoreChecks } from "./extract";
import { requestImage, type RequestContent } from "./llm";
import type { MusicInputs, MusicSystem } from "./musicInputs";
import { markedCrop } from "./pageImages";
import { cropRecipe, imageVersions, markedCropRecipe } from "./recipes";
import { imageLimit, requestLimits } from "./requestLimits";
import type { MusicSources } from "./stageInputs";
import { CannotStart } from "./stageRunner";
import type { StoredIssue, StoredWarning } from "./issues";

type Transcribed = NonNullable<MusicSources["transcription"]>;

// The transcription the stage reads: the latest stage before it that produces the extraction, done. `missing`: what
// the stage can't start without, said when there is none.
export function transcribedFor(inputs: MusicInputs, missing: string): Transcribed {
  const transcribed = inputs.sources.transcription;
  if (!transcribed || transcribed.stage.status !== "done") throw new CannotStart(missing);
  return transcribed;
}

export type Transcription = {
  outputs: ApiOutput[]; // the extractions' outputs and the checks', whose content the stage key holds
  extractions: Map<number, StoredExtraction>; // by system
  checks: StoredScoreChecks;
  issues: StoredIssue[]; // the systems' in the score's order, then the checks of the whole score's
  warnings: StoredWarning[]; // the same
};

// The transcription's content: an extraction for every system of the layout, and the checks of the whole score.
export async function loadTranscription(inputs: MusicInputs, transcribed: Transcribed): Promise<Transcription> {
  const { systems } = inputs;
  const { extractions: outputs, checks: checksOutput } = transcribed;
  if (systems.some((s) => !outputs.has(s.item)) || !checksOutput) throw new CannotStart("the transcription doesn't match the layout: run Extract again.");
  const extractions = new Map<number, StoredExtraction>();
  await Promise.all(systems.map(async (s) => extractions.set(s.number, (await fetchJsonContent(outputs.get(s.item)!.contentSha256!)) as StoredExtraction)));
  const checks = (await fetchJsonContent(checksOutput.contentSha256!)) as StoredScoreChecks;
  return {
    outputs: [...outputs.values(), checksOutput],
    extractions,
    checks,
    issues: [...systems.flatMap((s) => extractions.get(s.number)!.issues), ...checks.issues],
    warnings: [...systems.flatMap((s) => extractions.get(s.number)!.warnings), ...checks.warnings],
  };
}

// How the stage's images are made, for its stage key: crops with margins, the issues' boxes drawn on them.
export function markedImageRecipe(config: ModelConfig) {
  return {
    limit: imageLimit(config),
    manyImages: requestLimits(config).manyImages,
    ...imageVersions("scale", "crop", "rotate", "draw"),
    margins: MARGINS,
  };
}

// An image of a request after its caption: the crop `box` of a system's straightened page, at most `limit`, with the
// boxes of `issues` drawn on it, labelled with their ids.
export async function markedImage(
  inputs: MusicInputs,
  caption: string,
  system: MusicSystem,
  box: ImageSource["box"],
  limit: SizeLimit,
  issues: Iterable<StoredIssue>,
): Promise<RequestContent[]> {
  const recipe = markedCropRecipe(cropRecipe(inputs.straight(system.pageIndex), box, limit), system.page, issues);
  return [{ type: "text", text: caption }, await requestImage(recipe, markedCrop)];
}

// The log a call's prompt carries: one block per earlier call (by system, before `system`), in the score's order, the
// last marked for the cache.
export function logContent<C extends { system: number }>(calls: Iterable<C>, system: number, text: (call: C) => string): RequestContent[] {
  const log: RequestContent[] = [...calls]
    .filter((c) => c.system < system)
    .sort((a, b) => a.system - b.system)
    .map((c) => ({ type: "text", text: text(c) }));
  if (log.length > 0) log[log.length - 1] = { ...log[log.length - 1], cacheUpTo: true };
  return log;
}
