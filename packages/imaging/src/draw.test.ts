import { test } from "node:test";
import assert from "node:assert/strict";
import { createImage } from "./image.ts";
import { drawLayout, LAYOUT_COLORS } from "./draw.ts";

test("boxes cycle through the 7 colours, and bar lines take their box's colour", () => {
  const image = createImage(1000, 1000, [255, 255, 255]);
  const systems = Array.from({ length: 8 }, (_, i) => ({
    box: { left: 0.1, right: 0.9, top: 0.02 + i * 0.12, bottom: 0.12 + i * 0.12 },
    barLines: [0.5],
  }));
  const drawn = drawLayout(image, systems);
  const at = (x: number, y: number) => [...drawn.data.subarray((y * 1000 + x) * 4, (y * 1000 + x) * 4 + 3)];
  // The right edge of each box, and its bar line.
  systems.forEach((s, i) => {
    const y = Math.round(((s.box.top + s.box.bottom) / 2) * 1000);
    assert.deepEqual(at(899, y), LAYOUT_COLORS[i % 7], `box ${i + 1}`);
    assert.deepEqual(at(500, Math.round(s.box.top * 1000) + 3), LAYOUT_COLORS[i % 7], `bar line ${i + 1}`);
  });
  assert.deepEqual(at(5, 5), [255, 255, 255]);
  // The input isn't changed.
  assert.deepEqual([...image.data.subarray(0, 3)], [255, 255, 255]);
  assert.deepEqual([...image.data.subarray((500 * 1000 + 899) * 4, (500 * 1000 + 899) * 4 + 3)], [255, 255, 255]);
});
