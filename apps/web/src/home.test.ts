import { test } from "node:test";
import assert from "node:assert/strict";
import type { ApiPipeline, ApiStage, ListedProject, PipelinePosition } from "./api.ts";
import { cardsThatFit, HOME_CARDS, positionState, recentProjects } from "./home.ts";
import { firstNotDone, pipelineState, stateLabel, toPipeline } from "./pipeline.ts";

const at = (position: Partial<PipelinePosition> & { step: string }): PipelinePosition => ({
  status: "planned",
  interrupted: false,
  carried: false,
  ...position,
});
const label = (position: PipelinePosition | null) => stateLabel(positionState(position));

test("a card says where the pipeline is, as the panel's head does", () => {
  assert.equal(label(null), "Done");
  assert.equal(label(at({ step: "rasterize" })), "Rasterize (not started)");
  assert.equal(label(at({ step: "fix_layout", status: "wip" })), "Fix layout (WIP)");
  assert.equal(label(at({ step: "layout", status: "failed" })), "Layout failed");
  assert.equal(label(at({ step: "extract", status: "running" })), "Extract…");
  assert.equal(label(at({ step: "extract", status: "running", interrupted: true })), "Extract interrupted");
  // Released when its project was left mid-run (docs/database.md, "An interrupted run").
  assert.equal(label(at({ step: "extract", status: "failed", interrupted: true })), "Extract interrupted");
  // A finished manual stage carried through a re-run waits for its turn.
  assert.equal(label(at({ step: "fix_skew", status: "done", carried: true })), "Fix skew (not started)");
});

test("the home shows the most recently opened projects, as many as fit, at most 6", () => {
  const projects = Array.from({ length: HOME_CARDS + 3 }, (_, i) => ({ id: String(i) }) as ListedProject);
  assert.equal(HOME_CARDS, 6);
  assert.deepEqual(
    recentProjects(projects).map((p) => p.id),
    projects.slice(0, HOME_CARDS).map((p) => p.id),
  );
  assert.deepEqual(recentProjects(projects, 3).map((p) => p.id), ["0", "1", "2"]);
});

test("as many cards as fit: whole rows, at least one, at most 6", () => {
  // A phone: one column, cards 120 px high with 12 px between them.
  assert.equal(cardsThatFit(500, 120, 12, 1), 3);
  assert.equal(cardsThatFit(516, 120, 12, 1), 4); // 4 × 120 + 3 × 12 = 516
  assert.equal(cardsThatFit(50, 120, 12, 1), 1);
  // A wide screen: three columns, two rows.
  assert.equal(cardsThatFit(600, 120, 12, 3), 6);
  assert.equal(cardsThatFit(200, 120, 12, 3), 3);
});

// A stage as the Worker sends it, with only what the position needs.
const stage = (step: string, fields: Partial<ApiStage> = {}): ApiStage => ({
  id: step,
  step,
  stepVersion: 1,
  status: "done",
  config: null,
  pageCount: null,
  error: null,
  note: null,
  startedAt: null,
  heartbeatAt: null,
  finishedAt: null,
  interrupted: false,
  runMs: null,
  modelConfig: null,
  costUsd: null,
  carried: false,
  inRecipe: true,
  outputs: [],
  ...fields,
});

test("a card and the panel's head name the same state for the same pipeline", () => {
  const ingest = stage("ingest");
  const pipelines: ApiPipeline["stages"][] = [
    [ingest, stage("rasterize")],
    [ingest, stage("rasterize", { status: "planned" }), stage("skew_analysis", { status: "planned" })],
    [ingest, stage("rasterize", { status: "running" })],
    [ingest, stage("rasterize", { status: "running", interrupted: true })],
    [ingest, stage("rasterize", { status: "failed", error: "Interrupted: the project was left while this stage ran.", interrupted: true })],
    [ingest, stage("rasterize", { status: "failed", error: "no" }), stage("skew_analysis", { status: "planned" })],
    [ingest, stage("rasterize"), stage("skew_analysis"), stage("fix_skew", { status: "wip" }), stage("layout", { status: "planned" })],
    // A finished manual stage carried through a re-run waits for its turn, and so does one still WIP.
    [ingest, stage("rasterize"), stage("skew_analysis"), stage("fix_skew", { carried: true }), stage("layout", { status: "planned" })],
    [ingest, stage("rasterize"), stage("skew_analysis"), stage("fix_skew", { status: "wip", carried: true })],
    [ingest, stage("rasterize", { status: "planned" }), stage("skew_analysis", { status: "planned" }), stage("fix_skew", { carried: true })],
  ];
  for (const stages of pipelines) {
    // Where the Worker's list says the pipeline is: its first stage not done (pipelineRules.ts' `notDone`).
    const first = stages[firstNotDone(stages)];
    const position: PipelinePosition | null = first ? { step: first.step, status: first.status, interrupted: first.interrupted, carried: first.carried } : null;
    for (const mode of ["auto", "manual"] as const) {
      const panel = pipelineState(toPipeline(mode, { stages, dropped: [] }))!;
      assert.equal(label(position), stateLabel(panel), JSON.stringify(stages.map((s) => [s.step, s.status, s.carried])));
    }
  }
});
