// Calling vision LLMs without caring which provider answers (DESIGN.md §3, the `LlmProvider` port). Requests and
// responses are our own, small shapes; each provider's adapter translates them. The Worker makes the calls, so the
// API keys never leave it (§10).

export type ProviderId = "anthropic" | "anthropic-vertex" | "anthropic-bedrock" | "google";

export type LlmImage = {
  mediaType: "image/png" | "image/jpeg" | "image/webp";
  base64: string;
};

export type LlmContent = { type: "text"; text: string } | { type: "image"; image: LlmImage };

export type LlmMessage = { role: "user" | "assistant"; content: LlmContent[] };

// How hard the model thinks. Each adapter maps it to what its provider offers.
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export type LlmRequest = {
  model: string; // the provider's model ID, e.g. "claude-opus-5-5"
  system?: string;
  messages: LlmMessage[];
  maxOutputTokens?: number;
  effort?: Effort; // left out: the provider's default
  // A JSON schema the answer must follow (the provider's schema-constrained output, §7.2). The answer is then
  // parsed into `json`; checking it further (e.g. with Zod) is up to the caller.
  jsonSchema?: Record<string, unknown>;
};

// Tokens of one call, as the provider bills them. Costs are computed from these and the model's prices (§10).
export type LlmUsage = {
  inputTokens: number; // not counting cache reads
  outputTokens: number; // thinking included
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

export type LlmResponse = {
  provider: ProviderId;
  model: string; // the model that answered, as the provider names it
  text: string;
  json?: unknown; // when the request had a jsonSchema and the model finished
  // end: finished. max_tokens: cut off. refusal: the model (or its safety system) declined.
  stop: "end" | "max_tokens" | "refusal" | "other";
  stopDetail?: string; // the provider's reason, e.g. a refusal's category
  usage: LlmUsage;
  raw: unknown; // the provider's whole response, for the call record (§5.2)
};

export type LlmErrorKind =
  | "auth" // the key is wrong, or not allowed to use the model
  | "rate_limit"
  | "overloaded"
  | "bad_request" // the request itself is wrong: retrying won't help
  | "server"
  | "network"
  | "invalid_output" // the answer should have been JSON following the schema, and isn't
  | "unexpected_model"; // another model answered than the one asked

export class LlmError extends Error {
  readonly kind: LlmErrorKind;
  readonly status: number | undefined;

  constructor(kind: LlmErrorKind, message: string, status?: number) {
    super(message);
    this.name = "LlmError";
    this.kind = kind;
    this.status = status;
  }

  // Worth trying again later, unchanged.
  get retryable(): boolean {
    return ["rate_limit", "overloaded", "server", "network"].includes(this.kind);
  }
}

export interface LlmProvider {
  readonly id: ProviderId;
  send(request: LlmRequest, signal?: AbortSignal): Promise<LlmResponse>;
}

export type Fetch = typeof fetch;

// The kind of error an HTTP status means.
export function kindForStatus(status: number): LlmErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate_limit";
  if (status === 529 || status === 503) return "overloaded";
  if (status >= 500) return "server";
  return "bad_request";
}

// Parses a structured answer. Only a finished answer is expected to be complete JSON.
export function parseJson(response: Omit<LlmResponse, "json">): unknown {
  if (response.stop !== "end") return undefined;
  try {
    return JSON.parse(response.text);
  } catch {
    throw new LlmError("invalid_output", `The answer isn't valid JSON: ${response.text.slice(0, 200)}`);
  }
}
