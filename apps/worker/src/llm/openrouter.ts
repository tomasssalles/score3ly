// OpenRouter (docs/llm.md, "Calling the providers"): one API key for Claude, Gemini and others, through its
// OpenAI-compatible Chat Completions API, with a plain `fetch` (no SDK), streamed (server-sent events) so that a long
// answer keeps the connection busy, as the other adapters do; the whole answer is put together at the end. The model matters, not who serves it
// (decided 2026-11-08): OpenRouter may send a call to any provider that runs the model, but never to another model
// (we never send its model fallbacks, `models`), which the model check confirms. Each answer reports what it cost
// (`usage.cost`, in US dollars of credits): the app's cost for the call is that plus OpenRouter's fee on credits
// (`providerCost`, spending.ts). `region` "eu" sends to `eu.openrouter.ai`, which is served in Europe only (a Business account).

import {
  type Effort,
  type Fetch,
  LlmError,
  type LlmContent,
  type LlmProgress,
  type LlmProvider,
  type LlmRequest,
  type LlmResponse,
} from "./types.ts";
import { endedEarly, errorFromBody, plainFetch, postJson, progressReporter, sseJson, streamError } from "./http.ts";

export function openRouterBase(region: string): string {
  return region === "eu" ? "https://eu.openrouter.ai/api/v1" : "https://openrouter.ai/api/v1";
}

type Part =
  | { type: "text"; text: string; cache_control?: { type: "ephemeral" } }
  | { type: "image_url"; image_url: { url: string }; cache_control?: { type: "ephemeral" } };

function toPart(content: LlmContent): Part {
  const mark = content.cacheUpTo ? { cache_control: { type: "ephemeral" as const } } : {};
  return content.type === "text"
    ? { type: "text", text: content.text, ...mark }
    : { type: "image_url", image_url: { url: `data:${content.image.mediaType};base64,${content.image.base64}` }, ...mark };
}

// OpenRouter's `reasoning.effort` is sent as our effort. Whether it takes Claude's "xhigh" and "max" (its models API
// lists each model's `reasoning.supported_efforts`), and whether a Claude model there should be asked for adaptive
// thinking as on Anthropic's API, is still to be tried with a Test (docs/llm.md, "OpenRouter").
const EFFORTS: Record<Effort, string> = { low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" };

export function toBody(request: LlmRequest): Record<string, unknown> {
  return {
    model: request.model,
    stream: true,
    messages: [
      ...(request.system ? [{ role: "system", content: request.system }] : []),
      ...request.messages.map((m) => ({ role: m.role, content: m.content.map(toPart) })),
    ],
    max_tokens: request.maxOutputTokens,
    ...(request.effort ? { reasoning: { effort: EFFORTS[request.effort] } } : {}),
    ...(request.jsonSchema
      ? { response_format: { type: "json_schema", json_schema: { name: "answer", strict: true, schema: request.jsonSchema } } }
      : {}),
    // Only providers that support every parameter sent (structured output is decided per provider): not a pin to one.
    provider: { require_parameters: true },
  };
}

type Completion = {
  model?: string;
  provider?: string;
  choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string | null; native_finish_reason?: string | null }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
    cost?: number;
  };
  error?: OpenRouterError;
};

// An error as OpenRouter reports it. When the provider that ran the call refused it, the message is only "Provider
// returned error", and the provider's own error is in the metadata: its name, and its raw body.
type OpenRouterError = { code?: number | string; message?: string; metadata?: { provider_name?: string; raw?: unknown } };

// The error's message, with the provider's own where there is one: "Provider returned error (Google): The compiled
// grammar is too large, …". The raw body is the provider's JSON (its `error.message` is taken) or plain text.
export function errorMessage(error: OpenRouterError | undefined): string {
  const message = error?.message ?? "an error";
  const raw = error?.metadata?.raw;
  if (raw === undefined || raw === null || raw === "") return message;
  let detail = typeof raw === "string" ? raw : JSON.stringify(raw);
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const inner = parsed?.error?.message ?? parsed?.message;
    if (typeof inner === "string") detail = inner;
  } catch {
    // not JSON: the text as it is
  }
  const by = error?.metadata?.provider_name ? ` (${error.metadata.provider_name})` : "";
  return `${message}${by}: ${detail.slice(0, 500)}`;
}

// The model asked, or its dated canonical slug ("anthropic/claude-opus-5.5" answered as
// "anthropic/claude-opus-5.5-20260921"): the same model.
export function sameModel(asked: string, answered: string): boolean {
  return answered === asked || new RegExp(`^${asked.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-\\d{8}$`).test(answered);
}

export function fromCompletion(completion: Completion, request: LlmRequest): LlmResponse {
  const choice = completion.choices?.[0];
  const finish = choice?.finish_reason ?? null;
  // A refusal first: Claude's comes through as `native_finish_reason` "refusal", perhaps with `finish_reason` "stop".
  const stop: LlmResponse["stop"] =
    finish === "content_filter" || choice?.native_finish_reason === "refusal" || choice?.message?.refusal ? "refusal"
    : finish === "stop" ? "end"
    : finish === "length" ? "max_tokens"
    : "other";
  const usage = completion.usage ?? {};
  const cacheRead = usage.prompt_tokens_details?.cached_tokens ?? 0;
  const cacheWrite = usage.prompt_tokens_details?.cache_write_tokens ?? 0;
  const model = completion.model ?? request.model;
  return {
    model,
    text: choice?.message?.content ?? "",
    stop,
    stopDetail: choice?.native_finish_reason ?? finish ?? undefined,
    usage: {
      // `prompt_tokens` counts the cached tokens too, read and written (OpenAI's convention): ours doesn't.
      inputTokens: Math.max(0, (usage.prompt_tokens ?? 0) - cacheRead - cacheWrite),
      outputTokens: usage.completion_tokens ?? 0,
      cacheReadTokens: cacheRead,
      cacheWriteTokens: cacheWrite,
    },
    ...(typeof usage.cost === "number" ? { reportedCostUsd: usage.cost } : {}),
    ...(completion.provider ? { servedBy: completion.provider } : {}),
    raw: completion,
  };
}

type Chunk = {
  model?: string;
  provider?: string;
  choices?: ({
    delta?: { content?: string | null; refusal?: string | null; reasoning?: string | null; reasoning_details?: unknown[] } & Record<string, unknown>;
    finish_reason?: string | null;
    native_finish_reason?: string | null;
  } & Record<string, unknown>)[];
  usage?: Completion["usage"];
  error?: Completion["error"];
} & Record<string, unknown>;

// The streamed answer (server-sent events: "data: {chunk}" lines, ": …" comments while OpenRouter waits, "data: [DONE]"
// at the end) put together as one completion: the text of the deltas, the last finish reason, and the usage, which
// comes in the last chunk. Everything else received is kept too, for the call's record (decided in the code review,
// dec. 13: a true record, as Gemini's merged chunks): the reasoning's text and details, joined as the content is, and
// the chunks' and the deltas' other fields, the last value of each. An error after the stream began comes as a chunk of its own. Chunks are added as they
// arrive (`add`), with how much has arrived so far (`progress`: the answer's and the reasoning's characters, and the
// output tokens if this chunk carried the usage, else null).
export class CompletionStream {
  #model: string | undefined;
  #provider: string | undefined;
  #content = "";
  #refusal: string | null = null;
  #finish: string | null = null;
  #nativeFinish: string | null = null;
  #usage: Completion["usage"];
  #reasoning: string | null = null;
  #reasoningDetails: unknown[] | null = null;
  #rest: Record<string, unknown> = {}; // the chunks' other fields
  #choiceRest: Record<string, unknown> = {}; // the choice's
  #deltaRest: Record<string, unknown> = {}; // the deltas'
  #chunks = 0;
  readonly progress: LlmProgress = { textChars: 0, thinkingChars: 0, outputTokens: null };

  // One event.
  add(chunk: Chunk): void {
    this.#chunks++;
    if (chunk.error) throw streamError(chunk.error.code, `OpenRouter: ${errorMessage(chunk.error)}`);
    const { model, provider, choices, usage, error: _, ...rest } = chunk;
    Object.assign(this.#rest, rest);
    this.#model = model ?? this.#model;
    this.#provider = provider ?? this.#provider;
    const choice = choices?.[0];
    if (choice) {
      const { delta, finish_reason: _f, native_finish_reason: _n, ...choiceRest } = choice;
      Object.assign(this.#choiceRest, choiceRest);
      const { content: _c, refusal: _r, reasoning, reasoning_details, ...deltaRest } = delta ?? {};
      Object.assign(this.#deltaRest, deltaRest);
      if (typeof reasoning === "string") this.#reasoning = (this.#reasoning ?? "") + reasoning;
      if (Array.isArray(reasoning_details)) this.#reasoningDetails = [...(this.#reasoningDetails ?? []), ...reasoning_details];
    }
    const content = choice?.delta?.content ?? "";
    this.#content += content;
    this.progress.textChars += content.length;
    this.progress.thinkingChars += choice?.delta?.reasoning?.length ?? 0;
    this.#refusal = choice?.delta?.refusal ?? this.#refusal;
    this.#finish = choice?.finish_reason ?? this.#finish;
    this.#nativeFinish = choice?.native_finish_reason ?? this.#nativeFinish;
    if (usage) this.#usage = usage;
    this.progress.outputTokens = typeof usage?.completion_tokens === "number" ? usage.completion_tokens : null;
  }

  completion(): Completion {
    if (this.#chunks === 0) throw new LlmError("unreadable_response", "OpenRouter's answer has no chunks.");
    // A stream that ended before the answer did.
    if (this.#finish === null && this.#nativeFinish === null) throw endedEarly("OpenRouter");
    const message = {
      ...this.#deltaRest,
      content: this.#content,
      refusal: this.#refusal,
      ...(this.#reasoning !== null ? { reasoning: this.#reasoning } : {}),
      ...(this.#reasoningDetails !== null ? { reasoning_details: this.#reasoningDetails } : {}),
    };
    return {
      ...this.#rest,
      model: this.#model,
      provider: this.#provider,
      choices: [{ ...this.#choiceRest, message, finish_reason: this.#finish, native_finish_reason: this.#nativeFinish }],
      usage: this.#usage,
    };
  }
}

export class OpenRouterProvider implements LlmProvider {
  readonly #apiKey: string;
  readonly #base: string;
  readonly #fetch: Fetch;

  constructor(options: { apiKey: string; region: string; fetch?: Fetch }) {
    if (!options.apiKey) throw new LlmError("auth", "OpenRouter needs an API key.");
    this.#apiKey = options.apiKey;
    this.#base = openRouterBase(options.region);
    this.#fetch = plainFetch(options.fetch);
  }

  async send(request: LlmRequest, signal?: AbortSignal, onProgress?: (progress: LlmProgress) => void): Promise<LlmResponse> {
    const headers = { authorization: `Bearer ${this.#apiKey}`, "x-title": "score3ly" };
    const res = await postJson(this.#fetch, `${this.#base}/chat/completions`, headers, toBody(request), signal);
    // A refusal before anything was streamed: a plain JSON error with its HTTP status.
    if (!res.ok) throw await errorFromBody(res, "OpenRouter", (text) => `OpenRouter answered ${res.status}: ${httpErrorText(text)}`);
    const stream = new CompletionStream();
    const report = progressReporter(onProgress);
    await sseJson<Chunk>(res, { name: "OpenRouter", skip: "[DONE]", notJson: (data) => `A chunk of OpenRouter's answer isn't JSON: ${data.slice(0, 200)}` }, (chunk) => {
      stream.add(chunk);
      report(stream.progress);
    });
    return fromCompletion(stream.completion(), request);
  }
}

// An HTTP error's message: OpenRouter's (with the provider's own, `errorMessage`), or else the body's start.
function httpErrorText(text: string): string {
  try {
    const error = (JSON.parse(text) as Completion).error;
    if (error) return errorMessage(error);
  } catch {
    // not JSON: the text as it is
  }
  return text.slice(0, 300);
}
