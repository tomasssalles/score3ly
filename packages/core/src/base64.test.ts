import { test } from "node:test";
import assert from "node:assert/strict";
import { fromBase64, toBase64, toBase64Url } from "./base64.ts";

test("base64 as Node writes it, every byte value, and back", () => {
  const bytes = Uint8Array.from({ length: 256 * 3 + 1 }, (_, i) => i & 0xff);
  assert.equal(toBase64(bytes), Buffer.from(bytes).toString("base64"));
  assert.deepEqual(fromBase64(toBase64(bytes)), bytes);
  assert.equal(toBase64(new TextEncoder().encode("abc")), "YWJj");
  assert.equal(toBase64(new Uint8Array()), "");
});

test("base64 of more bytes than one chunk", () => {
  const bytes = Uint8Array.from({ length: 200_001 }, (_, i) => (i * 31) & 0xff);
  assert.equal(toBase64(bytes), Buffer.from(bytes).toString("base64"));
  assert.deepEqual(fromBase64(Buffer.from(bytes).toString("base64")), bytes);
});

test("base64url without padding, of bytes or of a text", () => {
  const bytes = Uint8Array.from([0xfb, 0xff, 0xbf, 0x01]);
  assert.equal(toBase64Url(bytes), Buffer.from(bytes).toString("base64url"));
  assert.equal(toBase64Url('{"alg":"RS256"}'), Buffer.from('{"alg":"RS256"}').toString("base64url"));
});
