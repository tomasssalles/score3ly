import { test } from "node:test";
import assert from "node:assert/strict";
import type { RunTimeData } from "./api";
import { effortView, share } from "./effort.ts";

type Stage = RunTimeData["stages"][number];
const stage = (id: string, step: string, projectId: string, more: Partial<Stage> = {}): Stage => ({
  id,
  step,
  projectId,
  configId: null,
  done: true,
  manual: false,
  inRecipe: true,
  kept: true,
  replacesStageId: null,
  activeQuarters: null,
  createdAt: "2026-10-20T10:00:00.000Z",
  finishedAt: "2026-10-20T11:00:00.000Z",
  pageCount: 2,
  items: { whole: 0, page: 2, system: 0 },
  ...more,
});
const manual = (id: string, step: string, projectId: string, quarters: number, more: Partial<Stage> = {}) =>
  stage(id, step, projectId, { manual: true, inRecipe: false, activeQuarters: quarters, ...more });
const project = (id: string, pages: number, pipeline: string[]): RunTimeData["projects"][number] => ({
  id,
  name: id,
  createdAt: "2026-10-20T10:00:00.000Z",
  deletedAt: null,
  finishedAt: "2026-10-21T10:00:00.000Z",
  pages: Array.from({ length: pages }, (_, i) => i + 1),
  pipeline,
});

const data: RunTimeData = {
  recipe: [],
  projects: [project("a", 2, ["a1", "a3"]), project("b", 2, ["b1", "b3"])],
  stages: [
    stage("a1", "layout", "a"),
    manual("a2", "fix_layout", "a", 2, { kept: false }), // edited: a3 builds on it, so it counts
    manual("a3", "fix_layout", "a", 1, { replacesStageId: "a2" }),
    manual("a4", "fix_mei", "a", 8, { kept: false }), // discarded: doesn't count
    stage("b1", "layout", "b"),
    manual("b3", "fix_mei", "b", 4),
  ],
  items: [],
  configs: [],
};

test("effort: the manual work of the final pipelines, per page, and how many projects used each step", () => {
  const view = effortView(data, new Set(["a", "b"]));
  const quarter = 15 * 60 * 1000;
  const rows = Object.fromEntries(view.rows.map((r) => [r.step, [r.perPageMs, r.usedIn]]));
  assert.deepEqual(rows.fix_layout, [(3 * quarter) / 4, 1]); // a2 and a3 over the 4 pages
  assert.deepEqual(rows.fix_mei, [(4 * quarter) / 4, 1]); // only b3: a4 was discarded
  assert.deepEqual(rows.fix_skew, [0, 0]);
  assert.equal(view.perPageMs, (7 * quarter) / 4);
  assert.equal(view.extraReviews, null); // no reviews anywhere yet
  assert.deepEqual(effortView(data, new Set()).perPageMs, null);
  assert.deepEqual([share(1, 4), share(0, 0)], ["25%", "–"]);
});

test("effort: extra reviews in the final pipelines, counted, as an average per project", () => {
  const withReviews: RunTimeData = {
    ...data,
    projects: [project("a", 2, ["a1", "r1", "r2", "r3"]), project("b", 2, ["b1", "b3"])],
    stages: [...data.stages, stage("r1", "review", "a"), stage("r2", "review", "a", { inRecipe: false }), stage("r3", "review", "a", { inRecipe: false }), stage("r4", "review", "b", { inRecipe: false, kept: false })],
  };
  assert.equal(effortView(withReviews, new Set(["a", "b"])).extraReviews, 1); // two in a, none kept in b
});
