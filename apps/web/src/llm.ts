// What LLM steps share in the browser (docs/llm.md): the model config a stage uses, the part of the stage key that
// depends on it, images for requests, and asking the model.

import { type ApiStage, type CallPlace, callLlm, fetchModelConfig, type CallAnswer, type CallRequest, type ModelConfig } from "./api";
import { keyOf, toBase64 } from "@score3ly/core";
import { noteAnswer } from "./itemTiming";
import { keepFingerprints } from "./pageImages";
import { CannotStart, type StageRun } from "./stageRunner";
import { trackCall } from "./callProgress";
import { requestSizeProblem } from "./requestLimits";
import { checkedAnswer, type AnswerCheck } from "./checkedAnswer";
import { LLM_CONFIG } from "./steps";
import type { LlmStageConfig } from "./llmStageKey";

// The model config of an LLM stage: the one its config names (`modelConfigId`), which it got when it was created, the
// default then unless it was given one (docs/llm.md, "Which config a stage uses"). It is never looked up later.
export async function stageModelConfig(stageConfig: Record<string, unknown> | null): Promise<ModelConfig> {
  const id = typeof stageConfig?.modelConfigId === "string" ? stageConfig.modelConfigId : null;
  if (!id) throw new CannotStart("it has no model config: there was no default model config when it was created.");
  const config = await fetchModelConfig(id);
  // Said as the Worker says it, which refuses to start the stage too (deletedConfigMessage, unsupportedConfigMessage).
  if (config.deletedAt) throw new CannotStart(`its model config, "${config.name}", was deleted.`);
  if (config.unsupported) throw new CannotStart(`its model config, "${config.name}", ${config.unsupported}.`);
  return config;
}

// An LLM stage's start: its model config; its config as its step reads it, for the stage key (llmStageKey.ts); and what
// `runPlan` records with the stage: its config as it is (it names the model config) and the model config's id.
export async function llmStart(
  stage: ApiStage,
): Promise<{ config: ModelConfig; stageConfig: LlmStageConfig; start: { config: ApiStage["config"]; modelConfigId: string } }> {
  const config = await stageModelConfig(stage.config);
  return { config, stageConfig: LLM_CONFIG.read(stage.config), start: { config: stage.config, modelConfigId: config.id } };
}

async function pngContent(png: Blob): Promise<{ mediaType: "image/png"; base64: string }> {
  return { mediaType: "image/png", base64: toBase64(new Uint8Array(await png.arrayBuffer())) };
}

// A request as a stage builds it: each image by its recipe key, with how to make it (pageImages.ts). It is made only
// if the call isn't cached (§5.2: a re-run on another device doesn't make images only to find the answers stored).
export type RequestImage = { type: "image"; recipe: unknown; recipeKey: string; make: () => Promise<Blob> };
// `cacheUpTo`: where the prompt is worth caching at the provider (docs/llm.md, "Prompt caching").
export type RequestContent = ({ type: "text"; text: string } | RequestImage) & { cacheUpTo?: true };
export type PlannedRequest = Omit<CallRequest, "messages"> & { messages: { role: "user" | "assistant"; content: RequestContent[] }[] };

// An image for a request, from its recipe and the function that makes (or takes from the cache) the image of that
// recipe: the image's key in the device's cache is the recipe's key too.
export async function requestImage<R>(recipe: R, make: (recipe: R) => Promise<Blob>): Promise<RequestImage> {
  return { type: "image", recipe, recipeKey: await keyOf(recipe), make: () => make(recipe) };
}

// The request to send: with its images made (`made` collects them), or without.
async function withImages(request: PlannedRequest, made: { recipe: unknown; png: Blob }[] | null): Promise<CallRequest> {
  const messages: CallRequest["messages"] = [];
  for (const m of request.messages) {
    const content: CallRequest["messages"][number]["content"] = [];
    // One image at a time: a request can have many, and each is large.
    for (const c of m.content) {
      const cache = c.cacheUpTo ? { cacheUpTo: true as const } : {};
      if (c.type !== "image") content.push(c);
      else if (!made) content.push({ type: "image", recipeKey: c.recipeKey, ...cache });
      else {
        const png = await c.make();
        made.push({ recipe: c.recipe, png });
        content.push({ type: "image", recipeKey: c.recipeKey, image: await pngContent(png), ...cache });
      }
    }
    messages.push({ role: m.role, content });
  }
  return { ...request, messages };
}

// Asks the model, and returns its answer with what the stage's check made of it, if it is usable. Anything else ends
// the stage with an error that says what happened (a refused call, e.g. the spending cap, or an answer that was cut
// off, declined, not parseable, or that the check refused: checkedAnswer.ts): the answers so far stay in the records,
// and a retry asks only what is missing (§6, `extract`).
// The request is first looked up by its images' recipe keys; only if it isn't cached are its images made, the request
// checked for size, and sent with them. `beforeImages` runs then, before anything can be paid for (e.g. a check that
// another request of the stage will fit). `unusable`: the stage's error for an answer it can't use, by default
// "<what>: the answer can't be used: <why>."
export async function ask<T>(
  run: StageRun,
  request: PlannedRequest,
  what: string,
  options: {
    config: ModelConfig;
    place: CallPlace;
    beforeImages?: () => Promise<void>;
    check: AnswerCheck<T>;
    unusable?: (problem: string) => string;
  },
): Promise<{ answer: CallAnswer; checked: T }> {
  const onEvent = trackCall(run, options.place.item);
  let answer = await callLlm(run.project, run.stage.id, await withImages(request, null), options.place, what, run.signal, onEvent);
  if ("imagesNeeded" in answer) {
    await options.beforeImages?.();
    const images: { recipe: unknown; png: Blob }[] = [];
    const full = await withImages(request, images);
    const tooBig = requestSizeProblem(options.config, full);
    if (tooBig) throw new Error(`${what}: ${tooBig}.`);
    const made = await callLlm(run.project, run.stage.id, full, options.place, what, run.signal, onEvent);
    if ("imagesNeeded" in made) throw new Error(`${what}: the request was sent without its images.`);
    answer = made;
    // The answer is computed from these images: their fingerprints are kept (§8.3).
    if (answer.status === "ok") await keepFingerprints(images);
  }
  if (answer.status !== "ok") throw new Error(`${what}: ${answer.error ?? answer.status}`);
  noteAnswer(answer.cached);
  const unusable = options.unusable ?? ((problem: string) => `${what}: the answer can't be used: ${problem}.`);
  const checked = await checkedAnswer({ project: run.project, stageId: run.stage.id }, answer, request.jsonSchema, options.check, unusable);
  return { answer, checked };
}

// Whether a request would be too big, with its images made: for checks before a stage pays for anything.
export async function plannedSizeProblem(config: ModelConfig, request: PlannedRequest): Promise<string | null> {
  return requestSizeProblem(config, await withImages(request, []));
}
