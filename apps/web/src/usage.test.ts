// A time zone that isn't a whole hour from UTC: its hours start at :15 UTC.
process.env.TZ = "Asia/Kathmandu";

import { test } from "node:test";
import assert from "node:assert/strict";
import type { ActivityData } from "./api";
import { bucketsOf } from "./costs.ts";
import { activeHours, hoursView } from "./usage.ts";

const local = (s: string) => new Date(s).getTime(); // "2026-10-27T10:00" is local time

const data: ActivityData = {
  quarters: [
    ["p1", local("2026-10-20T10:00")],
    ["p1", local("2026-10-20T10:45")], // the same local hour
    ["p2", local("2026-10-20T10:30")], // the same hour, another project
    ["p2", local("2026-10-20T23:45")],
    ["p1", local("2026-10-22T08:15")],
  ],
  projects: [],
};

test("active hours: an hour counts once, whichever project and quarter made it active", () => {
  assert.deepEqual(activeHours(data, null), [local("2026-10-20T10:00"), local("2026-10-20T23:00"), local("2026-10-22T08:00")]);
  assert.deepEqual(activeHours(data, "p2"), [local("2026-10-20T10:00"), local("2026-10-20T23:00")]);
});

test("active hours per day, in the range, and the days they fall on", () => {
  const range = { start: local("2026-10-20T00:00"), end: local("2026-10-23T00:00") };
  const view = hoursView(activeHours(data, null), bucketsOf(range.start, range.end, "day"), range);
  assert.deepEqual(view, { values: [2, 0, 1], total: 3, days: 2 });
});
