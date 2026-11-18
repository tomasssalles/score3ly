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
  LlmError,
  type LlmProgress,
  type LlmProvider,
  type LlmRequest,
  type LlmResponse,
} from "./types.ts";
import { parseServiceAccount, sharedTokenSource } from "./googleServiceAccount.ts";
import { endedEarly, errorFromBody, fetchFailure, plainFetch, postJson, progressReporter, sseJson, streamError } from "./http.ts";

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

// Gemini, through Google's Gemini API (AI Studio keys) or Google Cloud's Vertex AI (a service account, a location),
// with one class: both take the same REST request (`streamGenerateContent`, called directly: the SDK's streamed call
// drops an error sent as an event of the stream) and answer alike; only the URL and the headers differ, which each
// gives (`geminiApi`, `vertexAi`). The answer isn't checked against the model asked: Gemini names the exact version
// that answered, which can differ from the name asked for.
export class GeminiProvider implements LlmProvider {
  readonly #fetch: Fetch;
  readonly #where: GeminiEndpoint;

  constructor(where: GeminiEndpoint, fetchFn?: Fetch) {
    this.#where = where;
    this.#fetch = plainFetch(fetchFn);
  }

  async send(request: LlmRequest, signal?: AbortSignal, onProgress?: (progress: LlmProgress) => void): Promise<LlmResponse> {
    const { label, url, headers } = this.#where;
    const result = await streamGemini(this.#fetch, url(request.model), headers, request, signal, label, onProgress);
    return fromResult(result, request);
  }
}

// Where a Gemini request goes, and how it is authenticated. `label` starts every error's message.
export type GeminiEndpoint = { label: string; url: (model: string) => string; headers: () => Promise<Headers> };

// The Gemini API, with an AI Studio key.
export function geminiApi(apiKey: string): GeminiEndpoint {
  return {
    label: "Gemini API",
    url: (model) => `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
    headers: async () => new Headers({ "x-goog-api-key": apiKey }),
  };
}

// Vertex AI, for processing in a chosen location (e.g. in the EU, §10), with a service account's key file. Google's SDK
// authenticates with Google's auth library, which doesn't run in a Worker; the token comes from our own token source
// instead. The project is the key file's unless given.
export function vertexAi(options: { serviceAccount: string; region: string; projectId?: string }, fetchFn?: Fetch): GeminiEndpoint {
  const account = parseServiceAccount(options.serviceAccount);
  const auth = sharedTokenSource(account, fetchFn);
  const location = options.region;
  const projectId = options.projectId ?? account.projectId;
  return {
    label: "Vertex AI",
    url: (model) => `https://${vertexHost(location)}/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
    headers: () => auth.getRequestHeaders(),
  };
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
      maxOutputTokens: request.maxOutputTokens,
      ...(request.jsonSchema ? { responseMimeType: "application/json", responseJsonSchema: request.jsonSchema } : {}),
      // Thought summaries are asked for so that the stream carries something while the model thinks: a long silence
      // is cut off by Cloudflare after 125 seconds (`streamGemini`). They cost nothing more (thinking is billed by its
      // full tokens either way), are left out of the answer (`fromResult`), and kept in the raw response.
      // Thinking levels exist from Gemini 3 on; older models take a token budget instead and refuse a level.
      thinkingConfig: { includeThoughts: true, ...(request.effort ? { thinkingLevel: THINKING_LEVELS[request.effort] } : {}) },
    },
  };
}

export function fromResult(result: GenerateContentResponse, request: LlmRequest): LlmResponse {
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

type GeminiError = { error?: { code?: number; message?: string } };

// Sends a request to `streamGenerateContent` and puts the streamed answer together. Streamed, so that something arrives
// before Cloudflare cuts a Worker's request that gets no response within 125 seconds (524; found 2026-11-12, `extract`
// calls with Gemini 3.1 Pro on Vertex AI; streaming alone didn't help, docs/llm.md). `label` starts every error's
// message. The chunks are read as they arrive, and `onProgress` told how much has (docs/llm.md, "A call's progress").
// Failures as every plain-fetch adapter's (http.ts).
async function streamGemini(
  fetchFn: Fetch,
  url: string,
  headersFor: () => Promise<Headers>,
  request: LlmRequest,
  signal: AbortSignal | undefined,
  label: string,
  onProgress?: (progress: LlmProgress) => void,
): Promise<GenerateContentResponse> {
  const chunks: GenerateContentResponse[] = [];
  const progress: LlmProgress = { textChars: 0, thinkingChars: 0, outputTokens: null };
  const report = progressReporter(onProgress);
  let headers: Headers;
  try {
    headers = await headersFor();
  } catch (err) {
    throw fetchFailure(err);
  }
  const response = await postJson(fetchFn, url, headers, toRestBody(request), signal);
  if (!response.ok) throw await errorFromBody(response, label, (text) => `${label}: ${errorText(text)}`);
  await sseJson<GenerateContentResponse & GeminiError>(response, { name: label, notJson: (data) => `${label}: a chunk of the answer isn't JSON: ${data.slice(0, 200)}` }, (chunk) => {
    if (chunk.error) throw streamError(chunk.error.code, `${label}: ${chunk.error.message ?? JSON.stringify(chunk.error)}`);
    chunks.push(chunk);
    if (onProgress) {
      addProgress(progress, chunk);
      report(progress);
    }
  });
  const merged = mergeChunks(chunks);
  // A stream that ended before the answer did: no finish reason, and no blocked prompt.
  if (!merged.candidates?.[0]?.finishReason && !merged.promptFeedback?.blockReason) throw endedEarly(label);
  return merged;
}

// An HTTP error's message: Gemini's own, or else the body as it is.
function errorText(text: string): string {
  try {
    const parsed = JSON.parse(text) as GeminiError | GeminiError[];
    return (Array.isArray(parsed) ? parsed[0] : parsed)?.error?.message ?? text;
  } catch {
    return text; // not JSON
  }
}

// Adds a chunk to what has arrived: its parts' characters, thoughts apart, and the output tokens if the chunk counts
// them (Gemini's counts so far, thinking included as everywhere else, `fromResult`), else null.
function addProgress(progress: LlmProgress, chunk: GenerateContentResponse): void {
  for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
    if (typeof part.text !== "string") continue;
    if (part.thought) progress.thinkingChars += part.text.length;
    else progress.textChars += part.text.length;
  }
  const usage = chunk.usageMetadata;
  progress.outputTokens =
    usage && (usage.candidatesTokenCount !== undefined || usage.thoughtsTokenCount !== undefined)
      ? (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0)
      : null;
}
