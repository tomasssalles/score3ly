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
  parseJson,
} from "./types.ts";

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

// Gemini through Google's Gemini API (AI Studio keys), with the official SDK. Vertex AI, for processing in the
// EU (§10), would be another adapter on the same SDK.
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
    return request.jsonSchema ? { ...response, json: parseJson(response) } : response;
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
  return new LlmError("network", String(err));
}
