// A time zone that isn't a whole hour from UTC, and has no summer time: days start at 18:15 UTC.
process.env.TZ = "Asia/Kathmandu";

import { test } from "node:test";
import assert from "node:assert/strict";
import type { CostData } from "./api";
import { averagePerPage, axisLabel, bucketsOf, bucketTitle, costView, createdBefore, defaultGranularity, granularitiesFor, allGroups, grouper, OTHER, perPage, rangeOf, unfinished } from "./costs.ts";

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

const data: CostData = {
  capUsd: 15,
  spentLastDayUsd: 2,
  points: [
    ["layout-1", "opus-1", local("2026-10-20T23:45"), 1, "ok"], // late on the 20th, local time
    ["extract-1", "opus-1", local("2026-10-21T00:00"), 3, "ok"],
    ["extract-1", "opus-1", local("2026-10-21T00:00"), 1, "cut_off"],
    ["extract-old", "opus-2", local("2026-10-21T09:00"), 2, "unparseable"],
    ["review-2", "sonnet", local("2026-10-22T12:00"), 0.5, "ok"],
  ],
  unknown: [
    ["extract-1", "opus-1", local("2026-10-21T00:00"), 2],
    ["extract-old", "opus-2", local("2026-10-21T09:00"), 1],
    ["layout-1", "opus-1", local("2026-10-23T08:00"), 5], // after the range
  ],
  stages: [
    { id: "layout-1", step: "layout", projectId: "p1", inRecipe: true, kept: true },
    { id: "extract-1", step: "extract", projectId: "p1", inRecipe: true, kept: true },
    { id: "extract-old", step: "extract", projectId: "p1", inRecipe: true, kept: false },
    { id: "review-2", step: "review", projectId: "p2", inRecipe: false, kept: true },
  ],
  projects: [
    { id: "p1", name: "Sonata", pdfSha256: "aa", pdfFilename: "Sonata.pdf", createdAt: "2026-10-01T00:00:00Z", deletedAt: null, finished: true, costUsd: 0, pages: [] },
    { id: "p2", name: "Sonata", pdfSha256: "aa", pdfFilename: "Sonata.pdf", createdAt: "2026-09-01T00:00:00Z", deletedAt: "2026-10-23T00:00:00Z", finished: true, costUsd: 0, pages: [] },
  ],
  configs: [
    { id: "opus-1", name: "Opus EU", provider: "anthropic-bedrock", model: "anthropic.claude-opus-5-5", effort: "high", createdAt: "", deletedAt: "2026-10-21T05:00:00Z" },
    { id: "opus-2", name: "Opus EU", provider: "anthropic-bedrock", model: "anthropic.claude-opus-5-5", effort: "xhigh", createdAt: "", deletedAt: null },
    { id: "sonnet", name: null, provider: "anthropic", model: "claude-sonnet-5-5", effort: null, createdAt: "", deletedAt: null },
  ],
};
const range = { start: local("2026-10-20T00:00"), end: local("2026-10-23T00:00") };

test("costs fall into the device's days, and the totals before and after filters", () => {
  const view = costView(data, range, "day", null, {});
  assert.deepEqual(view.series.map((s) => s.key), ["all"]);
  assert.deepEqual(view.values, [[1, 6, 0.5]]);
  assert.equal(view.total, 7.5);
  const filtered = costView(data, range, "day", null, { stage: { grouping: "fate", hidden: ["discarded"] }, project: { grouping: "alive", hidden: ["deleted"] } });
  assert.deepEqual(filtered.values, [[1, 4, 0]]);
  assert.equal(filtered.total, 7.5);
  assert.equal(filtered.filtered, 5);
  assert.deepEqual(filtered.rows.map((r) => [r.key, r.usd]), [["all", 5]]);
});

test("the calls of unknown cost follow the time range and the filters", () => {
  assert.equal(costView(data, range, "day", null, {}).unknown, 3);
  assert.equal(costView(data, range, "day", null, { stage: { grouping: "fate", hidden: ["discarded"] } }).unknown, 2);
  assert.equal(costView(data, { start: range.start, end: local("2026-10-24T00:00") }, "day", null, {}).unknown, 8);
});

test("a split gives a series per group, the most expensive first; the table lists every group", () => {
  const view = costView(data, range, "day", { dimension: "stage", grouping: "step", byName: false }, {});
  assert.deepEqual(view.series.map((s) => s.label), ["Extract", "Layout", "Review"]);
  assert.deepEqual(view.values, [[0, 6, 0], [1, 0, 0], [0, 0, 0.5]]);
  const origin = costView(data, range, "day", { dimension: "stage", grouping: "origin", byName: false }, {});
  assert.deepEqual(origin.rows.map((r) => [r.label, r.usd]), [["Recipe stages", 7], ["Added stages", 0.5]]);
});

test("more groups than colours: the rest are one series, the table still lists each", () => {
  const many: CostData = {
    ...data,
    points: Array.from({ length: 9 }, (_, i) => [`s${i}`, "sonnet", local("2026-10-21T10:00"), 9 - i, "ok"] as [string, string, number, number, string]),
    stages: Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, step: `step${i}`, projectId: "p1", inRecipe: true, kept: true })),
  };
  const view = costView(many, range, "day", { dimension: "stage", grouping: "step", byName: false }, {});
  assert.equal(view.series.length, 7);
  assert.deepEqual(view.series.at(-1), { key: OTHER, label: "Other (3)" });
  assert.deepEqual(view.values.at(-1), [0, 3 + 2 + 1, 0]);
  assert.equal(view.rows.length, 9);
});

test("groupings: deleted projects marked with the day they were deleted, edited configs apart or by name, providers and efforts", () => {
  const projects = grouper(data, "project", "project");
  assert.deepEqual(projects("review-2", "sonnet"), { key: "p2", label: "Sonata", note: "(deleted 23 Oct 2026)" });
  assert.deepEqual(projects("layout-1", "opus-1"), { key: "p1", label: "Sonata", note: undefined });
  assert.equal(grouper(data, "project", "pdf")("review-2", "sonnet").label, "Sonata.pdf");
  const configs = grouper(data, "config", "config");
  assert.deepEqual([configs("x", "opus-1").label, configs("x", "opus-1").note], ["Opus EU", "(until 21 Oct 2026)"]);
  assert.equal(configs("x", "sonnet").label, "claude-sonnet-5-5");
  const byName = costView(data, range, "day", { dimension: "config", grouping: "config", byName: true }, {});
  assert.deepEqual(byName.rows.map((g) => [g.label, g.usd]), [["Opus EU", 7], ["claude-sonnet-5-5", 0.5]]);
  assert.equal(grouper(data, "config", "provider")("x", "opus-2").label, "AWS Bedrock");
  assert.equal(grouper(data, "config", "family")("x", "sonnet").label, "Claude");
  assert.equal(grouper(data, "config", "effort")("x", "sonnet").label, "Model's default");
});

test("the filters list every group, whatever the range: known ones in their order, the others the most expensive first", () => {
  const labels = (dimension: "stage" | "project" | "config" | "status", grouping: string) =>
    allGroups(data, dimension, grouper(data, dimension, grouping)).map((g) => g.label);
  assert.deepEqual(labels("stage", "step"), ["Layout", "Extract", "Review"]); // the pipeline's order
  assert.deepEqual(labels("stage", "fate"), ["Kept", "Replaced or stopped"]);
  assert.deepEqual(labels("status", "status"), ["Succeeded", "Cut off", "Unusable answer"]);
  assert.deepEqual(labels("status", "success"), ["Succeeded", "Failed"]);
  assert.deepEqual(labels("config", "config"), ["Opus EU", "Opus EU", "claude-sonnet-5-5"]); // $4 + $1 + $2, then $0.50
  // A project with only calls of unknown cost is listed too, so that it can be hidden.
  const unknownOnly: CostData = {
    ...data,
    unknown: [["lost", "sonnet", local("2026-10-21T00:00"), 1]],
    stages: [...data.stages, { id: "lost", step: "layout", projectId: "p3", inRecipe: true, kept: false }],
    projects: [...data.projects, { ...data.projects[0], id: "p3", name: "Etude" }],
  };
  assert.ok(allGroups(unknownOnly, "project", grouper(unknownOnly, "project", "project")).some((g) => g.label === "Etude"));
});

test("the call status: split and filtered by status; calls of unknown cost have none and pass its filter", () => {
  const view = costView(data, range, "day", { dimension: "status", grouping: "success", byName: false }, {});
  assert.deepEqual(view.rows.map((r) => [r.label, r.usd]), [["Succeeded", 4.5], ["Failed", 3]]);
  const failed = costView(data, range, "day", null, { status: { grouping: "success", hidden: ["ok"] } });
  assert.equal(failed.filtered, 3);
  assert.equal(failed.unknown, 3);
});

test("the average per page: a PDF's projects are one score, its pages counted once; every score weighs the same", () => {
  const project = (id: string, pdf: string, costUsd: number, pages: number[], createdAt = "2026-10-20T00:00:00Z", finished = true) =>
    ({ id, name: id, pdfSha256: pdf, pdfFilename: `${pdf}.pdf`, createdAt, deletedAt: null, finished, costUsd, pages });
  const projects = [
    project("a1", "a", 10, [1, 2, 3, 4]), // two tries of the same score: $15 for 4 pages
    project("a2", "a", 5, [3, 4]),
    project("a3", "a", 7, []), // never rasterized: left out, cost and all
    project("b", "b", 40, Array.from({ length: 100 }, (_, i) => i + 1)), // long and cheap per page: $0.40
    project("c", "c", 0, []),
  ];
  assert.deepEqual(averagePerPage(projects), { average: (15 / 4 + 0.4) / 2, projects: 3 });
  assert.equal(perPage(projects[0]), 2.5);
  assert.equal(perPage(projects[2]), null);
  // Nothing to average: no projects, none picked, none with pages.
  assert.deepEqual(averagePerPage([]), { average: null, projects: 0 });
  assert.deepEqual(averagePerPage([projects[2], projects[4]]), { average: null, projects: 0 });

  const now = local("2026-10-27T10:00");
  const more = [...projects, project("old", "d", 1, [1], "2026-06-01T00:00:00Z"), project("wip", "e", 1, [1], "2026-10-26T00:00:00Z", false)];
  assert.deepEqual(createdBefore(more, "30d", now), ["old"]);
  assert.deepEqual(createdBefore(more, "12m", now), []);
  assert.deepEqual(unfinished(more), ["wip"]);
});
