import { test } from "node:test";
import assert from "node:assert/strict";
import { noteAnswer, noteImage, timed } from "./itemTiming.ts";

test("an item is timed, and the answers and images it looked up are counted, with those found in the caches", async () => {
  noteAnswer(false); // outside any item: not counted
  const { value, timing } = await timed(async () => {
    noteImage(true);
    noteImage(false);
    noteAnswer(true);
    noteAnswer(false);
    await new Promise((resolve) => setTimeout(resolve, 20));
    return "done";
  });
  assert.equal(value, "done");
  assert.deepEqual({ ...timing, durationMs: 0 }, { durationMs: 0, calls: 2, callsCached: 1, images: 2, imagesCached: 1 });
  assert.ok(timing.durationMs >= 15);
  // A failed item leaves nothing behind for the next.
  await assert.rejects(timed(async () => { noteImage(false); throw new Error("no"); }));
  const next = await timed(async () => "ok");
  assert.deepEqual({ ...next.timing, durationMs: 0 }, { durationMs: 0, calls: 0, callsCached: 0, images: 0, imagesCached: 0 });
});
