import { test } from "node:test";
import assert from "node:assert/strict";
import type { CallRequest, ModelConfig } from "@score3ly/core";
import { imageLimit, imageLimitFor, requestLimits, requestSizeProblem } from "./requestLimits.ts";

const config = (provider: ModelConfig["provider"], family: ModelConfig["family"]) => ({ provider, family }) as ModelConfig;
const MB = 1024 * 1024;
const CLAUDE = { maxLongEdge: 2576, maxPixels: 3_750_000 };
const MANY = { above: 20, limit: { maxLongEdge: 2000, maxPixels: 3_750_000 } };

test("each provider and family has its limits, as they were before they moved here", () => {
  const cases: [ModelConfig["provider"], ModelConfig["family"], number, number, typeof MANY | null][] = [
    ["anthropic", "claude", 32, 10, MANY],
    ["bedrock", "claude", 20, 5, MANY],
    ["openrouter", "claude", 32, 10, MANY],
    ["ai-studio", "gemini", 20, 7, null],
    ["vertex", "gemini", 20, 7, null],
    ["openrouter", "gemini", 20, 7, null],
    ["fake", "fake", 32, 10, MANY],
    ["fake-dev", "fake", 32, 10, MANY],
  ];
  for (const [provider, family, request, image, many] of cases) {
    const c = config(provider, family);
    assert.deepEqual(requestLimits(c), { imageLimit: CLAUDE, maxRequestBytes: request * MB, maxImageBytes: image * MB, manyImages: many }, `${provider} ${family}`);
    assert.deepEqual(imageLimit(c), CLAUDE);
    assert.deepEqual(imageLimitFor(c, 20), CLAUDE);
    assert.deepEqual(imageLimitFor(c, 21), many ? many.limit : CLAUDE);
  }
});

const request = (texts: string[], images: number[]): CallRequest => ({
  system: "s",
  messages: [
    {
      role: "user",
      content: [
        ...texts.map((text) => ({ type: "text" as const, text })),
        ...images.map((bytes) => ({ type: "image" as const, recipeKey: "k", image: { mediaType: "image/png" as const, base64: "x".repeat(bytes) } })),
      ],
    },
  ],
  maxOutputTokens: 10,
});

test("a request too big for its provider is said so: an image, or the whole", () => {
  const claude = config("anthropic", "claude");
  assert.equal(requestSizeProblem(claude, request(["hello"], [MB])), null);
  assert.equal(requestSizeProblem(claude, request([], [11 * MB])), "an image is 11.0 MB, more than the 10 MB the provider takes");
  assert.equal(requestSizeProblem(config("bedrock", "claude"), request([], [6 * MB])), "an image is 6.0 MB, more than the 5 MB the provider takes");
  assert.equal(requestSizeProblem(claude, request([], [9 * MB, 9 * MB, 9 * MB])), null);
  assert.equal(requestSizeProblem(claude, request([], [9 * MB, 9 * MB, 9 * MB, 4 * MB])), "the request would be 31.0 MB, more than the 32 MB the provider takes");
  assert.equal(requestSizeProblem(config("vertex", "gemini"), request(["x".repeat(19 * MB)], [])), "the request would be 19.0 MB, more than the 20 MB the provider takes");
});
