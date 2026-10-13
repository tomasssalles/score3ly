// What LLM steps share in the browser (DESIGN.md §7.2): the model config a stage uses, the part of the stage key that
// depends on it, images for requests, and asking the model.

import { CLAUDE_IMAGE_LIMIT, type SizeLimit } from "@score3ly/imaging";
import { callLlm, fetchModelConfig, fetchSettings, type LlmAnswer, type LlmRequest, type ModelConfig } from "./api";
import { CannotStart, type StageRun } from "./stageRunner";

// The model config for an LLM stage: the one chosen for the stage (`modelConfigId` in its config), else the
// default from the settings (§7.2, "Which config a stage uses"; the per-kind level isn't built).
export async function stageModelConfig(stageConfig: Record<string, unknown> | null): Promise<ModelConfig> {
  const chosen = typeof stageConfig?.modelConfigId === "string" ? stageConfig.modelConfigId : null;
  const id = chosen ?? (await fetchSettings()).defaultModelConfigId;
  if (!id) throw new CannotStart("no model config is chosen: set a default model config in the settings.");
  return fetchModelConfig(id);
}

// What of a model config goes into stage and request keys (§5.2): provider, model and effort. Not its name,
// parameters or secrets, which don't change the answer.
export function modelKey(config: ModelConfig): { provider: string; model: string; effort: string | null } {
  return { provider: config.provider, model: config.model, effort: config.effort };
}

// The largest image to send, by the model config's provider (not its model string, which the app doesn't interpret,
// §7.2): Claude on any of its three providers sees at most 2576 px and about 3.75 megapixels (Opus 4.7 and later;
// older Claude models shrink further on their own). Gemini's limits aren't checked yet: Claude's are used for it
// too, and for the fake provider.
export function imageLimit(config: ModelConfig): SizeLimit {
  switch (config.provider) {
    case "anthropic":
    case "anthropic-vertex":
    case "anthropic-bedrock":
    case "google":
    case "fake":
      return CLAUDE_IMAGE_LIMIT;
  }
}

export async function pngContent(png: Blob): Promise<{ type: "image"; image: { mediaType: "image/png"; base64: string } }> {
  const bytes = new Uint8Array(await png.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { type: "image", image: { mediaType: "image/png", base64: btoa(binary) } };
}

// Asks the model, and returns its answer if it is usable. Anything else ends the stage with an error that says what
// happened (a refused call, e.g. the spending cap, or an answer that was cut off, declined or not parseable): the
// answers so far stay in the records, and a retry asks only what is missing (§6, `extract`).
export async function ask(run: StageRun, request: LlmRequest, what: string): Promise<LlmAnswer> {
  const answer = await callLlm(run.project, run.stage.id, request);
  if (answer.status !== "ok") throw new Error(`${what}: ${answer.error ?? answer.status}`);
  return answer;
}
