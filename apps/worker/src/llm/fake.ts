// A provider that answers without any network, for tests and for trying the pipeline without paying (DESIGN.md
// §7.2). Its answer follows the request's JSON schema with the simplest values (empty arrays, zeros, the first
// option), and its "tokens" are counted from the request's size. Some model names make it fail on purpose:
// "fake-error" (a server error), "fake-refusal", "fake-cut-off", "fake-unparseable".

import { LlmError, type LlmProvider, type LlmRequest, type LlmResponse } from "./types.ts";

export class FakeProvider implements LlmProvider {
  readonly id = "fake" as const;

  async send(request: LlmRequest): Promise<LlmResponse> {
    if (request.model === "fake-error") throw new LlmError("server", "The fake provider failed, as asked.", 500);
    if (request.model === "fake-unparseable") throw new LlmError("invalid_output", "The fake answer isn't JSON.");
    const answer = request.jsonSchema ? simplest(request.jsonSchema) : "Fake answer.";
    const text = typeof answer === "string" ? answer : JSON.stringify(answer);
    const size = JSON.stringify(request).length;
    const stop = request.model === "fake-refusal" ? "refusal" : request.model === "fake-cut-off" ? "max_tokens" : "end";
    return {
      provider: "fake",
      model: request.model,
      text,
      json: request.jsonSchema && stop === "end" ? answer : undefined,
      stop,
      usage: { inputTokens: Math.ceil(size / 4), outputTokens: Math.ceil(text.length / 4), cacheReadTokens: 0, cacheWriteTokens: 0 },
      raw: { fake: true },
    };
  }
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
