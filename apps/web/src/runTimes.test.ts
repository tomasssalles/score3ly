process.env.TZ = "Europe/Berlin";

import { test } from "node:test";
import assert from "node:assert/strict";
import type { ActivityData, RunTimeData } from "./api";
import { duration, estimatePerPage, perProject, stepTimes } from "./runTimes.ts";

const stage = (id: string, step: string, projectId: string, configId: string | null, pageCount: number, items: Partial<RunTimeData["stages"][number]["items"]>, done = true) => ({
  id,
  step,
  projectId,
  configId,
  done,
  manual: false,
  inRecipe: true,
  kept: true,
  replacesStageId: null as string | null,
  activeQuarters: null as number | null,
  createdAt: "2026-10-20T10:00:00.000Z",
  finishedAt: "2026-10-20T11:00:00.000Z" as string | null,
  pageCount,
  items: { whole: 0, page: 0, system: 0, ...items },
});

const data: RunTimeData = {
  recipe: ["rasterize", "layout", "extract"],
  projects: [
    { id: "a", name: "A", createdAt: "2026-10-20T10:00:00.000Z", deletedAt: null, finishedAt: "2026-10-21T10:00:00.000Z", pages: [1, 2], pipeline: [] },
    { id: "b", name: "B", createdAt: "2026-10-22T10:00:00.000Z", deletedAt: null, finishedAt: "2026-10-22T16:00:00.000Z", pages: [1], pipeline: [] },
  ],
  stages: [
    stage("ra", "rasterize", "a", null, 2, { page: 2 }),
    stage("la", "layout", "a", "opus", 2, { page: 2 }),
    stage("ea", "extract", "a", "opus", 2, { system: 6, whole: 1 }), // 3 systems per page
    stage("eb", "extract", "b", "sonnet", 1, { system: 2, whole: 1 }),
    stage("xa", "apply_review", "a", "opus", 2, { system: 1 }), // one system with issues in two pages
    // A manual stage: 4 active quarters, over 2 pages; one still being worked on, left out.
    { ...stage("fa", "fix_layout", "a", null, 2, {}), manual: true, activeQuarters: 4 },
    { ...stage("fb", "fix_layout", "b", null, 1, {}, false), manual: true, finishedAt: null, activeQuarters: 2 },
  ],
  items: [
    ["ra", "p1", 2000, 0, 0, 1, 0], // made
    ["ra", "p2", 50, 0, 0, 1, 1], // found in the cache: not counted
    ["la", "p1", 4000, 2, 0, 6, 4],
    ["la", "p2", 100, 2, 2, 0, 0], // answers from the record: not counted
    ["ea", "p1/s1", 30000, 1, 0, 12, 6],
    ["ea", "p1/s2", 10000, 1, 0, 12, 6],
    ["ea", "", 20, 0, 0, 0, 0],
    ["eb", "p1/s1", 5000, 1, 0, 12, 6],
    ["eb", "", 20, 0, 0, 0, 0],
    ["xa", "p2/s1", 8000, 1, 0, 6, 6],
  ],
  configs: [
    { id: "opus", name: "Opus EU", model: "claude-opus-5-5", createdAt: "2026-10-01", deletedAt: null },
    { id: "sonnet", name: null, model: "claude-sonnet-5-5", createdAt: "2026-10-01", deletedAt: "2026-10-25T00:00:00.000Z" },
  ],
};

const activity: ActivityData = {
  quarters: [
    ["a", Date.parse("2026-10-20T10:00:00.000Z")],
    ["a", Date.parse("2026-10-20T10:15:00.000Z")],
    ["a", Date.parse("2026-10-21T09:45:00.000Z")],
    ["b", Date.parse("2026-10-22T10:00:00.000Z")],
  ],
  projects: [],
};

test("per project: the average time from creation to the last finish, and the average active hours", () => {
  const both = perProject(data, new Set(["a", "b"]), activity);
  assert.deepEqual(both, { projects: 2, spanMs: 15 * 3_600_000, activeHours: (0.75 + 0.25) / 2 }); // 3 and 1 quarters
  assert.deepEqual(perProject(data, new Set(), activity), { projects: 0, spanMs: null, activeHours: null });
});

test("work time per page: from the items that really ran, times the items of each kind per page, per project, then averaged", () => {
  const rows = new Map(stepTimes(data, new Set(["a", "b"]), false).map((r) => [r.step, r.ms]));
  assert.equal(rows.get("rasterize"), 2000); // only the image made; one item per page
  assert.equal(rows.get("layout"), 4000);
  // a: 20000 per system, 6 systems in 2 pages, the whole score 20 ms in 2 pages; b: 5000 per system, 2 in 1 page, 20 ms.
  // Each project weighs the same.
  assert.equal(rows.get("extract"), ((20000 * 6) / 2 + 20 / 2 + (5000 * 2 + 20)) / 2);
  assert.equal(rows.get("apply_review"), 8000 / 2); // one system with issues in two pages
  assert.equal(rows.get("review"), null); // no data
  assert.equal(rows.get("fix_layout"), 1_800_000); // an hour of active time over 2 pages; b's isn't finished: left out
  // The estimate adds up the recipe's steps, nothing else (no manual steps, no Apply review here).
  assert.equal(estimatePerPage(stepTimes(data, new Set(["a", "b"]), false), data.recipe), 2000 + 4000 + rows.get("extract")!);
  // A step of the recipe without data, or nothing selected: no estimate.
  assert.equal(estimatePerPage(stepTimes(data, new Set(["a", "b"]), false), [...data.recipe, "review"]), null);
  assert.equal(estimatePerPage(stepTimes(data, new Set(), false), data.recipe), null);
});

test("work time per page split by model config, for the LLM steps only", () => {
  const rows = stepTimes(data, new Set(["a", "b"]), true);
  const extract = rows.find((r) => r.step === "extract")!;
  assert.deepEqual(
    extract.configs.map((c) => [c.label, c.note, Math.round(c.ms!)]),
    [["Opus EU", undefined, Math.round((20000 * 6) / 2 + 20 / 2)], ["claude-sonnet-5-5", "(until 25 Oct 2026)", Math.round(5000 * 2 + 20)]],
  );
  assert.deepEqual(rows.find((r) => r.step === "rasterize")!.configs, []);
});

test("durations, short", () => {
  assert.deepEqual([0, 3, 30, 400, 12_000, 100_000, 120_000, 19_200_000, 3 * 86_400_000 + 4 * 3_600_000].map(duration), ["0 s", "0.01 s", "0.03 s", "0.4 s", "12 s", "1 min 40 s", "2 min", "5 h 20 min", "3 d 4 h"]);
});
