import { test } from "node:test";
import assert from "node:assert/strict";
import { groupBy } from "./collections.ts";

test("groupBy keeps the items' order, the keys in the order first met, and maps the values", () => {
  const rows = [
    { stage: "b", quarter: 3 },
    { stage: "a", quarter: 1 },
    { stage: "b", quarter: 4 },
  ];
  assert.deepEqual([...groupBy(rows, (r) => r.stage)], [
    ["b", [rows[0], rows[2]]],
    ["a", [rows[1]]],
  ]);
  assert.deepEqual([...groupBy(rows, (r) => r.stage, (r) => r.quarter)], [
    ["b", [3, 4]],
    ["a", [1]],
  ]);
  assert.equal(groupBy([], (r: string) => r).size, 0);
});
