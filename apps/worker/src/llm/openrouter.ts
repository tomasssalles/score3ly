// OpenRouter (docs/llm.md, "Calling the providers"): one API key for Claude, Gemini and others, through its
// OpenAI-compatible Chat Completions API, with a plain `fetch` (no SDK). The model matters, not who serves it
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
    const text = await res.text().catch(() => "");
    let body: Completion;
    try {
      body = JSON.parse(text) as Completion;
    } catch {
      if (!res.ok) throw new LlmError(kindForStatus(res.status), `OpenRouter answered ${res.status}: ${text.slice(0, 300)}`, res.status);
      throw new LlmError("unreadable_response", `OpenRouter's answer isn't JSON: ${text.slice(0, 200)}`);
    }
    if (!res.ok) throw new LlmError(kindForStatus(res.status), `OpenRouter answered ${res.status}: ${body.error?.message ?? text.slice(0, 300)}`, res.status);
    // An error after the request was accepted comes with a 200 and no choices.
    if (body.error && !body.choices?.length) {
      const status = typeof body.error.code === "number" ? body.error.code : undefined;
      throw new LlmError(status ? kindForStatus(status) : "server", `OpenRouter: ${body.error.message ?? "an error"}`, status);
    }
    if (!body.choices?.length) throw new LlmError("unreadable_response", `OpenRouter's answer has no choices: ${text.slice(0, 200)}`);
    return fromCompletion(body, request);
  }
}
