import { test } from "node:test";
import assert from "node:assert/strict";
import { ago, shortDate } from "./time.ts";

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

// Midday UTC, so the local day is the same in (almost) every time zone.
test("shortDate writes the day and the month's name, without the current year", () => {
  assert.equal(shortDate("2026-10-07T12:00:00.000Z", now), "7 Oct");
  assert.equal(shortDate("2026-01-31T12:00:00.000Z", now), "31 Jan");
});

test("shortDate adds the year when it isn't the current one", () => {
  assert.equal(shortDate("2025-10-07T12:00:00.000Z", now), "7 Oct 2025");
  assert.equal(shortDate("2027-03-01T12:00:00.000Z", now), "1 Mar 2027");
});
