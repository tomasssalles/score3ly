// A time zone that isn't a whole hour from UTC, and has no summer time: days start at 18:15 UTC.
process.env.TZ = "Asia/Kathmandu";

import { test } from "node:test";
import assert from "node:assert/strict";
import { axisLabel, bucketsOf, bucketTitle, defaultGranularity, granularitiesFor, rangeOf } from "./calendar.ts";

const local = (s: string) => new Date(s).getTime(); // "2026-10-27T10:00" is local time

test("ranges are whole calendar days ending today, in the device's time zone", () => {
  const now = local("2026-10-27T10:00");
  assert.deepEqual(rangeOf("7d", now, null), { start: local("2026-10-21T00:00"), end: local("2026-10-28T00:00") });
  assert.equal(rangeOf("30d", now, null).start, local("2026-09-28T00:00"));
  assert.equal(rangeOf("3m", now, null).start, local("2026-07-28T00:00"));
  assert.equal(rangeOf("12m", now, null).start, local("2025-10-28T00:00"));
  assert.equal(rangeOf("all", now, local("2026-06-02T20:15")).start, local("2026-06-02T00:00"));
  assert.equal(rangeOf("all", now, null).start, local("2026-10-27T00:00"));
});

test("a granularity is offered only if the range is longer than it", () => {
  const day = 86_400_000;
  const start = local("2026-10-01T00:00");
  assert.deepEqual(granularitiesFor(start, start + 7 * day), ["day"]);
  assert.deepEqual(granularitiesFor(start, start + 8 * day), ["day", "week"]);
  assert.deepEqual(granularitiesFor(start, start + 31 * day), ["day", "week"]);
  assert.deepEqual(granularitiesFor(start, start + 32 * day), ["day", "week", "month"]);
  assert.equal(defaultGranularity("30d", start, start + 30 * day), "day");
  assert.equal(defaultGranularity("3m", start, start + 92 * day), "week");
  assert.equal(defaultGranularity("all", start, start + 150 * day), "week");
  assert.equal(defaultGranularity("all", start, start + 400 * day), "month");
});

test("weeks run Monday to Sunday and months are calendar months, the first and last cut by the range", () => {
  const range = rangeOf("30d", local("2026-10-27T10:00"), null); // 28 Sep to 27 Oct
  const weeks = bucketsOf(range.start, range.end, "week");
  assert.equal(weeks[0].start, local("2026-09-28T00:00")); // a Monday
  assert.equal(weeks.at(-1)?.start, local("2026-10-26T00:00"));
  assert.equal(bucketTitle(weeks[1], "week"), "5–11 Oct 2026");
  assert.equal(bucketTitle(weeks.at(-1)!, "week"), "26–27 Oct 2026");
  const months = bucketsOf(range.start, range.end, "month");
  assert.deepEqual(months.map((b) => bucketTitle(b, "month")), ["28–30 Sep 2026", "1–27 Oct 2026"]);
  assert.deepEqual(months.map((b, i) => axisLabel(b, "month", i === 0)), ["Sep 2026", "Oct"]);
  const across = bucketsOf(local("2026-09-28T00:00"), local("2026-10-12T00:00"), "week");
  assert.equal(across.length, 2);
  assert.equal(bucketTitle({ ...across[0], from: local("2026-09-30T00:00"), to: local("2026-10-03T00:00") }, "week"), "30 Sep – 2 Oct 2026");
  const days = bucketsOf(range.start, range.end, "day");
  assert.equal(days.length, 30);
  assert.equal(bucketTitle(days[0], "day"), "28 Sep 2026");
});
