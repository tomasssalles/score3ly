import { test } from "node:test";
import assert from "node:assert/strict";
import { filledQuarters, QUARTER_MS } from "./activeTime.ts";

test("active quarters: a single empty quarter between two active ones is filled, a longer gap is a break", () => {
  const q = (n: number) => n * QUARTER_MS;
  assert.deepEqual(filledQuarters([q(0), q(2), q(5), q(5), q(6)]), [q(0), q(1), q(2), q(5), q(6)]);
  assert.deepEqual(filledQuarters([]), []);
});
