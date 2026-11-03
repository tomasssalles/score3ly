import { test } from "node:test";
import assert from "node:assert/strict";
import { leaveQuestion } from "./leaving.ts";

test("the question when the page holds back from being left: closing or reloading, the action first", () => {
  assert.deepEqual(leaveQuestion(true).buttons, ["Close", "Cancel"]);
  assert.equal(leaveQuestion(true).message, "Close while a stage is running?");
  assert.deepEqual(leaveQuestion(false).buttons, ["Reload", "Cancel"]);
  assert.match(leaveQuestion(false).detail, /^Reloading stops the run\./);
});
