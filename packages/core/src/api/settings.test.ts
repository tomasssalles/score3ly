import { test } from "node:test";
import assert from "node:assert/strict";
import { isCapUsd, isVatPercent } from "./settings.ts";

// One rule for the Worker's check and the settings page's fields (the code review's 13 #9).
test("the VAT: a percentage from 0 to 100 with at most two decimals; the cap: an amount above 0", () => {
  for (const ok of [0, 19, 7.5, 12.34, 100]) assert.equal(isVatPercent(ok), true, String(ok));
  for (const no of [-1, 100.01, 12.345, Number.NaN, Infinity, "19", null]) assert.equal(isVatPercent(no), false, String(no));
  for (const ok of [0.01, 1, 1000]) assert.equal(isCapUsd(ok), true, String(ok));
  for (const no of [0, -1, Number.NaN, Infinity, "1", null]) assert.equal(isCapUsd(no), false, String(no));
});
