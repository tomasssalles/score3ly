import {
  ApiError,
  FinishReason,
  type GenerateContentParameters,
  type GenerateContentResponse,
  GoogleGenAI,
  ThinkingLevel,
} from "@google/genai";
import {
  type Effort,
  type Fetch,
  kindForStatus,
  LlmError,
  type LlmProvider,
  type LlmRequest,
  type LlmResponse,
  withJson,
} from "./types.ts";
import { parseServiceAccount, sharedTokenSource, type TokenSource } from "./googleServiceAccount.ts";

// Gemini's thinking levels are fewer than our efforts.
const THINKING_LEVELS: Record<Effort, ThinkingLevel> = {
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
  xhigh: ThinkingLevel.HIGH,
  max: ThinkingLevel.HIGH,
};

// Reasons Gemini stops that mean it declined.
const REFUSALS = new Set<string>([
  FinishReason.SAFETY,
  FinishReason.RECITATION,
  FinishReason.BLOCKLIST,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.SPII,
  FinishReason.IMAGE_SAFETY,
  FinishReason.IMAGE_PROHIBITED_CONTENT,
]);

// Gemini through Google's Gemini API (AI Studio keys), with the official SDK. Gemini on Vertex AI is
// `VertexGeminiProvider` below.
export class GoogleProvider implements LlmProvider {
  readonly id = "google" as const;
  readonly #client: GoogleGenAI;

  constructor(options: { apiKey: string; fetch?: Fetch }) {
    this.#client = new GoogleGenAI({
      apiKey: options.apiKey,
      ...(options.fetch ? { httpOptions: { fetch: options.fetch } } : {}),
    });
  }

  async send(request: LlmRequest, signal?: AbortSignal): Promise<LlmResponse> {
    let result: GenerateContentResponse;
    try {
      result = await this.#client.models.generateContent(toParams(request, signal));
    } catch (err) {
      throw toLlmError(err);
    }
    const response = fromResult(result, request);
    return request.jsonSchema ? withJson(response) : response;
  }
}

export function toParams(request: LlmRequest, signal?: AbortSignal): GenerateContentParameters {
  return {
    model: request.model,
    contents: request.messages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: message.content.map((part) =>
        part.type === "text"
          ? { text: part.text }
          : { inlineData: { mimeType: part.image.mediaType, data: part.image.base64 } },
      ),
    })),
    config: {
      ...(request.system ? { systemInstruction: request.system } : {}),
      ...(request.maxOutputTokens ? { maxOutputTokens: request.maxOutputTokens } : {}),
      ...(request.jsonSchema ? { responseMimeType: "application/json", responseJsonSchema: request.jsonSchema } : {}),
      // Thinking levels exist from Gemini 3 on; older models take a token budget instead and refuse a level.
      ...(request.effort ? { thinkingConfig: { thinkingLevel: THINKING_LEVELS[request.effort] } } : {}),
      ...(signal ? { abortSignal: signal } : {}),
    },
  };
}

export function fromResult(result: GenerateContentResponse, request: LlmRequest): Omit<LlmResponse, "json"> {
  const candidate = result.candidates?.[0];
  const reason = candidate?.finishReason;
  const blocked = result.promptFeedback?.blockReason;
  const stop = blocked
    ? "refusal"
    : reason === FinishReason.STOP
      ? "end"
      : reason === FinishReason.MAX_TOKENS
        ? "max_tokens"
        : reason && REFUSALS.has(reason)
          ? "refusal"
          : "other";
  // Only the answer's text, without thought summaries.
  const text = (candidate?.content?.parts ?? [])
    .filter((part) => typeof part.text === "string" && !part.thought)
    .map((part) => part.text)
    .join("");
  const usage = result.usageMetadata;
  const prompt = usage?.promptTokenCount ?? 0;
  const cached = usage?.cachedContentTokenCount ?? 0;
  return {
    provider: "google",
    // Gemini names the exact version that answered, which can differ from the name asked for (an alias such as
    // "...-latest", or a dated version), so it isn't compared with the request.
    model: result.modelVersion ?? request.model,
    text,
    stop,
    stopDetail: blocked ?? reason,
    usage: {
      // Gemini counts cached tokens as part of the prompt; here they are counted apart, as for Claude.
      inputTokens: prompt - cached,
      // Thinking is billed as output.
      outputTokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
      cacheReadTokens: cached,
      cacheWriteTokens: 0,
    },
    raw: result,
  };
}

function toLlmError(err: unknown): LlmError {
  if (err instanceof ApiError) return new LlmError(kindForStatus(err.status), err.message, err.status);
  if (err instanceof SyntaxError) return new LlmError("unreadable_response", String(err));
  if (err instanceof DOMException && err.name === "AbortError") return new LlmError("aborted", "The request was aborted.");
  if (err instanceof TypeError) return new LlmError("network", String(err)); // fetch's own failure
  return new LlmError("unknown", String(err));
}

// Where Vertex AI answers for a location: the global endpoint, the US or EU multi-region, or a single region (the same
// rule as Anthropic's Vertex SDK, for Claude).
export function vertexHost(location: string): string {
  if (location === "global") return "aiplatform.googleapis.com";
  if (location === "us" || location === "eu") return `aiplatform.${location}.rep.googleapis.com`;
  return `${location}-aiplatform.googleapis.com`;
}

// The body of Vertex AI's `generateContent` (REST, as JSON): the same request as the Gemini API's, with the config
// split into a system instruction and a generation config.
export function toVertexBody(request: LlmRequest): Record<string, unknown> {
  const { contents, config } = toParams(request);
  const { systemInstruction, abortSignal: _signal, ...generationConfig } = config ?? {};
  return {
    contents,
    ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction as string }] } } : {}),
    ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
  };
}

// Gemini through Google Cloud's Vertex AI, for processing in a chosen location (e.g. in the EU, §10), with a service
// account's key file as for Claude on Vertex AI. Vertex's REST API is called directly: Google's SDK authenticates
// with Google's auth library, which doesn't run in a Worker; the token comes from our own token source instead.
export class VertexGeminiProvider implements LlmProvider {
  readonly id = "google-vertex" as const;
  readonly #fetch: Fetch;
  readonly #auth: TokenSource;
  readonly #location: string;
  readonly #projectId: string;

  constructor(options: { serviceAccount: string; region: string; projectId?: string; fetch?: Fetch }) {
    const account = parseServiceAccount(options.serviceAccount);
    // Wrapped, so that `this.#fetch(…)` doesn't call fetch as a method of this object, which the Workers runtime refuses.
    const fetchFn = options.fetch ?? fetch;
    this.#fetch = (input, init) => fetchFn(input, init);
    this.#auth = sharedTokenSource(account, options.fetch);
    this.#location = options.region;
    this.#projectId = options.projectId ?? account.projectId;
  }

  async send(request: LlmRequest, signal?: AbortSignal): Promise<LlmResponse> {
    const url = `https://${vertexHost(this.#location)}/v1/projects/${encodeURIComponent(this.#projectId)}/locations/${encodeURIComponent(this.#location)}/publishers/google/models/${encodeURIComponent(request.model)}:generateContent`;
    let response: Response;
    try {
      const headers = await this.#auth.getRequestHeaders();
      headers.set("content-type", "application/json");
      response = await this.#fetch(url, { method: "POST", headers, body: JSON.stringify(toVertexBody(request)), signal });
    } catch (err) {
      throw err instanceof LlmError ? err : toLlmError(err);
    }
    const text = await response.text();
    if (!response.ok) {
      let message = text;
      try {
        message = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? text;
      } catch {
        // Not JSON: the text as it is.
      }
      throw new LlmError(kindForStatus(response.status), `Vertex AI: ${message}`, response.status);
    }
    let result: GenerateContentResponse;
    try {
      result = JSON.parse(text) as GenerateContentResponse;
    } catch (err) {
      throw toLlmError(err);
    }
    const answer = { ...fromResult(result, request), provider: "google-vertex" as const };
    return request.jsonSchema ? withJson(answer) : answer;
  }
}
