import { test } from "node:test";
import assert from "node:assert/strict";
import { onPage } from "@score3ly/core";
import { boxThrough, MIN_BOX, resizeBox } from "./boxEdit.ts";

const box = (left: number, top: number, right: number, bottom: number) => ({ left, right, top, bottom });

test("a box drawn by two opposite corners, in any order; too small or off the page", () => {
  assert.deepEqual(boxThrough({ x: 0.9, y: 0.3 }, { x: 0.1, y: 0.1 }), box(0.1, 0.1, 0.9, 0.3));
  assert.equal(boxThrough({ x: 0.1, y: 0.1 }, { x: 0.105, y: 0.5 }), null);
  assert.deepEqual(boxThrough({ x: -0.2, y: 0.1 }, { x: 1.3, y: 0.3 }), box(0, 0.1, 1, 0.3));
});

test("a handle moves its edges, which can't pass the opposite ones", () => {
  const b = box(0.1, 0.1, 0.9, 0.3);
  assert.deepEqual(resizeBox(b, { x: "left", y: "top" }, { x: 0.2, y: 0.05 }), box(0.2, 0.05, 0.9, 0.3));
  assert.deepEqual(resizeBox(b, { x: null, y: "bottom" }, { x: 0.5, y: 0.4 }), box(0.1, 0.1, 0.9, 0.4));
  assert.deepEqual(resizeBox(b, { x: "right", y: null }, { x: 0.0, y: 0.2 }), box(0.1, 0.1, 0.11, 0.3));
});

test("each coordinate space: fix_layout's page fractions, and a clarification drawn on a crop, resized on the page", () => {
  // fix_layout: the box and the point are fractions of the straightened page, kept on it.
  assert.deepEqual(resizeBox(box(0.1, 0.1, 0.9, 0.3), { x: "right", y: "bottom" }, { x: 1.2, y: 0.35 }), box(0.1, 0.1, 1, 0.35));
  // A human review: drawn on a crop (its fractions), too small at 1% of the crop, then placed on the page.
  const crop = box(0.05, 0.2, 0.95, 0.4); // the crop on the page
  assert.equal(boxThrough({ x: 0.1, y: 0.1 }, { x: 0.1 + MIN_BOX / 2, y: 0.5 }), null);
  const drawn = boxThrough({ x: 0.5, y: 0.25 }, { x: 0.25, y: 0.75 })!;
  assert.deepEqual(drawn, box(0.25, 0.25, 0.5, 0.75));
  const onThePage = onPage(crop, drawn);
  const expected = box(0.275, 0.25, 0.5, 0.35); // not rounded: placed after rounding on the crop
  for (const side of ["left", "right", "top", "bottom"] as const) assert.ok(Math.abs(onThePage[side] - expected[side]) < 1e-12, side);
  // Resized in the page's fractions, with a point past the crop: kept on the page, not on the crop.
  const resized = resizeBox(onThePage, { x: null, y: "top" }, { x: 0.3, y: 0.1 });
  assert.equal(resized.top, 0.1);
  assert.ok(resized.top < crop.top);
  // The edge stops MIN_BOX (of the page) short of the opposite one.
  assert.equal(resizeBox(onThePage, { x: "left", y: null }, { x: 0.9, y: 0 }).left, Number((onThePage.right - MIN_BOX).toFixed(5)));
});
