import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "./api.ts";
import { discardUnsaved, hasUnsaved, saverOf, settled, StageSaver } from "./saving.ts";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("saves go one after the other, and an item's value is the latest edit", async () => {
  const saver = new StageSaver();
  const log: string[] = [];
  let release!: () => void;
  const first = new Promise<void>((resolve) => (release = resolve));
  saver.save("p1", 1, async () => {
    log.push("p1=1 start");
    await first;
    log.push("p1=1 end");
  });
  await tick();
  saver.save("p2", 2, async () => void log.push("p2=2"));
  saver.save("p1", 3, async () => void log.push("p1=3"));
  saver.save("p1", 4, async () => void log.push("p1=4"));
  assert.equal(saver.value("p1"), 4);
  assert.equal(saver.state.saving, true);
  await tick();
  assert.deepEqual(log, ["p1=1 start"]);
  release();
  assert.equal(await saver.settled(), true);
  // p1's first value was on its way when the next edits came: they wait for it, only the latest is saved, the items in the order first edited.
  assert.deepEqual(log, ["p1=1 start", "p1=1 end", "p1=4", "p2=2"]);
  assert.deepEqual(saver.state, { saving: false, unsaved: false, error: null });
  assert.equal(saver.value("p1"), 4);
});

test("a failed save is kept, marked not saved, and saved with the next edit", async () => {
  const saver = new StageSaver();
  const stored: unknown[] = [];
  let fail = true;
  const store = (value: unknown) => async () => {
    if (fail) throw new ApiError(500, { error: "The disk is full." });
    stored.push(value);
  };
  saver.save("p1", "a", store("a"));
  assert.equal(await saver.settled(), false);
  assert.deepEqual(saver.state, { saving: false, unsaved: true, error: "The disk is full." });
  assert.equal(saver.value("p1"), "a");
  fail = false;
  saver.save("p2", "b", store("b"));
  assert.equal(await saver.settled(), true);
  assert.deepEqual(stored, ["a", "b"]);
  assert.deepEqual(saver.state, { saving: false, unsaved: false, error: null });
});

test("Retry saves what failed", async () => {
  const saver = new StageSaver();
  let fail = true;
  saver.save("", "x", async () => {
    if (fail) throw new Error("offline");
  });
  await saver.settled();
  assert.equal(saver.state.unsaved, true);
  fail = false;
  saver.retry();
  assert.equal(await saver.settled(), true);
  assert.equal(saver.state.unsaved, false);
});

test("a change refused as made elsewhere is not saved, without a text (the dialog says it)", async () => {
  const saver = new StageSaver();
  saver.save("", "x", async () => {
    throw new ApiError(409, { error: "changed", code: "stale_version" });
  });
  await saver.settled();
  assert.deepEqual(saver.state, { saving: false, unsaved: true, error: null });
});

test("settled sends what an editor holds back first", async () => {
  const saver = new StageSaver();
  const stored: string[] = [];
  const remove = saver.holding(() => saver.save("", "typed", async () => void stored.push("typed")));
  assert.equal(await saver.settled(), true);
  assert.deepEqual(stored, ["typed"]);
  remove();
});

test("the stages' savers: Finish waits for its stage's saves; leaving forgets what couldn't be saved", async () => {
  const saver = saverOf("stage-a");
  saver.save("p1", "old", async () => {});
  await settled("stage-a");
  saver.save("p1", "new", async () => {
    throw new Error("offline");
  });
  assert.equal(await settled("stage-a"), false);
  assert.equal(await settled("stage-unknown"), true);
  assert.equal(hasUnsaved(), true);
  discardUnsaved();
  assert.equal(hasUnsaved(), false);
  // What was saved before stays: an editor opened again shows it.
  assert.equal(saver.value("p1"), "old");
  assert.equal(await settled("stage-a"), true);
});
