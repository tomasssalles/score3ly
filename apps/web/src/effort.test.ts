import { test } from "node:test";
import assert from "node:assert/strict";
import type { RunTimeData } from "./api";
import { effortView, share } from "./effort.ts";

const stage = (id: string, step: string, projectId: string, more: Partial<RunTimeData["stages"][number]> = {}): RunTimeData["stages"][number] => ({
  id,
  step,
  projectId,
  configId: null,
  done: true,
  manual: false,
  inRecipe: true,
  kept: true,
  createdAt: "2026-10-20T10:00:00.000Z",
  finishedAt: "2026-10-20T11:00:00.000Z",
  pageCount: 1,
  items: { whole: 0, page: 1, system: 0 },
  ...more,
});

const data: RunTimeData = {
  recipe: [],
  projects: [],
  stages: [
    stage("a1", "layout", "a"),
    stage("a2", "fix_layout", "a", { manual: true, inRecipe: false }),
    stage("b1", "layout", "b", { kept: false }), // replaced: a re-run
    stage("b2", "layout", "b"),
    stage("c1", "layout", "c"),
    stage("c2", "fix_mei", "c", { manual: true, inRecipe: false, done: false }), // still being worked on: not counted
    stage("d1", "layout", "d"),
  ],
  items: [],
  configs: [],
};

test("effort: the projects that needed a hand, and how often each kind of help", () => {
  const view = effortView(data, new Set(["a", "b", "c", "d"]));
  assert.deepEqual([view.projects, view.helped], [4, 2]);
  const rows = Object.fromEntries(view.rows.map((r) => [r.key, r.projects]));
  assert.deepEqual(rows, { fix_skew: 0, fix_layout: 1, fix_metadata: 0, fix_observations: 0, human_review: 0, fix_mei: 0, extra_review: null, rerun: 1 });
  assert.equal(effortView(data, new Set(["a"])).helped, 1);
  assert.deepEqual([share(1, 4), share(0, 0)], ["25%", "–"]);
});

test("effort: extra reviews are counted once reviews exist", () => {
  const withReviews = { ...data, stages: [...data.stages, stage("r1", "review", "a"), stage("r2", "review", "d", { inRecipe: false })] };
  const view = effortView(withReviews, new Set(["a", "b", "c", "d"]));
  assert.equal(view.rows.find((r) => r.key === "extra_review")!.projects, 1);
  assert.equal(view.helped, 3);
});
