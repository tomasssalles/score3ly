import { test } from "node:test";
import assert from "node:assert/strict";
import { runningTotals, tapTracker, ticks } from "./chart.ts";

test("the y axis has round steps up to at least the highest value", () => {
  assert.deepEqual(ticks(0), [0]);
  assert.deepEqual(ticks(15.2), [0, 5, 10, 15, 20]);
  assert.deepEqual(ticks(89.4), [0, 25, 50, 75, 100]);
  assert.deepEqual(ticks(70.8), [0, 20, 40, 60, 80]);
  assert.deepEqual(ticks(0.3), [0, 0.1, 0.2, 0.3]);
  assert.deepEqual(ticks(299), [0, 100, 200, 300]);
});

test("running totals per row", () => {
  assert.deepEqual(runningTotals([[1, 2, 0, 3], []]), [[1, 3, 3, 6], []]);
});

// Review F10: the press's start was never forgotten, so a release on the plot after a press elsewhere picked a bucket.
test("a tap is a press and a release close together; a release without its press picks nothing", () => {
  const tap = tapTracker();
  tap.down(100);
  assert.equal(tap.up(103), true);
  assert.equal(tap.up(103), false); // the press ended with the first release
  tap.down(100);
  assert.equal(tap.up(150), false); // a drag
  tap.down(100);
  tap.cancel();
  assert.equal(tap.up(100), false);
});
