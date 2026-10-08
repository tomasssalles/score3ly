import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlockParam, Message, MessageCreateParamsBase } from "@anthropic-ai/sdk/resources/messages";
import {
  type Fetch,
  kindForStatus,
  LlmError,
  type LlmProvider,
  type LlmRequest,
  type LlmResponse,
  parseJson,
} from "./types.ts";

const DEFAULT_MAX_OUTPUT_TOKENS = 64_000;

// Claude through Anthropic's API, with the official SDK. Requests are streamed, so long answers don't hit HTTP
// timeouts; the caller gets the whole message at the end. The chosen model answers or the call fails: no fallback
// to another model.
export class AnthropicProvider implements LlmProvider {
  readonly id = "anthropic" as const;
  readonly #client: Anthropic;

  constructor(options: { apiKey: string; fetch?: Fetch; maxRetries?: number }) {
    this.#client = new Anthropic({ apiKey: options.apiKey, fetch: options.fetch, maxRetries: options.maxRetries });
  }

  async send(request: LlmRequest, signal?: AbortSignal): Promise<LlmResponse> {
    let message: Message;
    try {
      message = await this.#client.messages.stream(toParams(request), { signal }).finalMessage();
    } catch (err) {
      throw toLlmError(err);
    }
    // A sanity check: the answer must come from the model that was asked.
    if (message.model !== request.model) {
      throw new LlmError("unexpected_model", `Asked ${request.model}, but ${message.model} answered.`);
    }
    const response = fromMessage(message);
    return request.jsonSchema ? { ...response, json: parseJson(response) } : response;
  }
}

export function toParams(request: LlmRequest): MessageCreateParamsBase {
  const outputConfig: MessageCreateParamsBase["output_config"] = {};
  if (request.effort) outputConfig.effort = request.effort;
  if (request.jsonSchema) outputConfig.format = { type: "json_schema", schema: request.jsonSchema };
  return {
    model: request.model,
    max_tokens: request.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    ...(request.system ? { system: request.system } : {}),
    messages: request.messages.map((message) => ({
      role: message.role,
      content: message.content.map(
        (part): ContentBlockParam =>
          part.type === "text"
            ? { type: "text", text: part.text }
            : { type: "image", source: { type: "base64", media_type: part.image.mediaType, data: part.image.base64 } },
      ),
    })),
    ...(Object.keys(outputConfig).length > 0 ? { output_config: outputConfig } : {}),
  };
}

export function fromMessage(message: Message): Omit<LlmResponse, "json"> {
  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
  const reason = message.stop_reason;
  const stop =
    reason === "end_turn"
      ? "end"
      : reason === "max_tokens" || reason === "model_context_window_exceeded"
        ? "max_tokens"
        : reason === "refusal"
          ? "refusal"
          : "other";
  const stopDetail = reason === "refusal" ? (message.stop_details?.category ?? undefined) : (reason ?? undefined);
  const { usage } = message;
  return {
    provider: "anthropic",
    model: message.model,
    text,
    stop,
    stopDetail,
    usage: {
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheReadTokens: usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
    },
    raw: message,
  };
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
