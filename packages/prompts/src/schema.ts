// The builders of the LLM stages' JSON schemas (docs/llm.md, "Structured output"), one set for every stage. What they
// emit is part of every request, key order included: a change here changes every request key (and is paid again), so
// the request snapshots (apps/web/src/requestSnapshots.test.ts) pin it.

import type { JsonSchema } from "@score3ly/core";

export const str: JsonSchema = { type: "string" };
export const int: JsonSchema = { type: "integer" };
export const num: JsonSchema = { type: "number" };
export const bool: JsonSchema = { type: "boolean" };
export const enumOf = (values: readonly string[]): JsonSchema => ({ type: "string", enum: [...values] });
export const list = (items: JsonSchema): JsonSchema => ({ type: "array", items });
// Every property required: Anthropic's constrained output allows few optional ones (docs/llm.md, "Claude's limit on
// schemas"), and a field with no value is "" or -1 instead.
export const object = (properties: Record<string, JsonSchema>): JsonSchema => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
// Only where a value can be null: each anyOf counts towards Anthropic's limit.
export const nullable = (schema: JsonSchema): JsonSchema => ({ anyOf: [schema, { type: "null" }] });

// A schema with its description, which the model reads beside the field: short, in the prompt's words, so that it
// points back to the prompt's longer explanations rather than repeating them.
export const described = (schema: JsonSchema, description: string): JsonSchema => ({ ...schema, description });
