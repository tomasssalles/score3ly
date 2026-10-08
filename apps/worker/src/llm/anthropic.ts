import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaContentBlockParam,
  BetaMessage,
  BetaMessageStreamParams,
} from "@anthropic-ai/sdk/resources/beta/messages";
import {
  type Fetch,
  kindForStatus,
  LlmError,
  type LlmProvider,
  type LlmRequest,
  type LlmResponse,
  type LlmUsage,
  parseJson,
} from "./types.ts";

// Models whose requests can fall back to another model when a safety classifier declines them: "default" lets
// Anthropic pick the fallback by the refusal's category. Without it, a declined request simply stops.
const DEFAULT_FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

const DEFAULT_MAX_OUTPUT_TOKENS = 64_000;

// Claude through Anthropic's API, with the official SDK. Requests are streamed, so long answers don't hit HTTP
// timeouts; the caller gets the whole message at the end.
export class AnthropicProvider implements LlmProvider {
  readonly id = "anthropic" as const;
  readonly #client: Anthropic;

  constructor(options: { apiKey: string; fetch?: Fetch; maxRetries?: number }) {
    this.#client = new Anthropic({ apiKey: options.apiKey, fetch: options.fetch, maxRetries: options.maxRetries });
  }

  async send(request: LlmRequest, signal?: AbortSignal): Promise<LlmResponse> {
    let message: BetaMessage;
    try {
      message = await this.#client.beta.messages.stream(toParams(request), { signal }).finalMessage();
    } catch (err) {
      throw toLlmError(err);
    }
    const response = fromMessage(message, request);
    return request.jsonSchema ? { ...response, json: parseJson(response) } : response;
  }
}

export function toParams(request: LlmRequest): BetaMessageStreamParams {
  const outputConfig: BetaMessageStreamParams["output_config"] = {};
  if (request.effort) outputConfig.effort = request.effort;
  if (request.jsonSchema) outputConfig.format = { type: "json_schema", schema: request.jsonSchema };
  const fallbacks = DEFAULT_FALLBACK_MODELS.has(request.model);
  return {
    model: request.model,
    max_tokens: request.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    ...(request.system ? { system: request.system } : {}),
    messages: request.messages.map((message) => ({
      role: message.role,
      content: message.content.map(
        (part): BetaContentBlockParam =>
          part.type === "text"
            ? { type: "text", text: part.text }
            : { type: "image", source: { type: "base64", media_type: part.image.mediaType, data: part.image.base64 } },
      ),
    })),
    ...(Object.keys(outputConfig).length > 0 ? { output_config: outputConfig } : {}),
    ...(fallbacks ? { fallbacks: "default", betas: [FALLBACK_BETA] } : {}),
  };
}

export function fromMessage(message: BetaMessage, request: LlmRequest): Omit<LlmResponse, "json"> {
  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
  const stop =
    message.stop_reason === "end_turn"
      ? "end"
      : message.stop_reason === "max_tokens" || message.stop_reason === "model_context_window_exceeded"
        ? "max_tokens"
        : message.stop_reason === "refusal"
          ? "refusal"
          : "other";
  const stopDetail =
    message.stop_reason === "refusal"
      ? (message.stop_details?.category ?? undefined)
      : (message.stop_reason ?? undefined);
  return {
    provider: "anthropic",
    model: message.model,
    text,
    stop,
    stopDetail,
    usage: usageOf(message, request),
    raw: message,
  };
}

// One entry per model that ran. With a fallback, the usage's iterations say which tokens went to which model.
function usageOf(message: BetaMessage, request: LlmRequest): LlmUsage[] {
  const iterations = (message.usage.iterations ?? []).filter(
    (it) => it.type === "message" || it.type === "fallback_message",
  );
  if (iterations.length > 0) {
    return iterations.map((it) => ({
      model: it.model ?? request.model,
      inputTokens: it.input_tokens,
      outputTokens: it.output_tokens,
      cacheReadTokens: it.cache_read_input_tokens ?? 0,
      cacheWriteTokens: it.cache_creation_input_tokens ?? 0,
    }));
  }
  const { usage } = message;
  return [
    {
      model: message.model,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheReadTokens: usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
    },
  ];
}

// The SDK's typed errors, most specific first.
function toLlmError(err: unknown): LlmError {
  if (err instanceof Anthropic.APIConnectionError) return new LlmError("network", err.message);
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new LlmError("auth", err.message, err.status);
  }
  if (err instanceof Anthropic.RateLimitError) return new LlmError("rate_limit", err.message, err.status);
  if (err instanceof Anthropic.APIError && typeof err.status === "number") {
    return new LlmError(kindForStatus(err.status), err.message, err.status);
  }
  if (err instanceof Anthropic.APIUserAbortError) return new LlmError("network", "The request was aborted.");
  return new LlmError("network", String(err));
}
