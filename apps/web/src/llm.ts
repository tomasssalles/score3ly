// What LLM steps share in the browser (docs/llm.md): the model config a stage uses, the part of the stage key that
// depends on it, images for requests, and asking the model.

import { CLAUDE_IMAGE_LIMIT, type SizeLimit } from "@score3ly/imaging";
import { type CallPlace, callLlm, fetchModelConfig, type LlmAnswer, type LlmRequest, type ModelConfig } from "./api";
import { keyOf } from "@score3ly/core";
import { noteAnswer } from "./itemTiming";
import { keepFingerprints } from "./pageImages";
import { CannotStart, type StageRun } from "./stageRunner";
import { trackCall } from "./callProgress";

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

// What of a model config goes into stage and request keys (§5.2): provider, model and effort. Not its name,
// parameters or secrets, which don't change the answer.
export function modelKey(config: ModelConfig): { provider: string; model: string; effort: string | null } {
  return { provider: config.provider, model: config.model, effort: config.effort };
}

// The largest image to send, by the model's family (not its model string, which the app doesn't interpret, §7.2):
// Claude on any of its providers sees at most 2576 px and about 3.75 megapixels (Opus 4.7 and later; older
// Claude models shrink further on their own). Gemini's limits aren't checked yet: Claude's are used for it too, and for
// the fake models.
export function imageLimit(_config: ModelConfig): SizeLimit {
  return CLAUDE_IMAGE_LIMIT;
}

// What a provider accepts in one request (docs/stages/analyze.md): images are sent inline, as base64. Claude's API:
// 32 MB per request, 10 MB per image, and with more than 20 images none may be larger than 2000 px either way
// (the vision docs, 2026-10). Bedrock: 5 MB per image, and less per request than the API (assumed 20 MB
// until checked). Gemini, as Gemini said (to check against Google's documentation): 20 MB per request, 7 MB per image
// at the least, on Vertex AI too (to check as well).
export type RequestLimits = {
  maxRequestBytes: number;
  maxImageBytes: number;
  manyImages: { above: number; limit: SizeLimit } | null; // a smaller size for every image when there are many
};

const MB = 1024 * 1024;

export function requestLimits(config: ModelConfig): RequestLimits {
  const many = { above: 20, limit: { maxLongEdge: 2000, maxPixels: CLAUDE_IMAGE_LIMIT.maxPixels } };
  if (config.family === "gemini") return { maxRequestBytes: 20 * MB, maxImageBytes: 7 * MB, manyImages: null };
  if (config.provider === "bedrock") return { maxRequestBytes: 20 * MB, maxImageBytes: 5 * MB, manyImages: many };
  return { maxRequestBytes: 32 * MB, maxImageBytes: 10 * MB, manyImages: many };
}

// The image limit for a request with `count` images: smaller when there are many (above).
export function imageLimitFor(config: ModelConfig, count: number): SizeLimit {
  const many = requestLimits(config).manyImages;
  return many && count > many.above ? many.limit : imageLimit(config);
}

// Why a request is too big for its provider, or null. Counts the base64 of its images and the length of its texts.
export function requestSizeProblem(config: ModelConfig, request: LlmRequest): string | null {
  const limits = requestLimits(config);
  let total = (request.system?.length ?? 0) + JSON.stringify(request.jsonSchema ?? null).length;
  for (const message of request.messages) {
    for (const part of message.content) {
      if (part.type === "image") {
        const bytes = part.image?.base64.length ?? 0;
        if (bytes > limits.maxImageBytes) {
          return `an image is ${(bytes / MB).toFixed(1)} MB, more than the ${limits.maxImageBytes / MB} MB the provider takes`;
        }
        total += bytes;
      } else {
        total += part.text.length;
      }
    }
  }
  // Some room for the request's own JSON.
  return total > limits.maxRequestBytes * 0.95
    ? `the request would be ${(total / MB).toFixed(1)} MB, more than the ${limits.maxRequestBytes / MB} MB the provider takes`
    : null;
}

async function pngContent(png: Blob): Promise<{ mediaType: "image/png"; base64: string }> {
  const bytes = new Uint8Array(await png.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { mediaType: "image/png", base64: btoa(binary) };
}

// A request as a stage builds it: each image by its recipe key, with how to make it (pageImages.ts). It is made only
// if the call isn't cached (§5.2: a re-run on another device doesn't make images only to find the answers stored).
export type RequestImage = { type: "image"; recipe: unknown; recipeKey: string; make: () => Promise<Blob> };
// `cacheUpTo`: where the prompt is worth caching at the provider (docs/llm.md, "Prompt caching").
export type RequestContent = ({ type: "text"; text: string } | RequestImage) & { cacheUpTo?: true };
export type PlannedRequest = Omit<LlmRequest, "messages"> & { messages: { role: "user" | "assistant"; content: RequestContent[] }[] };

// An image for a request, from its recipe and the function that makes (or takes from the cache) the image of that
// recipe: the image's key in the device's cache is the recipe's key too.
export async function requestImage<R>(recipe: R, make: (recipe: R) => Promise<Blob>): Promise<RequestImage> {
  return { type: "image", recipe, recipeKey: await keyOf(recipe), make: () => make(recipe) };
}

// The request to send: with its images made (`made` collects them), or without.
async function withImages(request: PlannedRequest, made: { recipe: unknown; png: Blob }[] | null): Promise<LlmRequest> {
  const messages: LlmRequest["messages"] = [];
  for (const m of request.messages) {
    const content: LlmRequest["messages"][number]["content"] = [];
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

// Asks the model, and returns its answer if it is usable. Anything else ends the stage with an error that says what
// happened (a refused call, e.g. the spending cap, or an answer that was cut off, declined or not parseable): the
// answers so far stay in the records, and a retry asks only what is missing (§6, `extract`).
// The request is first looked up by its images' recipe keys; only if it isn't cached are its images made, the request
// checked for size, and sent with them. `beforeImages` runs then, before anything can be paid for (e.g. a check that
// another request of the stage will fit).
export async function ask(
  run: StageRun,
  request: PlannedRequest,
  what: string,
  options: { config: ModelConfig; place: CallPlace; beforeImages?: () => Promise<void> },
): Promise<LlmAnswer> {
  const tracked = trackCall(run, what);
  let answer = await callLlm(run.project, run.stage.id, await withImages(request, null), options.place, what, run.signal, tracked.onEvent);
  if ("imagesNeeded" in answer) {
    await options.beforeImages?.();
    const images: { recipe: unknown; png: Blob }[] = [];
    const full = await withImages(request, images);
    const tooBig = requestSizeProblem(options.config, full);
    if (tooBig) throw new Error(`${what}: ${tooBig}.`);
    const made = await callLlm(run.project, run.stage.id, full, options.place, what, run.signal, tracked.onEvent);
    if ("imagesNeeded" in made) throw new Error(`${what}: the request was sent without its images.`);
    answer = made;
    // The answer is computed from these images: their fingerprints are kept (§8.3).
    if (answer.status === "ok") await keepFingerprints(images);
  }
  tracked.ended();
  if (answer.status !== "ok") throw new Error(`${what}: ${answer.error ?? answer.status}`);
  noteAnswer(answer.cached);
  return answer;
}

// Whether a request would be too big, with its images made: for checks before a stage pays for anything.
export async function plannedSizeProblem(config: ModelConfig, request: PlannedRequest): Promise<string | null> {
  return requestSizeProblem(config, await withImages(request, []));
}
