import assert from "node:assert/strict";
import { test } from "node:test";
import { toggled } from "./checks.ts";

test("selecting takes items back in, unselecting takes them out; the order of what stays is kept", () => {
  const out = ["b", "a"];
  assert.deepEqual([...toggled(out, ["c", "d"], false)], ["b", "a", "c", "d"]);
  assert.deepEqual([...toggled(out, ["b"], true)], ["a"]);
  assert.deepEqual([...toggled(out, ["a", "x"], true)], ["b"]);
  assert.deepEqual(out, ["b", "a"]);
  const set = new Set(["p"]);
  assert.notEqual(toggled(set, [], true), set);
});
