import { test } from "node:test";
import assert from "node:assert/strict";
import { QUARTER_MS, quarterOf } from "./time.ts";

test("the quarter a time is in starts at :00, :15, :30 or :45", () => {
  const at = (iso: string) => Date.parse(iso);
  assert.equal(quarterOf(at("2026-11-17T10:14:59.999Z")), at("2026-11-17T10:00:00Z"));
  assert.equal(quarterOf(at("2026-11-17T10:15:00Z")), at("2026-11-17T10:15:00Z"));
  assert.equal(quarterOf(at("2026-11-17T23:59:00Z")), at("2026-11-17T23:45:00Z"));
  assert.equal(QUARTER_MS, 900_000);
});
