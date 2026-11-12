import { test } from "node:test";
import assert from "node:assert/strict";
import { CORNER, EDGE, EDGE_SHARE, handleAt, handleRect } from "./handles.ts";

const size = { width: 1000, height: 1000 };
const box = { left: 0.1, right: 0.5, top: 0.2, bottom: 0.4 }; // 400 x 200 px at scale 1

test("corners are squares; an edge's handle is a bar over most of its edge", () => {
  assert.deepEqual(handleRect(box, { x: "left", y: "top" }, size, 1), { x: 100 - CORNER / 2, y: 200 - CORNER / 2, width: CORNER, height: CORNER });
  const top = handleRect(box, { x: null, y: "top" }, size, 1);
  assert.equal(top.width, 400 * EDGE_SHARE);
  assert.equal(top.height, EDGE);
  assert.equal(top.x + top.width / 2, 300);
  const right = handleRect(box, { x: "right", y: null }, size, 1);
  assert.equal(right.height, 200 * EDGE_SHARE);
  assert.equal(right.width, EDGE);
  assert.ok(EDGE_SHARE > 0.5);
});

test("handles keep their size on screen at any zoom, and a tiny box's edge handles stay visible", () => {
  assert.equal(handleRect(box, { x: "left", y: "top" }, size, 4).width, CORNER / 4);
  const tiny = { left: 0.1, right: 0.101, top: 0.2, bottom: 0.201 };
  assert.equal(handleRect(tiny, { x: null, y: "top" }, size, 1).width, CORNER);
});

test("a pointer anywhere along an edge's handle grabs it; corners win where they are near", () => {
  // Along the top edge, a quarter of the way: inside the handle (which covers the middle 60%).
  assert.deepEqual(handleAt(box, { x: 220, y: 203 }, size, 1), { x: null, y: "top" });
  // Near the top-left corner.
  assert.deepEqual(handleAt(box, { x: 104, y: 198 }, size, 1), { x: "left", y: "top" });
  // In the middle of the box: nothing.
  assert.equal(handleAt(box, { x: 300, y: 300 }, size, 1), null);
  // Zoomed out (scale 0.25), 30 image px from the left edge is under 10 screen px: grabbed.
  assert.deepEqual(handleAt(box, { x: 130, y: 300 }, size, 0.25), { x: "left", y: null });
});
