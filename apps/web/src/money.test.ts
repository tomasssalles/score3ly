import { test } from "node:test";
import assert from "node:assert/strict";
import { amount, dollars } from "./money.ts";

test("dollars have two decimals, and a paid amount below one cent isn't shown as free", () => {
  assert.equal(dollars(0.12), "$0.12");
  assert.equal(dollars(3.4), "$3.40");
  assert.equal(dollars(0.003), "<$0.01");
  assert.equal(dollars(0), "$0.00");
});

test("an amount in a field: two decimals where they are enough, else as many as it has", () => {
  assert.deepEqual([1.5, 15, 0.004, 2.125].map(amount), ["1.50", "15.00", "0.004", "2.125"]);
});
