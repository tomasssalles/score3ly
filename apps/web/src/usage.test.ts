// A time zone that isn't a whole hour from UTC: its hours start at :15 UTC.
process.env.TZ = "Asia/Kathmandu";

import { test } from "node:test";
import assert from "node:assert/strict";
import type { ActivityData, TranscribedData } from "./api";
import { bucketsOf } from "./costs.ts";
import { activeHours, hoursView, pagesView } from "./usage.ts";

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

test("pages transcribed: a PDF's pages counted once, on the day the first project with them was finished", () => {
  const iso = (s: string) => new Date(local(s)).toISOString();
  const transcribed: TranscribedData = {
    projects: [
      { id: "a", pdfSha256: "x", createdAt: iso("2026-10-19T09:00"), finishedAt: iso("2026-10-20T10:00"), pages: [1, 2, 3] },
      // The same PDF again: page 3 was already done, page 4 is new.
      { id: "b", pdfSha256: "x", createdAt: iso("2026-10-20T12:00"), finishedAt: iso("2026-10-21T10:00"), pages: [3, 4] },
      { id: "c", pdfSha256: "y", createdAt: iso("2026-10-21T08:00"), finishedAt: iso("2026-10-22T23:30"), pages: [1, 2] },
      { id: "d", pdfSha256: "z", createdAt: iso("2026-10-22T08:00"), finishedAt: null, pages: [] }, // unfinished
    ],
  };
  const range = { start: local("2026-10-20T00:00"), end: local("2026-10-23T00:00") };
  const view = pagesView(transcribed, bucketsOf(range.start, range.end, "day"), range);
  assert.deepEqual(view.values, [3, 1, 2]);
  assert.deepEqual([view.total, view.scores], [6, 2]);
  assert.deepEqual([view.created, view.finished, view.unfinished], [3, 3, 1]); // "a" was created before the range
});
