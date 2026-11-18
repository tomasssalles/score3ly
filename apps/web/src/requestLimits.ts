// What a provider accepts in one LLM request (docs/stages/analyze.md), and the largest image to send: the limits the
// LLM stages build their requests within (llm.ts).

import { CLAUDE_IMAGE_LIMIT, type SizeLimit } from "@score3ly/imaging";
import type { CallRequest, ModelConfig } from "@score3ly/core";

// The largest image to send (`imageLimit`), by the model's family (not its model string, which the app doesn't
// interpret, §7.2): Claude on any of its providers sees at most 2576 px and about 3.75 megapixels (Opus 4.7 and later;
// older Claude models shrink further on their own). Gemini's limits aren't checked yet: Claude's are used for it too,
// and for the fake models.
// Images are sent inline, as base64. Claude's API: 32 MB per request, 10 MB per image, and with more than 20 images
// none may be larger than 2000 px either way (the vision docs, 2026-10). Bedrock: 5 MB per image, and less per request
// than the API (assumed 20 MB until checked). Gemini, as Gemini said (to check against Google's documentation): 20 MB
// per request, 7 MB per image at the least, on Vertex AI too (to check as well).
export type RequestLimits = {
  imageLimit: SizeLimit;
  maxRequestBytes: number;
  maxImageBytes: number;
  manyImages: { above: number; limit: SizeLimit } | null; // a smaller size for every image when there are many
};

const MB = 1024 * 1024;

export function requestLimits(config: ModelConfig): RequestLimits {
  const imageLimit = CLAUDE_IMAGE_LIMIT;
  const many = { above: 20, limit: { maxLongEdge: 2000, maxPixels: CLAUDE_IMAGE_LIMIT.maxPixels } };
  if (config.family === "gemini") return { imageLimit, maxRequestBytes: 20 * MB, maxImageBytes: 7 * MB, manyImages: null };
  if (config.provider === "bedrock") return { imageLimit, maxRequestBytes: 20 * MB, maxImageBytes: 5 * MB, manyImages: many };
  return { imageLimit, maxRequestBytes: 32 * MB, maxImageBytes: 10 * MB, manyImages: many };
}

// The largest image to send to the model, with few images in the request.
export const imageLimit = (config: ModelConfig): SizeLimit => requestLimits(config).imageLimit;

// The image limit for a request with `count` images: smaller when there are many (above).
export function imageLimitFor(config: ModelConfig, count: number): SizeLimit {
  const limits = requestLimits(config);
  return limits.manyImages && count > limits.manyImages.above ? limits.manyImages.limit : limits.imageLimit;
}

// Why a request is too big for its provider, or null. Counts the base64 of its images and the length of its texts.
export function requestSizeProblem(config: ModelConfig, request: CallRequest): string | null {
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
