import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalJson, keyOf } from "./keys.ts";

test("canonical JSON sorts keys at every level and drops undefined", () => {
  assert.equal(canonicalJson({ b: 1, a: [{ d: 2, c: "x" }], e: undefined }), '{"a":[{"c":"x","d":2}],"b":1}');
});

test("the same content gives the same key, whatever the order of its keys", async () => {
  assert.equal(await keyOf({ a: 1, b: 2 }), await keyOf({ b: 2, a: 1 }));
  assert.notEqual(await keyOf({ a: 1 }), await keyOf({ a: 2 }));
  assert.match(await keyOf({}), /^[0-9a-f]{64}$/);
});
