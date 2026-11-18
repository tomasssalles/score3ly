import { test } from "node:test";
import assert from "node:assert/strict";
import { schemaProblem, schemaProblems, type JsonSchema } from "./jsonSchema.ts";

const answer: JsonSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["clef", "key"] },
    text: { type: "string" },
    count: { type: "integer" },
    ok: { type: "boolean" },
    place: { anyOf: [{ type: "object", properties: { system: { type: "integer" } }, required: ["system"], additionalProperties: false }, { type: "null" }] },
    items: { type: "array", items: { type: "number" } },
  },
  required: ["kind", "text", "count", "ok", "place", "items"],
  additionalProperties: false,
};
const good = { kind: "clef", text: "bass clef", count: 2, ok: true, place: null, items: [0.5, 1] };

test("an answer of the schema's shape has no problem", () => {
  assert.deepEqual(schemaProblems(answer, good), []);
  assert.deepEqual(schemaProblems(answer, { ...good, place: { system: 3 } }), []);
});

test("an answer's problems, each with its path, in the messages the user may read", () => {
  assert.equal(schemaProblem(answer, { ...good, kind: "tempo" }), "kind isn't one of clef, key");
  assert.equal(schemaProblem(answer, { ...good, text: 3 }), "text isn't text");
  assert.equal(schemaProblem(answer, { ...good, count: 1.5 }), "count isn't a whole number");
  assert.equal(schemaProblem(answer, { ...good, ok: "yes" }), "ok isn't true or false");
  assert.equal(schemaProblem(answer, { ...good, items: [1, "2"] }), "items[1] isn't a number");
  assert.equal(schemaProblem(answer, [good]), " isn't an object");
  // A missing required field has its type's message; anyOf gives the first option's problem when none fits.
  const { text: _, ...withoutText } = good;
  assert.equal(schemaProblem(answer, withoutText), "text isn't text");
  assert.equal(schemaProblem(answer, { ...good, place: { system: "3" } }), "place.system isn't a whole number");
  assert.equal(schemaProblem(answer, { ...good, place: 3 }), "place isn't an object");
  // additionalProperties: false.
  assert.equal(schemaProblem(answer, { ...good, extra: 1 }), " has an unexpected extra");
  assert.equal(schemaProblem(answer, { ...good, place: { system: 3, at: "end" } }), "place has an unexpected at");
});

test("files: type lists, optional properties, patterns and limits", () => {
  const file: JsonSchema = {
    type: "object",
    properties: {
      id: { type: "string", pattern: "^[a-z]+$", minLength: 2 },
      price: { type: "number", minimum: 0 },
      routings: { type: ["array", "null"], items: { type: "string" } },
      note: { type: "string" },
    },
    required: ["id", "price", "routings", "source"],
  };
  assert.deepEqual(schemaProblems(file, { id: "ab", price: 0, routings: null, source: 1 }), []);
  assert.deepEqual(schemaProblems(file, { id: "A", price: -1, routings: "x", note: 2 }, "$"), [
    "$.id is shorter than 2",
    "$.id doesn't match ^[a-z]+$",
    "$.price is below 0",
    "$.routings isn't a list or null",
    "$.note isn't text",
    "$ has no source",
  ]);
});
