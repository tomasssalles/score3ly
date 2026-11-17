import { test } from "node:test";
import assert from "node:assert/strict";
import { amount, roundUsd } from "./money.ts";

test("costs are kept to a millionth of a dollar", () => {
  assert.equal(roundUsd(0.1 + 0.2), 0.3);
  assert.equal(roundUsd(0.0000004), 0);
  assert.equal(roundUsd(0.0000005), 0.000001);
  assert.equal(roundUsd(12.3456789), 12.345679);
});

test("an amount as a field shows it: two decimals where they are enough", () => {
  assert.deepEqual([1, 1.5, 0.25, 0.004, 0.0001, 15, 2.125].map(amount), ["1.00", "1.50", "0.25", "0.004", "0.0001", "15.00", "2.125"]);
});
