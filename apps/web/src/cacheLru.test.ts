import { test } from "node:test";
import assert from "node:assert/strict";
import { effectiveLimit, formatSize, toEvict } from "./cacheLru.ts";

const MB = 1024 * 1024;

test("the least recently used files go first, until the rest fits", () => {
  const entries = [
    { path: "a", size: 4, used: 30 },
    { path: "b", size: 3, used: 10 },
    { path: "c", size: 2, used: 20 },
    { path: "d", size: 1, used: 40 },
  ];
  assert.deepEqual(toEvict(entries, 10).map((e) => e.path), []);
  assert.deepEqual(toEvict(entries, 6).map((e) => e.path), ["b", "c"]);
  assert.deepEqual(toEvict(entries, 1).map((e) => e.path), ["b", "c", "a"]);
  // The file just used stays, even if it is the oldest.
  assert.deepEqual(toEvict(entries, 6, "b").map((e) => e.path), ["c", "a"]);
});

test("the limit never exceeds 80% of the browser's quota; sizes read in MB or GB", () => {
  assert.equal(effectiveLimit(1000, undefined), 1000 * MB);
  assert.equal(effectiveLimit(1000, 10_000 * MB), 1000 * MB);
  assert.equal(effectiveLimit(1000, 500 * MB), 400 * MB);
  assert.equal(formatSize(120 * MB), "120 MB");
  assert.equal(formatSize(1400 * MB), "1.4 GB");
});
