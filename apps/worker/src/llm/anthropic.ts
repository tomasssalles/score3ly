import Anthropic from "@anthropic-ai/sdk";
import { AnthropicVertex } from "@anthropic-ai/vertex-sdk";
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
import { parseServiceAccount, tokenSource } from "./googleServiceAccount.ts";

const DEFAULT_MAX_OUTPUT_TOKENS = 64_000;

// Claude through Anthropic's API, or through Google Cloud's Vertex AI (e.g. in the EU, DESIGN.md §10), with the
// official SDKs: the same Messages API either way, so one class serves both. Requests are streamed, so long
// answers don't hit HTTP timeouts; the caller gets the whole message at the end. The chosen model answers or the
// call fails: no fallback to another model.
export class ClaudeProvider implements LlmProvider {
  readonly id: "anthropic" | "anthropic-vertex";
  readonly #client: Anthropic | AnthropicVertex;

  constructor(id: ClaudeProvider["id"], client: Anthropic | AnthropicVertex) {
    this.id = id;
    this.#client = client;
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
    const response = { ...fromMessage(message), provider: this.id };
    return request.jsonSchema ? { ...response, json: parseJson(response) } : response;
  }
}

// Anthropic's own API, with an API key.
export function anthropicProvider(options: { apiKey: string; fetch?: Fetch; maxRetries?: number }): ClaudeProvider {
  const client = new Anthropic({ apiKey: options.apiKey, fetch: options.fetch, maxRetries: options.maxRetries });
  return new ClaudeProvider("anthropic", client);
}

type VertexAuthClient = NonNullable<NonNullable<ConstructorParameters<typeof AnthropicVertex>[0]>["authClient"]>;

// Vertex AI, with a service account's key file. `region` is where requests are processed: "eu" (the EU
// multi-region), a single region such as "europe-west1", "us", or "global".
export function vertexClaudeProvider(options: {
  serviceAccount: string; // the key file's JSON
  region: string;
  projectId?: string; // default: the service account's project
  fetch?: Fetch;
  maxRetries?: number;
}): ClaudeProvider {
  const account = parseServiceAccount(options.serviceAccount);
  const auth = tokenSource(account, options.fetch);
  const client = new AnthropicVertex({
    region: options.region,
    projectId: options.projectId ?? account.projectId,
    // Our own token source: Google's auth library doesn't run in a Worker.
    authClient: auth as unknown as VertexAuthClient,
    fetch: options.fetch,
    maxRetries: options.maxRetries,
  });
  return new ClaudeProvider("anthropic-vertex", client);
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
  // On Vertex AI, a failure to get a token (e.g. a refused service account) comes wrapped as a connection error.
  if (err instanceof Anthropic.APIConnectionError && err.cause instanceof LlmError) return err.cause;
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
