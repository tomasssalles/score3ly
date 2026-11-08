// OpenRouter (docs/llm.md, "Calling the providers"): one API key for Claude, Gemini and others, through its
// OpenAI-compatible Chat Completions API, with a plain `fetch` (no SDK), streamed (server-sent events) so that a long
// answer keeps the connection busy, as the other adapters do; the whole answer is put together at the end. The model matters, not who serves it
// (decided 2026-11-08): OpenRouter may send a call to any provider that runs the model, but never to another model
// (we never send its model fallbacks, `models`), which the model check confirms. Each answer reports what it cost
// (`usage.cost`, in US dollars of credits): the app's cost for the call is that plus OpenRouter's fee on credits
// (llmRoutes.ts). `region` "eu" sends to `eu.openrouter.ai`, which is served in Europe only (a Business account).

import {
  type Fetch,
  kindForStatus,
  LlmError,
  type LlmContent,
  type LlmProvider,
  type LlmRequest,
  type LlmResponse,
  withJson,
} from "./types.ts";

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

export function toBody(request: LlmRequest): Record<string, unknown> {
  return {
    model: request.model,
    stream: true,
    messages: [
      ...(request.system ? [{ role: "system", content: request.system }] : []),
      ...request.messages.map((m) => ({ role: m.role, content: m.content.map(toPart) })),
    ],
    ...(request.maxOutputTokens ? { max_tokens: request.maxOutputTokens } : {}),
    ...(request.effort ? { reasoning: { effort: request.effort } } : {}),
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
  error?: { code?: number | string; message?: string };
};

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
  const response: LlmResponse = {
    provider: "openrouter",
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
  // A sanity check: the answer must come from the model that was asked. It was paid for all the same.
  if (!sameModel(request.model, model)) return { ...response, unexpectedModel: `Asked ${request.model}, but ${model} answered.` };
  return request.jsonSchema ? withJson(response) : response;
}

type Chunk = {
  model?: string;
  provider?: string;
  choices?: { delta?: { content?: string | null; refusal?: string | null }; finish_reason?: string | null; native_finish_reason?: string | null }[];
  usage?: Completion["usage"];
  error?: Completion["error"];
};

// The streamed answer (server-sent events: "data: {chunk}" lines, ": …" comments while OpenRouter waits, "data: [DONE]"
// at the end) put together as one completion: the text of the deltas, the last finish reason, and the usage, which
// comes in the last chunk. An error after the stream began comes as a chunk of its own.
export function fromStream(text: string): Completion {
  let model: string | undefined;
  let provider: string | undefined;
  let content = "";
  let refusal: string | null = null;
  let finish: string | null = null;
  let nativeFinish: string | null = null;
  let usage: Completion["usage"];
  let chunks = 0;
  for (const line of text.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (data === "" || data === "[DONE]") continue;
    let chunk: Chunk;
    try {
      chunk = JSON.parse(data) as Chunk;
    } catch {
      throw new LlmError("unreadable_response", `A chunk of OpenRouter's answer isn't JSON: ${data.slice(0, 200)}`);
    }
    chunks++;
    if (chunk.error) {
      const status = typeof chunk.error.code === "number" ? chunk.error.code : undefined;
      throw new LlmError(status ? kindForStatus(status) : "server", `OpenRouter: ${chunk.error.message ?? "an error"}`, status);
    }
    model = chunk.model ?? model;
    provider = chunk.provider ?? provider;
    const choice = chunk.choices?.[0];
    content += choice?.delta?.content ?? "";
    refusal = choice?.delta?.refusal ?? refusal;
    finish = choice?.finish_reason ?? finish;
    nativeFinish = choice?.native_finish_reason ?? nativeFinish;
    if (chunk.usage) usage = chunk.usage;
  }
  if (chunks === 0) throw new LlmError("unreadable_response", `OpenRouter's answer has no chunks: ${text.slice(0, 200)}`);
  return {
    model,
    provider,
    choices: [{ message: { content, refusal }, finish_reason: finish, native_finish_reason: nativeFinish }],
    usage,
  };
}

export class OpenRouterProvider implements LlmProvider {
  readonly id = "openrouter" as const;
  readonly #apiKey: string;
  readonly #base: string;
  readonly #fetch: Fetch;

  constructor(options: { apiKey: string; region: string; fetch?: Fetch }) {
    if (!options.apiKey) throw new LlmError("auth", "OpenRouter needs an API key.");
    this.#apiKey = options.apiKey;
    this.#base = openRouterBase(options.region);
    // Called on its own, never as a method of this object: the Workers runtime refuses that ("Illegal invocation").
    this.#fetch = options.fetch ?? ((input, init) => fetch(input, init));
  }

  async send(request: LlmRequest, signal?: AbortSignal): Promise<LlmResponse> {
    const fetchFn = this.#fetch;
    let res: Response;
    try {
      res = await fetchFn(`${this.#base}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${this.#apiKey}`, "content-type": "application/json", "x-title": "score3ly" },
        body: JSON.stringify(toBody(request)),
        signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw new LlmError("aborted", "The request was aborted.");
      throw new LlmError("network", String(err));
    }
    let text: string;
    try {
      text = await res.text();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw new LlmError("aborted", "The request was aborted.");
      throw new LlmError("unreadable_response", `OpenRouter's answer was cut off: ${String(err)}`);
    }
    // A refusal before anything was streamed: a plain JSON error with its HTTP status.
    if (!res.ok) {
      let message = text.slice(0, 300);
      try {
        message = (JSON.parse(text) as Completion).error?.message ?? message;
      } catch {
        // not JSON: the text as it is
      }
      throw new LlmError(kindForStatus(res.status), `OpenRouter answered ${res.status}: ${message}`, res.status);
    }
    return fromCompletion(fromStream(text), request);
  }
}

// A guide to what a model costs on OpenRouter (docs/llm.md, "OpenRouter"): the lowest and highest of each of the four
// prices (input, output, cache read, cache write), US dollars per million tokens, among the providers that run it there
// (its endpoints API, public), without the tiers only a request asks for (`…/fast`, `…/priority`, …). A provider
// without a cache price has none (0: Gemini's implicit caching writes for free). Null where OpenRouter doesn't have
// the model or can't be reached. Only a guide: each call costs what its answer says. Without the fee on credits.
export type PriceRange = { input: [number, number]; output: [number, number]; cacheRead: [number, number]; cacheWrite: [number, number] };

const TIERS = new Set(["fast", "priority", "turbo", "flex"]);

type EndpointPricing = { prompt?: string; completion?: string; input_cache_read?: string; input_cache_write?: string };

export function priceRange(endpoints: { tag?: string; pricing?: EndpointPricing }[]): PriceRange | null {
  const perMillion = (v: string | undefined) => (v === undefined ? NaN : Math.round(Number(v) * 1e6 * 1e6) / 1e6);
  const prices = endpoints
    .filter((e) => !TIERS.has(e.tag?.split("/").at(-1) ?? ""))
    .map((e) => ({
      input: perMillion(e.pricing?.prompt),
      output: perMillion(e.pricing?.completion),
      cacheRead: perMillion(e.pricing?.input_cache_read ?? "0"),
      cacheWrite: perMillion(e.pricing?.input_cache_write ?? "0"),
    }))
    .filter((p) => Object.values(p).every(Number.isFinite));
  if (prices.length === 0) return null;
  const span = (key: keyof PriceRange): [number, number] => [Math.min(...prices.map((p) => p[key])), Math.max(...prices.map((p) => p[key]))];
  return { input: span("input"), output: span("output"), cacheRead: span("cacheRead"), cacheWrite: span("cacheWrite") };
}

// Whether OpenRouter lists a model as free where it is sent (all its prices 0, as its ":free" models are): such calls
// cost nothing, so the spending cap lets them through. Not free where the prices can't be read.
export async function freeOnOpenRouter(model: string, region: string, fetchFn?: Fetch, now = Date.now()): Promise<boolean> {
  const range = await fetchPriceRange(model, region, fetchFn, now);
  return range !== null && Object.values(range).every(([, high]) => high === 0);
}

// Kept a day per host and model, in the Worker's memory.
const ranges = new Map<string, { at: number; range: PriceRange | null }>();
const DAY_MS = 24 * 60 * 60 * 1000;

export async function fetchPriceRange(model: string, region: string, fetchFn: Fetch = (input, init) => fetch(input, init), now = Date.now()): Promise<PriceRange | null> {
  fetchFn ??= (input, init) => fetch(input, init);
  const key = `${region} ${model}`;
  const kept = ranges.get(key);
  if (kept && now - kept.at < DAY_MS) return kept.range;
  let range: PriceRange | null = null;
  try {
    const res = await fetchFn(`${openRouterBase(region)}/models/${model}/endpoints`);
    if (res.ok) range = priceRange(((await res.json()) as { data?: { endpoints?: [] } }).data?.endpoints ?? []);
  } catch {
    return null; // unreachable: not kept, so the next look tries again
  }
  ranges.set(key, { at: now, range });
  return range;
}
