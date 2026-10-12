import { test } from "node:test";
import assert from "node:assert/strict";
import type { ApiStage } from "./api.ts";
import {
  canRun,
  currentStage,
  defaultArtifactId,
  findArtifact,
  findStage,
  progressOf,
  runningStage,
  toPipeline,
} from "./pipeline.ts";

const SHA256 = "a".repeat(64);
const T0 = "2026-10-12T10:00:00.000Z";

function stage(id: string, step: string, fields: Partial<ApiStage> = {}): ApiStage {
  return {
    id,
    step,
    stepVersion: 1,
    status: "done",
    config: {},
    pageCount: null,
    error: null,
    note: null,
    startedAt: T0,
    heartbeatAt: null,
    finishedAt: T0,
    outputs: [],
    ...fields,
  };
}

const ingest = stage("s1", "ingest", { outputs: [{ id: "o1", item: "", type: "pdf", contentSha256: SHA256, recipeKey: null, recipe: null }] });

test("a new project's pipeline is Ingest, done, with the original PDF as its artifact", () => {
  const p = toPipeline("auto", { stages: [ingest] });
  assert.equal(p.mode, "auto");
  const [s] = p.stages;
  assert.equal(s.title, "Ingest");
  assert.equal(s.kind, "ingest");
  assert.equal(s.step, "ingest@1");
  assert.equal(s.status, "done");
  assert.equal(s.seconds, undefined);
  assert.equal(s.droppable, false);
  assert.deepEqual(s.artifacts, [{ id: "s1.pdf", title: "Original PDF", kind: "pdf", count: 1 }]);
  assert.equal(defaultArtifactId(p), "s1.pdf");
  assert.equal(findArtifact(p, "s1.pdf")?.stage.id, "s1");
  assert.equal(currentStage(p)?.id, "s1");
  assert.equal(canRun(p), false);
  assert.equal(runningStage(p), null);
  assert.deepEqual(progressOf(p), { stage: null, pipeline: 1 });
});

test("the first planned stage after the done ones is ready; the ones after it stay planned", () => {
  const p = toPipeline("manual", {
    stages: [
      ingest,
      stage("s2", "rasterize", { status: "planned", stepVersion: null, config: null, startedAt: null, finishedAt: null }),
      stage("s3", "skew_analysis", { status: "planned", stepVersion: null, startedAt: null, finishedAt: null }),
    ],
  });
  assert.deepEqual(
    p.stages.map((s) => s.status),
    ["done", "ready", "planned"],
  );
  assert.equal(p.stages[1].step, "rasterize");
  assert.deepEqual(p.stages[1].config, {});
  assert.ok(canRun(p));
  assert.equal(findStage(p, "s3")?.status, "planned");
  assert.equal(findArtifact(p, "s2.pdf"), null);
});

test("a failed stage can run again, and shows its error", () => {
  const p = toPipeline("auto", { stages: [ingest, stage("s2", "rasterize", { status: "failed", error: "Out of memory" })] });
  assert.equal(currentStage(p)?.status, "failed");
  assert.equal(currentStage(p)?.error, "Out of memory");
  assert.ok(canRun(p));
});

test("a done stage's run time comes from its start and end; its config is shown as text", () => {
  const p = toPipeline("auto", {
    stages: [
      ingest,
      stage("s2", "rasterize", { finishedAt: "2026-10-12T10:00:14.000Z", config: { dpi: 300, mode: "gray" } }),
    ],
  });
  assert.equal(p.stages[1].seconds, 14);
  assert.deepEqual(p.stages[1].config, { dpi: "300", mode: "gray" });
});

test("rasterize's page outputs are one artifact, its pages in order", () => {
  const recipe = (page: number) => ({ step: "rasterize", version: 1, pdf: SHA256, page, dpi: 300, pdfjs: "6" });
  const p = toPipeline("auto", {
    stages: [
      ingest,
      stage("s2", "rasterize", {
        note: "2 pages",
        outputs: [10, 2].map((n) => ({
          id: `o${n}`,
          item: `p${n}`,
          type: "page_image",
          contentSha256: null,
          recipeKey: "k".repeat(64),
          recipe: recipe(n),
        })),
      }),
    ],
  });
  const [artifact] = p.stages[1].artifacts;
  assert.equal(artifact.id, "s2.pages");
  assert.equal(artifact.kind, "images");
  assert.equal(artifact.count, 2);
  assert.deepEqual(
    artifact.pages?.map((page) => page.page),
    [2, 10],
  );
  assert.equal(defaultArtifactId(p), "s2.pages");
});

test("the stage this device runs shows its progress; one running elsewhere none; one whose heartbeat stopped failed", () => {
  const now = Date.parse("2026-10-12T10:10:00.000Z");
  const running = (heartbeatAt: string | null) =>
    toPipeline("auto", { stages: [ingest, stage("s2", "rasterize", { status: "running", heartbeatAt })] }, null, now);
  assert.equal(running("2026-10-12T10:09:00.000Z").stages[1].status, "running");
  assert.equal(running("2026-10-12T10:09:00.000Z").stages[1].progress, 0);
  const stale = running("2026-10-12T10:00:00.000Z").stages[1];
  assert.equal(stale.status, "failed");
  assert.match(stale.error ?? "", /Interrupted/);
  assert.ok(canRun(running("2026-10-12T10:00:00.000Z")));

  const local = toPipeline(
    "auto",
    { stages: [ingest, stage("s2", "rasterize", { status: "planned" })] },
    { stageId: "s2", progress: 0.25 },
    now,
  );
  assert.equal(local.stages[1].status, "running");
  assert.deepEqual(progressOf(local), { stage: 0.25, pipeline: 0.625 });
});
