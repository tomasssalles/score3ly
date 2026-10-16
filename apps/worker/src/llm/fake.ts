// A provider that answers without any network, for tests and for trying the pipeline without paying (DESIGN.md
// §7.2). Its answer follows the request's JSON schema with the simplest values (empty arrays, zeros, the first
// option), and its "tokens" are estimated from the request's text and images. Some model names make it fail on purpose:
// "fake-error" (a server error), "fake-refusal", "fake-cut-off", "fake-unparseable".

import { LlmError, type LlmProvider, type LlmRequest, type LlmResponse } from "./types.ts";

export class FakeProvider implements LlmProvider {
  readonly id = "fake" as const;

  async send(request: LlmRequest): Promise<LlmResponse> {
    if (request.model === "fake-error") throw new LlmError("server", "The fake provider failed, as asked.", 500);
    if (request.model === "fake-unparseable") throw new LlmError("invalid_output", "The fake answer isn't JSON.");
    const answer = request.jsonSchema ? simplest(request.jsonSchema) : "Fake answer.";
    const text = typeof answer === "string" ? answer : JSON.stringify(answer);
    const stop = request.model === "fake-refusal" ? "refusal" : request.model === "fake-cut-off" ? "max_tokens" : "end";
    return {
      provider: "fake",
      model: request.model,
      text,
      json: request.jsonSchema && stop === "end" ? answer : undefined,
      stop,
      usage: { inputTokens: inputTokens(request), outputTokens: Math.ceil(text.length / 4), cacheReadTokens: 0, cacheWriteTokens: 0 },
      raw: { fake: true },
    };
  }
}

// About what Claude would bill: a token per 4 characters of text, and each image at Claude's most per image (4784
// tokens), not by the length of its base64, which would make a page cost a hundred times too much.
const IMAGE_TOKENS = 4784;

function inputTokens(request: LlmRequest): number {
  let chars = (request.system ?? "").length + JSON.stringify(request.jsonSchema ?? null).length;
  let images = 0;
  for (const message of request.messages) {
    for (const content of message.content) {
      if (content.type === "image") images++;
      else chars += content.text.length;
    }
  }
  return Math.ceil(chars / 4) + images * IMAGE_TOKENS;
}

// The simplest value a JSON schema allows.
function simplest(schema: Record<string, unknown>): unknown {
  if (Array.isArray(schema.enum)) return schema.enum[0];
  if ("const" in schema) return schema.const;
  const anyOf = (schema.anyOf ?? schema.oneOf) as Record<string, unknown>[] | undefined;
  if (anyOf?.length) return simplest(anyOf[0]);
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  switch (type) {
    case "object": {
      const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
      const required = (schema.required ?? Object.keys(properties)) as string[];
      return Object.fromEntries(required.map((key) => [key, simplest(properties[key] ?? {})]));
    }
    case "array":
      return [];
    case "string":
      return "";
    case "number":
    case "integer":
      return typeof schema.minimum === "number" ? schema.minimum : 0;
    case "boolean":
      return false;
    default:
      return null;
  }
}
