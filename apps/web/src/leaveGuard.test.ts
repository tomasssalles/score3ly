import { test } from "node:test";
import assert from "node:assert/strict";
import { leavesProject } from "./leaveGuard.ts";

test("leaving a project: a page of the menu, another project or none; not another artifact or stage of the same", () => {
  assert.equal(leavesProject("#/projects/a/artifacts/x", "a"), false);
  assert.equal(leavesProject("#/projects/a/stages/s", "a"), false);
  assert.equal(leavesProject("#/projects/a", "a"), false);
  assert.equal(leavesProject("#/projects/b", "a"), true);
  assert.equal(leavesProject("#/", "a"), true);
  assert.equal(leavesProject("#/settings", "a"), true);
});
