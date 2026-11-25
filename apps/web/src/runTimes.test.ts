process.env.TZ = "Europe/Berlin";

import { test } from "node:test";
import assert from "node:assert/strict";
import type { ActivityData, RunTimeData } from "./api";
import { estimatePerPage, perProject, stepTimes } from "./runTimes.ts";

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
    { id: "a", name: "A", createdAt: "2026-10-20T10:00:00.000Z", deletedAt: null, finishedAt: "2026-10-21T10:00:00.000Z", pages: [1, 2], pipeline: ["ra", "la", "fa", "ea", "xa"] },
    { id: "b", name: "B", createdAt: "2026-10-22T10:00:00.000Z", deletedAt: null, finishedAt: "2026-10-22T16:00:00.000Z", pages: [1], pipeline: ["eb"] },
  ],
  stages: [
    stage("ra", "rasterize", "a", null, 2, { page: 2 }),
    stage("la", "layout", "a", "opus", 2, { page: 2 }),
    stage("ea", "extract", "a", "opus", 2, { system: 6, whole: 1 }), // 3 systems per page
    stage("eb", "extract", "b", "sonnet", 1, { system: 2, whole: 1 }),
    stage("xa", "apply_review", "a", "opus", 2, { system: 1 }), // one system with issues in two pages
    // A manual stage: 4 active quarters, over 2 pages; one not in its project's pipeline, left out.
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
    { id: "opus", name: "Opus EU", model: "claude-opus-5-5", modelKey: "claude-opus-5-5", modelLabel: "Claude Opus 5.5", createdAt: "2026-10-01", deletedAt: null },
    { id: "sonnet", name: null, model: "claude-sonnet-5-5", modelKey: "claude-opus-5-5", modelLabel: "Claude Opus 5.5", createdAt: "2026-10-01", deletedAt: "2026-10-25T00:00:00.000Z" },
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
  const rows = new Map(stepTimes(data, new Set(["a", "b"]), "none").map((r) => [r.step, r.ms]));
  assert.equal(rows.get("rasterize"), 2000); // only the image made; one item per page
  assert.equal(rows.get("layout"), 4000);
  // a: 20000 per system, 6 systems in 2 pages, the whole score 20 ms in 2 pages; b: 5000 per system, 2 in 1 page, 20 ms.
  // Each project weighs the same.
  assert.equal(rows.get("extract"), ((20000 * 6) / 2 + 20 / 2 + (5000 * 2 + 20)) / 2);
  assert.equal(rows.get("apply_review"), 8000 / 2); // one system with issues in two pages
  assert.equal(rows.get("review"), null); // no data
  assert.equal(rows.get("fix_layout"), 1_800_000); // an hour of active time over 2 pages; b's isn't finished: left out
  // The estimate adds up the recipe's steps, nothing else (no manual steps, no Apply review here).
  assert.equal(estimatePerPage(stepTimes(data, new Set(["a", "b"]), "none"), data.recipe), 2000 + 4000 + rows.get("extract")!);
  // A step of the recipe without data, or nothing selected: no estimate.
  assert.equal(estimatePerPage(stepTimes(data, new Set(["a", "b"]), "none"), [...data.recipe, "review"]), null);
  assert.equal(estimatePerPage(stepTimes(data, new Set(), "none"), data.recipe), null);
});

test("work time per page split by model config, for the LLM steps only", () => {
  const rows = stepTimes(data, new Set(["a", "b"]), "config");
  const extract = rows.find((r) => r.step === "extract")!;
  assert.deepEqual(
    extract.configs.map((c) => [c.label, c.note, Math.round(c.ms!)]),
    [["Opus EU", undefined, Math.round((20000 * 6) / 2 + 20 / 2)], ["claude-sonnet-5-5", "(until 25 Oct 2026)", Math.round(5000 * 2 + 20)]],
  );
  assert.deepEqual(rows.find((r) => r.step === "rasterize")!.configs, []);
});

test("work time per page split by model: the configs of one model together", () => {
  // Both configs say they use Claude Opus 5.5 here: one row for the two, over both projects.
  const extract = stepTimes(data, new Set(["a", "b"]), "model").find((r) => r.step === "extract")!;
  assert.deepEqual(
    extract.configs.map((c) => [c.label, c.note, Math.round(c.ms!)]),
    [["Claude Opus 5.5", undefined, Math.round(((20000 * 6) / 2 + 20 / 2 + (5000 * 2 + 20)) / 2)]],
  );
});

// The code review's F5 (the owner's dec. 38): a manual stage edited once is two stages, the second replacing the first;
// both were counted with their pages, so the time per page halved with every edit. Effort's rule: the final pipeline's
// manual stages with the stages they replaced, their active time over the project's pages, once; a dropped one not.
test("work time per page: an edited manual stage counted once, over the project's pages; a dropped one left out", () => {
  const edited: RunTimeData = {
    ...data,
    projects: [{ ...data.projects[0], pipeline: ["ra", "f2"] }],
    stages: [
      stage("ra", "rasterize", "a", null, 2, { page: 2 }),
      { ...stage("f1", "fix_layout", "a", null, 2, {}), manual: true, activeQuarters: 4 },
      { ...stage("f2", "fix_layout", "a", null, 2, {}), manual: true, activeQuarters: 2, replacesStageId: "f1" },
      { ...stage("f0", "fix_layout", "a", null, 2, {}), manual: true, activeQuarters: 8 }, // dropped by a re-run
    ],
  };
  const rows = new Map(stepTimes(edited, new Set(["a"]), "none").map((r) => [r.step, r.ms]));
  assert.equal(rows.get("fix_layout"), (6 * 15 * 60_000) / 2); // 6 quarters over the project's 2 pages
  assert.equal(rows.get("fix_skew"), null); // not used: no time, as before
});
