import Anthropic from "@anthropic-ai/sdk";
import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";
import type { ContentBlockParam, Message, MessageCreateParamsBase } from "@anthropic-ai/sdk/resources/messages";
import {
  type Effort,
  type Fetch,
  kindForStatus,
  LlmError,
  type LlmProgress,
  type LlmProvider,
  type LlmRequest,
  type LlmResponse,
} from "./types.ts";
import { progressReporter, streamError } from "./http.ts";
import type { Routing } from "./models.ts";

// Claude's efforts are ours (`output_config.effort`).
const EFFORTS: Record<Effort, NonNullable<MessageCreateParamsBase["output_config"]>["effort"]> = { low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" };

// Claude through Anthropic's API or Amazon Bedrock (e.g. in the EU, docs/overview.md §10), with Anthropic's official
// clients: the same Messages API on both, so one class serves them both. Requests are streamed, so long
// answers don't hit HTTP timeouts; the caller gets the whole message at the end. The chosen model answers or the
// call fails: no fallback to another model.
export class ClaudeProvider implements LlmProvider {
  readonly #client: Anthropic | AnthropicBedrock;

  constructor(client: Anthropic | AnthropicBedrock) {
    this.#client = client;
  }

  async send(request: LlmRequest, signal?: AbortSignal, onProgress?: (progress: LlmProgress) => void): Promise<LlmResponse> {
    let message: Message;
    // A throw from the caller's callback (a bug) stops the stream and fails the call as `unknown` (http.ts).
    let callbackFailure: LlmError | null = null;
    try {
      const stream = this.#client.messages.stream(toParams(request), { signal });
      if (onProgress) {
        const report = progressReporter(onProgress);
        // The deltas' characters, thinking apart (summaries, where shown), and the output tokens where `message_delta`
        // counts them, near the end (docs/llm.md, "A call's progress").
        let textChars = 0;
        let thinkingChars = 0;
        stream.on("streamEvent", (event) => {
          let outputTokens: number | null = null;
          if (event.type === "content_block_delta") {
            if (event.delta.type === "text_delta") textChars += event.delta.text.length;
            else if (event.delta.type === "thinking_delta") thinkingChars += event.delta.thinking.length;
            else return;
          } else if (event.type === "message_delta") {
            outputTokens = event.usage.output_tokens;
          } else return;
          try {
            report({ textChars, thinkingChars, outputTokens });
          } catch (err) {
            callbackFailure ??= err as LlmError;
            stream.abort();
          }
        });
      }
      message = await stream.finalMessage();
    } catch (err) {
      throw callbackFailure ?? toLlmError(err);
    }
    return fromMessage(message);
  }
}

// The SDK's own retries are off (it would resend a call up to twice on 408, 409, 429, 5xx and lost connections, a 524
// included, each possibly billed, under one recorded call): one recorded call is one request, and the stage's Retry is
// the retry policy (docs/llm.md, "Calling the providers").
const MAX_RETRIES = 0;

// Anthropic's own API, with an API key.
export function anthropicProvider(options: { apiKey: string; fetch?: Fetch }): ClaudeProvider {
  const client = new Anthropic({ apiKey: options.apiKey, fetch: options.fetch, maxRetries: MAX_RETRIES });
  return new ClaudeProvider(client);
}

// Amazon Bedrock, through `bedrock-runtime` (InvokeModel; not the Messages API endpoint, "Mantle": docs/llm.md, "Calling
// the providers"), with either a Bedrock API key or an AWS access key pair (requests are then signed with AWS Signature
// V4). `region` is the region requests are sent to, e.g. "eu-central-1". The model is Bedrock's ID for it, with the
// routing's prefix where there is one (an inference profile, `bedrockModel`).
export function bedrockClaudeProvider(options: {
  region: string;
  apiKey?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  fetch?: Fetch;
}): ClaudeProvider {
  const { region, apiKey, accessKeyId, secretAccessKey } = options;
  const keyPair = accessKeyId !== undefined || secretAccessKey !== undefined;
  const oneWay = (apiKey !== undefined) !== keyPair; // an API key or a key pair, not both nor neither
  if (!oneWay || (keyPair && (!accessKeyId || !secretAccessKey))) {
    throw new LlmError("auth", "Bedrock needs either an API key or an access key pair (key ID and secret), not both.");
  }
  // Explicit credentials only: the client would otherwise look for them in the environment and AWS's files.
  const common = { awsRegion: region, fetch: options.fetch, maxRetries: MAX_RETRIES };
  const client =
    apiKey !== undefined
      ? new AnthropicBedrock({ ...common, apiKey })
      : new AnthropicBedrock({ ...common, awsAccessKey: accessKeyId!, awsSecretKey: secretAccessKey! });
  return new ClaudeProvider(client);
}

export function toParams(request: LlmRequest): MessageCreateParamsBase {
  const outputConfig: MessageCreateParamsBase["output_config"] = {};
  if (request.effort) outputConfig.effort = EFFORTS[request.effort];
  if (request.jsonSchema) outputConfig.format = { type: "json_schema", schema: request.jsonSchema };
  return {
    model: request.model,
    max_tokens: request.maxOutputTokens,
    ...(request.system ? { system: request.system } : {}),
    messages: request.messages.map((message) => ({
      role: message.role,
      content: message.content.map((part): ContentBlockParam => {
        // A cache breakpoint, with the default lifetime: 5 minutes from the last use.
        const cache = part.cacheUpTo ? { cache_control: { type: "ephemeral" as const } } : {};
        return part.type === "text"
          ? { type: "text", text: part.text, ...cache }
          : { type: "image", source: { type: "base64", media_type: part.image.mediaType, data: part.image.base64 }, ...cache };
      }),
    })),
    ...(Object.keys(outputConfig).length > 0 ? { output_config: outputConfig } : {}),
    ...(request.adaptiveThinking ? { thinking: { type: "adaptive" } } : {}),
  } as MessageCreateParamsBase;
}

export function fromMessage(message: Message): LlmResponse {
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

// The HTTP status each of Anthropic's error types goes with (its page "Errors"), for an error sent in the stream.
const ERROR_TYPES: Record<string, number> = {
  invalid_request_error: 400,
  authentication_error: 401,
  billing_error: 402,
  permission_error: 403,
  not_found_error: 404,
  request_too_large: 413,
  rate_limit_error: 429,
  api_error: 500,
  timeout_error: 504,
  overloaded_error: 529,
};

// The SDK's typed errors, most specific first.
function toLlmError(err: unknown): LlmError {
  if (err instanceof Anthropic.APIConnectionTimeoutError) return new LlmError("timeout", err.message);
  if (err instanceof Anthropic.APIConnectionError) return new LlmError("network", err.message);
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new LlmError("auth", err.message, err.status);
  }
  if (err instanceof Anthropic.RateLimitError) return new LlmError("rate_limit", err.message, err.status);
  if (err instanceof Anthropic.APIError && typeof err.status === "number") {
    return new LlmError(kindForStatus(err.status), err.message, err.status);
  }
  // An error sent as an event of the stream, after a 200: the kind its type means, without an HTTP status (http.ts).
  const streamed = err instanceof Anthropic.APIError ? ERROR_TYPES[(err.error as { error?: { type?: string } } | undefined)?.error?.type ?? ""] : undefined;
  if (streamed !== undefined) return streamError(streamed, err instanceof Error ? err.message : String(err));
  if (err instanceof Anthropic.APIUserAbortError) return new LlmError("aborted", "The request was aborted.");
  // The stream's own errors (events out of order, a stream that ended without a message) and broken JSON in it.
  if (err instanceof SyntaxError || (err instanceof Anthropic.AnthropicError && !(err instanceof Anthropic.APIError))) {
    return new LlmError("unreadable_response", String(err));
  }
  return new LlmError("unknown", String(err));
}

// The names Bedrock may answer with for the model asked: the string as sent, without the routing's prefix ("global.",
// "eu.", …: an inference profile), or Anthropic's own name for it (found 2026-11-08: asked
// eu.anthropic.claude-sonnet-4-6, answered claude-sonnet-4-6), for a dated model with or without its date
// ("anthropic.claude-haiku-4-5-20251001-v1:0": claude-haiku-4-5-20251001, claude-haiku-4-5).
export function bedrockNames(model: string): string[] {
  const id = model.replace(/^[a-z]+(?:-[a-z]+)?\.(?=anthropic\.)/, "");
  const own = id.replace(/^anthropic\./, "").replace(/-v\d+(?::\d+)?$/, "");
  return [...new Set([model, id, own, own.replace(/-\d{8}$/, "")])];
}

// The model string Bedrock is sent for a routing: on `bedrock-runtime`, global and geographic routing go through AWS's
// inference profiles, named by the model ID with a prefix, "global." or the geography's ("eu.", "us.", "jp.", "au.");
// in-region routing sends the model ID alone (Anthropic's page "Claude on Amazon Bedrock (Opus 4.6 and earlier)").
// `bedrockNames` reads it back.
export function bedrockModel(model: string, routing: Routing | null, geography: string | undefined): string {
  if (routing === "global") return `global.${model}`;
  if (routing === "geographic" && geography) return `${geography.toLowerCase()}.${model}`;
  return model;
}
