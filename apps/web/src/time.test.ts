import { test } from "node:test";
import assert from "node:assert/strict";
import { ago } from "./time.ts";

const now = Date.parse("2026-10-07T12:00:00.000Z");
const before = (ms: number) => new Date(now - ms).toISOString();

test("ago counts minutes, hours and days without a space before the unit", () => {
  assert.equal(ago(before(20_000), now), "just now");
  assert.equal(ago(before(20 * 60_000), now), "20min ago");
  assert.equal(ago(before(5 * 3600_000), now), "5h ago");
  assert.equal(ago(before(2 * 86400_000), now), "2d ago");
});

test("ago treats times in the future as now", () => {
  assert.equal(ago(new Date(now + 60_000).toISOString(), now), "just now");
});
