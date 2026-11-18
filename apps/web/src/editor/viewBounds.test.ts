import { test } from "node:test";
import assert from "node:assert/strict";
import { clampView, PAD, wholePageScale } from "./viewBounds.ts";

const view = { clientWidth: 400, clientHeight: 800 };
const page = { width: 1000, height: 1400 };

test("the whole page fits with room around it", () => {
  assert.equal(wholePageScale(view, page), Math.min((400 - 2 * PAD) / 1000, (800 - 2 * PAD) / 1400));
});

test("a page larger than the view can't be panned more than PAD past its edges", () => {
  const scale = 1; // 1000 x 1400 on screen
  assert.deepEqual(clampView({ scale, x: 300, y: 500 }, view, page), { scale, x: PAD, y: PAD });
  assert.deepEqual(clampView({ scale, x: -5000, y: -5000 }, view, page), { scale, x: 400 - 1000 - PAD, y: 800 - 1400 - PAD });
  assert.deepEqual(clampView({ scale, x: -100, y: -200 }, view, page), { scale, x: -100, y: -200 });
});

test("in a direction where the page is smaller than the view, it is centred", () => {
  const scale = 0.3; // 300 x 420 on screen: narrower and shorter than the view
  assert.deepEqual(clampView({ scale, x: 0, y: 0 }, view, page), { scale, x: 50, y: 190 });
  // Fitted to the width of a wide, low view, taller than it: the width just fits, the height pans within bounds.
  const low = { clientWidth: 400, clientHeight: 400 };
  const w = (400 - 2 * PAD) / 1000;
  const v = clampView({ scale: w, x: 77, y: -100 }, low, page);
  assert.ok(Math.abs(v.x - PAD) < 1e-9);
  assert.equal(v.y, -100);
});

test("without a size, the view is left as it is", () => {
  assert.deepEqual(clampView({ scale: 2, x: 3, y: 4 }, null, page), { scale: 2, x: 3, y: 4 });
  assert.deepEqual(clampView({ scale: 2, x: 3, y: 4 }, { clientWidth: 0, clientHeight: 0 }, page), { scale: 2, x: 3, y: 4 });
});
