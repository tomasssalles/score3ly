import { test } from "node:test";
import assert from "node:assert/strict";
import { fixSkewNote, lineThrough } from "./fixSkew.ts";

test("a drawn line is stored from left to right, in fractions of the page, with its angle", () => {
  const line = lineThrough({ x: 900, y: 210 }, { x: 100, y: 200 }, 1000, 2000);
  assert.deepEqual(line, { x0: 0.1, y0: 0.1, x1: 0.9, y1: 0.105, angle: 0.716 });
  // Rising to the right: a negative angle.
  assert.ok(lineThrough({ x: 0, y: 100 }, { x: 100, y: 0 }, 1000, 1000)!.angle === -45);
});

test("a vertical line, or a steeper one than 89.9°, isn't taken", () => {
  assert.equal(lineThrough({ x: 5, y: 0 }, { x: 5, y: 100 }, 1000, 1000), null);
  assert.equal(lineThrough({ x: 5, y: 0 }, { x: 5.1, y: 100 }, 1000, 1000), null);
  assert.notEqual(lineThrough({ x: 5, y: 0 }, { x: 5.2, y: 100 }, 1000, 1000), null);
});

test("ends outside the page are kept on its edge", () => {
  const line = lineThrough({ x: -10, y: 50 }, { x: 1010, y: 60 }, 1000, 1000)!;
  assert.equal(line.x0, 0);
  assert.equal(line.x1, 1);
});

test("the note counts the pages whose lines changed", () => {
  assert.equal(fixSkewNote(0, 10), "no changes");
  assert.equal(fixSkewNote(2, 10), "lines changed on 2 of 10 pages");
  assert.equal(fixSkewNote(1, 1), "lines changed");
});
