import { test } from "node:test";
import assert from "node:assert/strict";
import { area, boxProblem, clamp, intersection, MIN_BAR_LINE_GAP, normalizeBarLines, onCrop, onPage, overlaps, roundTo, stretchEdges, type Box } from "./box.ts";

const box = (left: number, right: number, top: number, bottom: number): Box => ({ left, right, top, bottom });

test("a box is four numbers from 0 to 1, the right way round", () => {
  assert.equal(boxProblem(box(0, 1, 0, 1)), null);
  assert.deepEqual(boxProblem(box(0.5, 0.5, 0, 1)), { kind: "order", text: '"left" isn\'t less than "right"' });
  assert.deepEqual(boxProblem(box(0, 1, 0.6, 0.2)), { kind: "order", text: '"top" isn\'t less than "bottom"' });
  assert.deepEqual(boxProblem(box(0, 1.2, 0, 1)), { kind: "values", text: '"right" is outside 0 to 1' });
  assert.deepEqual(boxProblem({ left: 0, right: 1, top: 0 }), { kind: "values", text: '"bottom" isn\'t a number' });
  assert.deepEqual(boxProblem({ left: "0", right: 1, top: 0, bottom: 1 }), { kind: "values", text: '"left" isn\'t a number' });
  assert.deepEqual(boxProblem({ left: NaN, right: 1, top: 0, bottom: 1 }), { kind: "values", text: '"left" isn\'t a number' });
  assert.deepEqual(boxProblem(null), { kind: "values", text: "not an object" });
  assert.deepEqual(boxProblem(0.5), { kind: "values", text: "not an object" });
});

test("clamp and roundTo", () => {
  assert.equal(clamp(-0.2), 0);
  assert.equal(clamp(1.3), 1);
  assert.equal(clamp(0.5, 0.6, 0.9), 0.6);
  assert.equal(roundTo(0.1234567, 5), 0.12346);
  assert.equal(roundTo(0.1234565, 6), 0.123457);
  assert.equal(roundTo(0.98765, 3), 0.988);
});

test("area, intersection and overlaps", () => {
  const a = box(0.1, 0.5, 0.1, 0.5);
  assert.ok(Math.abs(area(a) - 0.16) < 1e-12);
  assert.equal(area(box(0.5, 0.1, 0, 1)), 0);
  assert.deepEqual(intersection(a, box(0.3, 0.9, 0.4, 0.9)), box(0.3, 0.5, 0.4, 0.5));
  assert.equal(area(intersection(a, box(0.6, 0.9, 0.1, 0.5))), 0);
  assert.ok(overlaps(a, box(0.3, 0.9, 0.4, 0.9)));
  assert.ok(!overlaps(a, box(0.5, 0.9, 0.1, 0.5)), "sharing an edge isn't overlapping");
  assert.ok(!overlaps(a, box(0.2, 0.3, 0.6, 0.7)));
});

test("onPage and onCrop are inverses", () => {
  const crops = [box(0.2, 0.6, 0.1, 0.3), box(0.0712, 0.9334, 0.07452, 0.22168), box(0, 1, 0, 1)];
  const boxes = [box(0.5, 1, 0, 0.5), box(0.12345, 0.45678, 0.3, 0.71), box(0, 1, 0, 1)];
  assert.deepEqual(onPage(crops[0], boxes[0]), { left: 0.4, right: 0.6, top: 0.1, bottom: 0.2 });
  for (const crop of crops) {
    for (const b of boxes) {
      const back = onCrop(crop, onPage(crop, b));
      for (const edge of ["left", "right", "top", "bottom"] as const) assert.ok(Math.abs(back[edge] - b[edge]) < 1e-12, `${edge} of ${JSON.stringify(b)}`);
      const there = onPage(crop, onCrop(crop, b));
      for (const edge of ["left", "right", "top", "bottom"] as const) assert.ok(Math.abs(there[edge] - b[edge]) < 1e-12);
    }
  }
});

test("onCrop with clip cuts a box at the crop's edges", () => {
  const crop = box(0.2, 0.6, 0.1, 0.3);
  const over = box(0.1, 0.4, 0.2, 0.5);
  const cut = onCrop(crop, over, { clip: true });
  assert.equal(cut.left, 0);
  assert.equal(cut.bottom, 1);
  assert.ok(Math.abs(cut.right - 0.5) < 1e-12 && Math.abs(cut.top - 0.5) < 1e-12);
  assert.ok(onCrop(crop, over).left < 0 && onCrop(crop, over).bottom > 1, "unclipped, it reaches past the crop");
});

test("a system's stretch edges: its box's sides around its bar lines", () => {
  assert.deepEqual(stretchEdges(box(0.1, 0.9, 0.2, 0.4), [0.3, 0.6]), [0.1, 0.3, 0.6, 0.9]);
  assert.deepEqual(stretchEdges(box(0.1, 0.9, 0.2, 0.4), []), [0.1, 0.9]);
});

test("normalizeBarLines: sorted, inside the box away from its sides, close ones merged", () => {
  const b = box(0.1, 0.9, 0.2, 0.4);
  const at = (barLines: number[]) => normalizeBarLines({ box: b, barLines }).barLines;
  assert.deepEqual(at([0.7, 0.3, 0.5]), [0.3, 0.5, 0.7]);
  assert.deepEqual(at([0.9, 0.5]), [0.5], "a line at the box's end");
  assert.deepEqual(at([0.92, 0.05, 0.5]), [0.5], "lines past the box's ends");
  assert.deepEqual(at([0.1 + MIN_BAR_LINE_GAP / 2, 0.9 - MIN_BAR_LINE_GAP / 2]), [], "lines too close to the sides");
  assert.deepEqual(at([0.5, 0.5]), [0.5], "two at one place");
  const merged = at([0.4, 0.402, 0.6]);
  assert.equal(merged.length, 2);
  assert.ok(Math.abs(merged[0] - 0.401) < 1e-12);
  assert.deepEqual(at([0.4, 0.4 + MIN_BAR_LINE_GAP, 0.6]), [0.4, 0.4 + MIN_BAR_LINE_GAP, 0.6], "lines the gap apart stay");
  const system = { box: b, barLines: [0.3] };
  assert.equal(normalizeBarLines(system).box, b);
});
