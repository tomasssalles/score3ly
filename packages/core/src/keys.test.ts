import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalJson, isSha256Hex, keyOf, modelKeyOf, normalized, sha256Hex } from "./keys.ts";

// Expected values are the standard SHA-256 test vectors (FIPS 180-4).
test("sha256Hex hashes the empty input", async () => {
  assert.equal(await sha256Hex(new Uint8Array()), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
});

test("sha256Hex hashes 'abc'", async () => {
  assert.equal(await sha256Hex(new TextEncoder().encode("abc")), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("sha256Hex accepts an ArrayBuffer, as read from a File", async () => {
  const buffer = new TextEncoder().encode("abc").buffer;
  assert.equal(await sha256Hex(buffer), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("canonical JSON sorts keys at every level and drops undefined", () => {
  assert.equal(canonicalJson({ b: 1, a: [{ d: 2, c: "x" }], e: undefined }), '{"a":[{"c":"x","d":2}],"b":1}');
});

test("canonical JSON is JSON: undefined and functions in an array are null, in an object left out", () => {
  const value = { list: [1, undefined, () => 2, 3], f: () => 1, s: Symbol("s") };
  assert.equal(canonicalJson(value), '{"list":[1,null,null,3]}');
  assert.equal(canonicalJson(value), JSON.stringify({ list: [1, null, null, 3] }));
  assert.deepEqual(normalized(value), { list: [1, null, null, 3] });
});

test("canonical JSON of a value JSON can't write is refused, not written as undefined", () => {
  assert.throws(() => canonicalJson(undefined), TypeError);
  assert.throws(() => canonicalJson(() => 1), TypeError);
});

test("the same content gives the same key, whatever the order of its keys", async () => {
  assert.equal(await keyOf({ a: 1, b: 2 }), await keyOf({ b: 2, a: 1 }));
  assert.notEqual(await keyOf({ a: 1 }), await keyOf({ a: 2 }));
  assert.ok(isSha256Hex(await keyOf({})));
});

test("normalized is the value as stored: keys sorted, undefined left out", () => {
  const value = normalized({ b: { d: 1, c: undefined }, a: 2 });
  assert.deepEqual(value, { a: 2, b: { d: 1 } });
  assert.deepEqual(Object.keys(value), ["a", "b"]);
});

test("isSha256Hex: 64 lowercase hex digits, nothing else", () => {
  assert.ok(isSha256Hex("0123456789abcdef".repeat(4)));
  assert.ok(!isSha256Hex("0123456789ABCDEF".repeat(4)));
  assert.ok(!isSha256Hex("ab".repeat(31)));
  assert.ok(!isSha256Hex("ab".repeat(33)));
  assert.ok(!isSha256Hex(`${"ab".repeat(32)}\n`));
  assert.ok(!isSha256Hex(null));
  assert.ok(!isSha256Hex(42));
});

test("the model part of keys is the provider, the model and the effort, nothing else", () => {
  const config = { id: "c1", name: "Opus EU", provider: "bedrock", model: "eu.anthropic.claude-opus-5-5", effort: "high", region: "eu-central-1" };
  assert.deepEqual(modelKeyOf(config), { provider: "bedrock", model: "eu.anthropic.claude-opus-5-5", effort: "high" });
  assert.deepEqual(modelKeyOf({ provider: "vertex", model: "gemini-3.1-pro", effort: null }), { provider: "vertex", model: "gemini-3.1-pro", effort: null });
});
