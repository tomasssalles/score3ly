import { test } from "node:test";
import assert from "node:assert/strict";
import { canRedo, canUndo, pushState, redo, startHistory, undo } from "./history.ts";

test("a new history has nothing to undo or redo", () => {
  const history = startHistory("a");
  assert.equal(canUndo(history), false);
  assert.equal(canRedo(history), false);
  assert.equal(undo(history), history);
  assert.equal(redo(history), history);
});

test("undo goes back through the states, redo forward again", () => {
  let history = pushState(pushState(startHistory("a"), "b"), "c");
  history = undo(history);
  assert.equal(history.present, "b");
  history = undo(history);
  assert.equal(history.present, "a");
  assert.equal(canUndo(history), false);
  history = redo(redo(history));
  assert.equal(history.present, "c");
  assert.equal(canRedo(history), false);
});

test("a new state after an undo drops what could have been redone", () => {
  let history = undo(pushState(pushState(startHistory("a"), "b"), "c"));
  history = pushState(history, "d");
  assert.equal(canRedo(history), false);
  assert.equal(undo(history).present, "b");
});
