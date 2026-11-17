// An LLM call of a running stage, as the browser and the Worker exchange it (`POST /api/projects/<id>/stages/<stage
// id>/llm`; docs/llm.md): the request, the call's place, its progress and its answer. The provider port's own shapes (the
// Worker's `LlmRequest`, `LlmContent`) are apart: these are the wire's.

// The image types a request may carry.
export const IMAGE_MEDIA_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type ImageMediaType = (typeof IMAGE_MEDIA_TYPES)[number];

// Anthropic's limit of cache breakpoints in a request: at most this many parts marked `cacheUpTo`.
export const MAX_CACHE_MARKS = 4;

// A part of a request. An image is named by its recipe key (docs/overview.md §5.2, "Only recipes, never pixels, in any
// key"), and comes inline, as base64, only once the Worker has said the call isn't cached: the browser asks first with
// the recipe keys alone, so that a cached call is found before its images are made. `cacheUpTo`: the prompt up to and
// including this part is worth caching at the provider (docs/llm.md, "Prompt caching").
export type CallContent = (
  | { type: "text"; text: string }
  | { type: "image"; recipeKey: string; image?: { mediaType: ImageMediaType; base64: string } }
) & { cacheUpTo?: true };

export type CallRequest = {
  system?: string;
  messages: { role: "user" | "assistant"; content: CallContent[] }[];
  maxOutputTokens?: number;
  jsonSchema?: Record<string, unknown>;
};

// Where a call belongs in its stage (docs/overview.md §12, "Each call records its place"): the item, in the outputs'
// form ("p3" for a page, "p3/s2" for a system, "" for the whole score), and the round, from 1. Recorded with the call,
// not part of its key.
export type CallPlace = { item: string; round: number };

// What the browser sends: the request and its place, and `label`, which names the call in the Worker's log ("System
// 12"; not part of the request or its key).
export type CallBody = { request: CallRequest; label?: string } & CallPlace;

// How a call ended.
export type CallStatus = "ok" | "cut_off" | "refused" | "unparseable" | "error";

export type CallUsage = { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number };

// What the stage gets back from a call.
export type CallAnswer = {
  callId: string;
  cached: boolean; // served from an earlier call with the same request: nothing was paid
  status: CallStatus;
  text: string | null;
  json: unknown;
  error: string | null;
  usage: CallUsage | null;
  costUsd: number | null; // with VAT (docs/llm.md, "VAT")
  vatPercent: number; // the rate in it
};

// The answer to a request sent without its images' bytes that isn't cached: send it again with them.
export type ImagesNeeded = { imagesNeeded: true };

// What the Worker streams to the browser while a stage's LLM call runs, before its answer (docs/llm.md, "A call's
// progress"): the call's start (its id, when, and its timeout), and its progress at most every second: the characters
// received so far (the answer's, and the thinking's the provider shows), and the output tokens so far, thinking
// included, as the provider counted them in the latest chunk since the previous event that had a count, or null where
// none had (never an estimate). Both are totals, never what came since the previous event.
export type CallEvent =
  | { event: "started"; callId: string; startedAt: string; timeoutMs: number }
  | { event: "progress"; elapsedMs: number; outputTokens: number | null; textChars: number; thinkingChars: number };

// What the browser is sent while a stage's call runs (docs/llm.md, "A call's progress"), as server-sent events: the
// call's start and progress (`CallEvent`), then the answer, or an error that kept the call from being recorded.
export type StreamEvent = CallEvent | { event: "answer"; answer: CallAnswer } | { event: "error"; error: string };
