// A time zone that isn't a whole hour from UTC: its hours start at :15 UTC.
process.env.TZ = "Asia/Kathmandu";

import { test } from "node:test";
import assert from "node:assert/strict";
import type { ActivityData, FailureData, ProjectStats } from "./api";
import { bucketsOf } from "./costs.ts";
import { activeHours, createdIn, createdNote, failuresIn, hoursView } from "./usage.ts";

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

test("projects created in a range: done, unfinished and deleted add up; the note leaves out what is 0", () => {
  const at = (s: string) => new Date(local(s)).toISOString();
  const stats: ProjectStats = {
    projects: [
      { id: "a", createdAt: at("2026-10-01T09:00"), deleted: false, finished: true }, // before the range
      { id: "b", createdAt: at("2026-10-20T09:00"), deleted: false, finished: true },
      { id: "c", createdAt: at("2026-10-21T09:00"), deleted: false, finished: false },
      { id: "d", createdAt: at("2026-10-21T10:00"), deleted: false, finished: false },
      { id: "e", createdAt: at("2026-10-22T09:00"), deleted: true, finished: true }, // deleted: not counted as done
    ],
    pagesProcessed: 0,
  };
  const counts = createdIn(stats, { start: local("2026-10-20T00:00"), end: local("2026-10-23T00:00") });
  assert.deepEqual(counts, { total: 4, done: 1, unfinished: 2, deleted: 1 });
  assert.equal(createdNote(counts), "1 done, 2 unfinished, 1 deleted");
  assert.equal(createdNote({ done: 5, unfinished: 0, deleted: 1 }), "5 done, 1 deleted");
  assert.equal(createdNote({ done: 0, unfinished: 0, deleted: 0 }), "");
});

test("failed calls: counted in the range, for all configs or one, the reasons the most frequent first", () => {
  const failures: FailureData = {
    points: [
      ["opus", local("2026-10-19T10:00"), "overloaded", 5], // before the range
      ["opus", local("2026-10-20T10:00"), "ok", 10],
      ["opus", local("2026-10-20T10:00"), "cut_off", 1],
      ["opus", local("2026-10-21T10:00"), "overloaded", 2],
      ["gemini", local("2026-10-21T10:00"), "ok", 4],
      ["gemini", local("2026-10-22T10:00"), "rate_limit", 3],
    ],
    configs: [],
  };
  const range = { start: local("2026-10-20T00:00"), end: local("2026-10-23T00:00") };
  const all = failuresIn(failures, range, null);
  assert.deepEqual([all.calls, all.failed], [20, 6]);
  assert.deepEqual(all.reasons.map((r) => [r.label, r.calls]), [["Rate limited", 3], ["Overloaded", 2], ["Cut off", 1]]);
  const opus = failuresIn(failures, range, "opus");
  assert.deepEqual([opus.calls, opus.failed], [13, 3]);
});
