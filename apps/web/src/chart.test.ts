import { test } from "node:test";
import assert from "node:assert/strict";
import { ticks } from "./chart.ts";

test("the y axis has round steps up to at least the highest value", () => {
  assert.deepEqual(ticks(0), [0]);
  assert.deepEqual(ticks(15.2), [0, 5, 10, 15, 20]);
  assert.deepEqual(ticks(89.4), [0, 25, 50, 75, 100]);
  assert.deepEqual(ticks(70.8), [0, 20, 40, 60, 80]);
  assert.deepEqual(ticks(0.3), [0, 0.1, 0.2, 0.3]);
  assert.deepEqual(ticks(299), [0, 100, 200, 300]);
});
