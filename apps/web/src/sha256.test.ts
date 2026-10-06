import { test } from "node:test";
import assert from "node:assert/strict";
import { sha256Hex } from "./sha256.ts";

// Expected values are the standard SHA-256 test vectors (FIPS 180-4).
test("sha256Hex hashes the empty input", async () => {
  assert.equal(
    await sha256Hex(new Uint8Array()),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
});

test("sha256Hex hashes 'abc'", async () => {
  assert.equal(
    await sha256Hex(new TextEncoder().encode("abc")),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("sha256Hex accepts an ArrayBuffer, as read from a File", async () => {
  const buffer = new TextEncoder().encode("abc").buffer;
  assert.equal(await sha256Hex(buffer), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
