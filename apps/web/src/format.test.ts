import { test } from "node:test";
import assert from "node:assert/strict";
import { ago, count, deletedNote, duration, endedNote, fixNote, formatSize, fullDate, percent, shortDate, statDuration, when } from "./format.ts";

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

test("when is how long ago for less than a week, then a date", () => {
  assert.equal(when(before(5 * 3600_000), now), "5h ago");
  assert.equal(when(before(6 * 86400_000), now), "6d ago");
  assert.equal(when("2026-09-30T12:00:00.000Z", now), "30 Sep");
  assert.equal(when("2025-10-01T12:00:00.000Z", now), "1 Oct 2025");
  assert.equal(when(new Date(now + 60_000).toISOString(), now), "just now");
});

test("duration is compact", () => {
  assert.equal(duration(8), "8s");
  assert.equal(duration(192), "3min 12s");
  assert.equal(duration(3900), "1h 5min");
});

test("duration is rounded to the second before it is split", () => {
  assert.equal(duration(59.6), "1min 0s");
  assert.equal(duration(3599.6), "1h 0min");
});

// Review F4: the statistics' durations read "60 s", "1 min 60 s", "59 min 60 s", "10.0 s" at these values.
test("statDuration: short, each form chosen after rounding to its precision", () => {
  assert.deepEqual(
    [0, 3, 30, 400, 12_000, 100_000, 120_000, 19_200_000, 3 * 86_400_000 + 4 * 3_600_000].map(statDuration),
    ["0 s", "0.01 s", "0.03 s", "0.4 s", "12 s", "1 min 40 s", "2 min", "5 h 20 min", "3 d 4 h"],
  );
  assert.deepEqual([99.6, 9_960, 59_600, 119_600, 3_599_600, 86_399_000].map(statDuration), ["0.1 s", "10 s", "1 min", "2 min", "1 h", "1 d"]);
});

test("count writes the singular for 1 only", () => {
  assert.equal(count(1, "page"), "1 page");
  assert.equal(count(0, "page"), "0 pages");
  assert.equal(count(3, "staff", "staves"), "3 staves");
});

test("percent is a whole percentage, and a dash without a whole", () => {
  assert.equal(percent(1, 3), "33%");
  assert.equal(percent(1, 4), "25%");
  assert.equal(percent(0, 0), "–");
});

const MB = 1024 * 1024;
test("sizes read in MB or GB, never 1000 MB", () => {
  assert.equal(formatSize(120 * MB), "120 MB");
  assert.equal(formatSize(1400 * MB), "1.4 GB");
  assert.equal(formatSize(999.6 * MB), "1.0 GB");
});

test("a full date has its year; deleted and ended marks use it", () => {
  assert.equal(fullDate("2026-10-07T12:00:00.000Z"), "7 Oct 2026");
  assert.equal(deletedNote("2026-09-12T12:00:00.000Z"), "(deleted 12 Sep 2026)");
  assert.equal(endedNote("2026-09-15T12:00:00.000Z"), "(until 15 Sep 2026)");
  assert.equal(deletedNote(null), undefined);
});

test("a page fix's note counts the pages that changed (fix_skew, fix_layout)", () => {
  assert.equal(fixNote("lines", 0, 10), "no changes");
  assert.equal(fixNote("lines", 2, 10), "lines changed on 2 of 10 pages");
  assert.equal(fixNote("lines", 1, 1), "lines changed");
  assert.equal(fixNote("layout", 2, 10), "layout changed on 2 of 10 pages");
  assert.equal(fixNote("layout", 0, 1), "no changes");
});
