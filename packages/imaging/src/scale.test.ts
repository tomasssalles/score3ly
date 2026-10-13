import { test } from "node:test";
import assert from "node:assert/strict";
import { createImage } from "./image.ts";
import { CLAUDE_IMAGE_LIMIT, fittedSize, resizeArea, shrinkToFit } from "./scale.ts";

test("an image is shrunk to Claude's limits, keeping its proportions", () => {
  assert.deepEqual(fittedSize(2000, 2578, CLAUDE_IMAGE_LIMIT), { width: 1705, height: 2198 }); // by pixel count
  assert.deepEqual(fittedSize(5400, 7200, CLAUDE_IMAGE_LIMIT), { width: 1677, height: 2236 });
  assert.deepEqual(fittedSize(4000, 800, CLAUDE_IMAGE_LIMIT), { width: 2576, height: 515 }); // by the long edge
  assert.deepEqual(fittedSize(1200, 1600, CLAUDE_IMAGE_LIMIT), { width: 1200, height: 1600 });
  for (const [w, h] of [[2000, 2578], [5400, 7200], [4000, 800]]) {
    const s = fittedSize(w, h, CLAUDE_IMAGE_LIMIT);
    assert.ok(s.width * s.height <= CLAUDE_IMAGE_LIMIT.maxPixels && Math.max(s.width, s.height) <= CLAUDE_IMAGE_LIMIT.maxLongEdge);
  }
});

test("area averaging: a thin line becomes gray, not lost; an image that fits is left as it is", () => {
  const image = createImage(9, 9, [255, 255, 255]);
  for (let x = 0; x < 9; x++) image.data.set([0, 0, 0], (4 * 9 + x) * 4); // a 1-pixel black row in the middle
  const small = resizeArea(image, 3, 3);
  assert.deepEqual([...small.data.subarray(12, 15)], [170, 170, 170]); // the middle row: one third black
  assert.deepEqual([...small.data.subarray(0, 3)], [255, 255, 255]);
  const fits = createImage(10, 10);
  assert.equal(shrinkToFit(fits, CLAUDE_IMAGE_LIMIT), fits);
});
