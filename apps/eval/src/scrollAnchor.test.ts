import { test } from "node:test";
import assert from "node:assert/strict";
import { anchorAt, scrollTopFor } from "./scrollAnchor.ts";

// Three pages of height 100 with gaps of 10.
const small = [
  { top: 0, height: 100 },
  { top: 110, height: 100 },
  { top: 220, height: 100 },
];
// The same pages drawn twice as large, gaps unchanged.
const large = [
  { top: 0, height: 200 },
  { top: 210, height: 200 },
  { top: 420, height: 200 },
];

test("anchorAt finds the page and the position within it", () => {
  assert.deepEqual(anchorAt(small, 0), { page: 0, fraction: 0 });
  assert.deepEqual(anchorAt(small, 135), { page: 1, fraction: 0.25 });
  assert.deepEqual(anchorAt(small, 320), { page: 2, fraction: 1 });
});

test("anchorAt counts a gap towards the page above", () => {
  assert.deepEqual(anchorAt(small, 105), { page: 0, fraction: 1 });
});

test("the same spot stays at the top after resizing", () => {
  assert.equal(scrollTopFor(large, anchorAt(small, 135)), 260);
});

test("no pages yields the top", () => {
  assert.deepEqual(anchorAt([], 50), { page: 0, fraction: 0 });
  assert.equal(scrollTopFor([], { page: 0, fraction: 0.5 }), 0);
});
