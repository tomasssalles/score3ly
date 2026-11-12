import {
  type Candidate,
  FinishReason,
  type GenerateContentParameters,
  type GenerateContentResponse,
  type Part,
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

// Gemini through Google's Gemini API (AI Studio keys). Its REST API is called directly, as Vertex AI's below, with the
// request built by the same code: the SDK's streamed call drops an error sent as an event of the stream. Gemini on
// Vertex AI is `VertexGeminiProvider` below.
export class GoogleProvider implements LlmProvider {
  readonly id = "google" as const;
  readonly #apiKey: string;
  readonly #fetch: Fetch;

  constructor(options: { apiKey: string; fetch?: Fetch }) {
    this.#apiKey = options.apiKey;
    // Wrapped, so that `this.#fetch(…)` doesn't call fetch as a method of this object, which the Workers runtime refuses.
    const fetchFn = options.fetch ?? fetch;
    this.#fetch = (input, init) => fetchFn(input, init);
  }

  async send(request: LlmRequest, signal?: AbortSignal): Promise<LlmResponse> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.model)}:streamGenerateContent?alt=sse`;
    const headers = new Headers({ "x-goog-api-key": this.#apiKey });
    const result = await streamGemini(this.#fetch, url, async () => headers, request, signal, "Gemini API");
    const response = fromResult(result, request);
    return request.jsonSchema ? withJson(response) : response;
  }
}

function toParams(request: LlmRequest): GenerateContentParameters {
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

// A streamed answer's chunks put together as one response, as `generateContent` would have answered: the parts in
// order (adjacent texts of the same kind joined), and the last finish reason, usage and model version given.
export function mergeChunks(chunks: GenerateContentResponse[]): GenerateContentResponse {
  if (chunks.length === 0) throw new LlmError("unreadable_response", "Gemini's streamed answer has no chunks.");
  const parts: Part[] = [];
  let candidate: Candidate | undefined;
  const merged: GenerateContentResponse = {} as GenerateContentResponse;
  for (const chunk of chunks) {
    if (chunk.promptFeedback) merged.promptFeedback = chunk.promptFeedback;
    if (chunk.usageMetadata) merged.usageMetadata = chunk.usageMetadata;
    if (chunk.modelVersion) merged.modelVersion = chunk.modelVersion;
    if (chunk.responseId) merged.responseId = chunk.responseId;
    const c = chunk.candidates?.[0];
    if (!c) continue;
    const { content, ...rest } = c;
    candidate = { ...candidate, ...rest, content: { role: content?.role ?? candidate?.content?.role ?? "model", parts } };
    for (const part of content?.parts ?? []) {
      const last = parts[parts.length - 1];
      if (last && isPlainText(last) && isPlainText(part) && !last.thought === !part.thought) {
        parts[parts.length - 1] = { ...last, text: last.text + part.text };
      } else {
        parts.push({ ...part });
      }
    }
  }
  if (candidate) merged.candidates = [candidate];
  return merged;
}

// A part that is only text (a thought or not), which can be joined with the next.
function isPlainText(part: Part): part is Part & { text: string } {
  return typeof part.text === "string" && Object.keys(part).every((key) => key === "text" || key === "thought");
}

function toLlmError(err: unknown): LlmError {
  if (err instanceof LlmError) return err;
  if (err instanceof SyntaxError) return new LlmError("unreadable_response", String(err));
  if (err instanceof DOMException && err.name === "AbortError") return new LlmError("aborted", "The request was aborted.");
  if (err instanceof TypeError) return new LlmError("network", String(err)); // fetch's own failure
  return new LlmError("unknown", String(err));
}

// Where Vertex AI answers for a location: the global endpoint, the US or EU multi-region, or a single region (the same
// rule as Anthropic's Vertex SDK).
export function vertexHost(location: string): string {
  if (location === "global") return "aiplatform.googleapis.com";
  if (location === "us" || location === "eu") return `aiplatform.${location}.rep.googleapis.com`;
  return `${location}-aiplatform.googleapis.com`;
}

// The body of `streamGenerateContent` (REST, as JSON), the same on the Gemini API and on Vertex AI: the SDK's parameters
// with the config split into a system instruction and a generation config.
export function toRestBody(request: LlmRequest): Record<string, unknown> {
  const { contents, config } = toParams(request);
  const { systemInstruction, ...generationConfig } = config ?? {};
  return {
    contents,
    ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction as string }] } } : {}),
    ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
  };
}

// Gemini through Google Cloud's Vertex AI, for processing in a chosen location (e.g. in the EU, §10), with a service
// account's key file. Vertex's REST API is called directly: Google's SDK authenticates
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
    const url = `https://${vertexHost(this.#location)}/v1/projects/${encodeURIComponent(this.#projectId)}/locations/${encodeURIComponent(this.#location)}/publishers/google/models/${encodeURIComponent(request.model)}:streamGenerateContent?alt=sse`;
    const result = await streamGemini(this.#fetch, url, () => this.#auth.getRequestHeaders(), request, signal, "Vertex AI");
    const answer = { ...fromResult(result, request), provider: "google-vertex" as const };
    return request.jsonSchema ? withJson(answer) : answer;
  }
}

type GeminiError = { error?: { code?: number; message?: string } };

// Sends a request to `streamGenerateContent` and puts the streamed answer together. Streamed, so that something arrives
// before Cloudflare cuts a Worker's request that gets no response within 125 seconds (524; found 2026-11-12, `extract`
// calls with Gemini 3.1 Pro on Vertex AI; streaming alone didn't help, docs/llm.md). `label` starts every error's
// message.
async function streamGemini(
  fetchFn: Fetch,
  url: string,
  headersFor: () => Promise<Headers>,
  request: LlmRequest,
  signal: AbortSignal | undefined,
  label: string,
): Promise<GenerateContentResponse> {
  let response: Response;
  let text: string;
  try {
    const headers = await headersFor();
    headers.set("content-type", "application/json");
    response = await fetchFn(url, { method: "POST", headers, body: JSON.stringify(toRestBody(request)), signal });
    text = await response.text();
  } catch (err) {
    throw toLlmError(err);
  }
  if (!response.ok) {
    let message = text;
    try {
      const parsed = JSON.parse(text) as GeminiError | GeminiError[];
      message = (Array.isArray(parsed) ? parsed[0] : parsed)?.error?.message ?? text;
    } catch {
      // Not JSON: the text as it is.
    }
    throw new LlmError(kindForStatus(response.status), `${label}: ${message}`, response.status);
  }
  return mergeChunks(sseChunks(text, label));
}

// A streamed answer ("data: {chunk}" events) as its chunks. An error after the stream began comes as a chunk of its own,
// with the error's code and message.
export function sseChunks(text: string, label: string): GenerateContentResponse[] {
  const chunks: GenerateContentResponse[] = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (data === "") continue;
    let chunk: GenerateContentResponse & GeminiError;
    try {
      chunk = JSON.parse(data);
    } catch {
      throw new LlmError("unreadable_response", `${label}: a chunk of the answer isn't JSON: ${data.slice(0, 200)}`);
    }
    if (chunk.error) {
      const status = typeof chunk.error.code === "number" ? chunk.error.code : undefined;
      throw new LlmError(status ? kindForStatus(status) : "server", `${label}: ${chunk.error.message ?? JSON.stringify(chunk.error)}`, status);
    }
    chunks.push(chunk);
  }
  return chunks;
}
