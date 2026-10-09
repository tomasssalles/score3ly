import { test } from "node:test";
import assert from "node:assert/strict";
import type { Project } from "./api.ts";
import * as mock from "./mockPipeline.ts";
import {
  canRun,
  currentStage,
  defaultOutputId,
  findOutput,
  findStage,
  progressOf,
  runningStage,
  type Pipeline,
} from "./pipeline.ts";

const project: Project = {
  id: "p1",
  name: "Sonata",
  pdfSha256: "a".repeat(64),
  pdfFilename: "Sonata.pdf",
  createdAt: "2026-10-07T00:00:00.000Z",
  lastModifiedAt: "2026-10-07T00:00:00.000Z",
  lastOpenedAt: "2026-10-07T00:00:00.000Z",
};

const runToEnd = (p: Pipeline) => mock.advance(p, 1);

test("the mock starts with the original PDF in Ingest and the transcription ready to run", () => {
  const p = mock.mockPipeline(project);
  assert.equal(p.stages[0].id, "ingest");
  assert.equal(p.stages[0].note, "Sonata.pdf");
  assert.equal(findOutput(p, "ingest.original-pdf")?.output.kind, "pdf");
  assert.equal(currentStage(p)?.id, "transcription");
  assert.ok(canRun(p));
  assert.equal(runningStage(p), null);
});

test("the default output is the latest stage's main one; planned stages have none to show", () => {
  const p = mock.mockPipeline(project);
  assert.equal(defaultOutputId(p), "skeleton.skeleton");
  assert.equal(findOutput(p, "transcription.transcriptions"), null);
});

test("progress counts done stages, and the running one with its own progress", () => {
  const p = mock.advance(mock.start(mock.mockPipeline(project)), 0.5);
  const done = p.stages.filter((stage) => stage.status === "done").length;
  assert.deepEqual(progressOf(p), { stage: 0.5, pipeline: (done + 0.5) / p.stages.length });
  assert.equal(progressOf(mock.stop(p)).stage, null);
});

test("in Auto mode a finished stage starts the next one; in Manual mode it only makes it ready", () => {
  const auto = runToEnd(mock.start(mock.mockPipeline(project)));
  assert.equal(runningStage(auto)?.id, "checks");
  const manual = runToEnd(mock.start(mock.setMode(mock.mockPipeline(project), "manual")));
  assert.equal(runningStage(manual), null);
  assert.equal(currentStage(manual)?.id, "checks");
  assert.equal(currentStage(manual)?.status, "ready");
});

test("a failed stage can run again", () => {
  const p = mock.fail(mock.start(mock.mockPipeline(project)));
  assert.equal(currentStage(p)?.status, "failed");
  assert.ok(canRun(p));
  assert.equal(runningStage(mock.start(p))?.id, "transcription");
});

test("a manual stage added in the middle replaces what follows, and holds the pipeline until finished", () => {
  const p = mock.addFix(mock.mockPipeline(project), "analysis", "Fix metadata");
  const i = p.stages.findIndex((stage) => stage.id === "analysis");
  assert.equal(p.stages[i + 1].title, "Fix metadata");
  assert.equal(p.stages[i + 1].status, "wip");
  // The earlier manual stage after it was dropped, and the rest waits.
  assert.ok(!p.stages.some((stage) => stage.id === "fix-1"));
  assert.ok(p.stages.slice(i + 2).every((stage) => stage.status === "planned"));
  assert.equal(currentStage(p)?.status, "wip");
  assert.ok(!canRun(p));
  // Finishing it carries on by itself in Auto mode.
  const finished = mock.finish(p, p.stages[i + 1].id);
  assert.equal(runningStage(finished)?.id, "system_crops");
});

test("only changes that replace stages that already ran need confirming", () => {
  const p = mock.mockPipeline(project);
  assert.ok(mock.replacesWork(p, "analysis"));
  assert.ok(!mock.replacesWork(p, "skeleton"));
});

test("a finished manual stage can be edited again, which replaces what follows", () => {
  const p = mock.edit(mock.mockPipeline(project), "fix-1");
  assert.equal(currentStage(p)?.id, "fix-1");
  assert.equal(currentStage(p)?.status, "wip");
  assert.ok(p.stages.slice(5).every((stage) => stage.status === "planned"));
});

test("dropping an unfinished manual stage gives the next stage its turn", () => {
  const added = mock.addFix(mock.mockPipeline(project), "skeleton", "Fix system crops");
  const p = mock.drop(mock.setMode(added, "manual"), added.stages.find((s) => s.kind === "manual" && s.status === "wip")!.id);
  assert.equal(currentStage(p)?.id, "transcription");
  assert.equal(currentStage(p)?.status, "ready");
});

test("dropping a finished manual stage replaces what follows, from the stage before it", () => {
  const p = mock.drop(mock.setMode(mock.mockPipeline(project), "manual"), "fix-1");
  assert.equal(findStage(p, "fix-1"), null);
  assert.equal(currentStage(p)?.id, "system_crops");
  assert.equal(currentStage(p)?.status, "ready");
  assert.equal(currentStage(p)?.seconds, undefined);
});

test("in Auto mode, the pipeline carries on after a stage is dropped", () => {
  const p = mock.drop(mock.mockPipeline(project), "fix-1");
  assert.equal(runningStage(p)?.id, "system_crops");
});

test("a planned stage can't be dropped", () => {
  const p = mock.mockPipeline(project);
  assert.equal(mock.drop(p, "analysis"), p);
});

test("changing a stage's config in Manual mode makes it ready, and clears what follows", () => {
  const p = mock.rerun(mock.setMode(mock.mockPipeline(project), "manual"), "system_crops", false);
  assert.equal(currentStage(p)?.id, "system_crops");
  assert.equal(currentStage(p)?.status, "ready");
  assert.equal(currentStage(p)?.seconds, undefined);
});
