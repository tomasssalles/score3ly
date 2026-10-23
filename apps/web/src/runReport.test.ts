import { test } from "node:test";
import assert from "node:assert/strict";
import type { ApiStage, ModelConfig, Project } from "./api.ts";
import { runReport } from "./runReport.ts";

const stage = (step: string, over: Partial<ApiStage> = {}): ApiStage => ({
  id: step,
  step,
  stepVersion: 1,
  status: "done",
  config: {},
  pageCount: 2,
  error: null,
  note: null,
  startedAt: "2026-10-21T10:00:00.000Z",
  heartbeatAt: null,
  finishedAt: "2026-10-21T10:00:12.340Z",
  modelConfig: null,
  costUsd: null,
  carried: false,
  outputs: [],
  ...over,
});

const project: Project = {
  id: "p",
  name: "Sonata",
  pdfSha256: "aa",
  pdfFilename: "Sonata.pdf",
  createdAt: "2026-10-01T00:00:00.000Z",
  lastModifiedAt: "",
  lastOpenedAt: "",
  runMode: "auto",
};

const opus: ModelConfig = {
  id: "mc1",
  name: "Opus in the EU",
  provider: "anthropic-bedrock",
  model: "anthropic.claude-opus-5-5",
  effort: "high",
  params: { region: "eu-central-1" },
  secrets: { accessKeyId: "BEDROCK_KEY_ID", secretAccessKey: "BEDROCK_SECRET" },
  freeTier: false,
  supersedesId: null,
  createdAt: "",
};

test("the report has every stage, its config and its model config without secrets, and the total cost", () => {
  const report = runReport({
    madeAt: new Date("2026-10-21T12:00:00.000Z"),
    app: { name: "score3ly", version: "0.1.0", commit: "abc1234", uncommittedChanges: false, repository: "https://example.org" },
    project,
    stages: [stage("ingest"), stage("layout", { config: { modelConfigId: "mc1" }, costUsd: 0.12, note: "4 systems" }), stage("engrave", { costUsd: null })],
    stepOf: (step) => ({ title: step, kind: step === "layout" ? "llm" : "computed" }),
    modelConfigs: new Map([["mc1", opus]]),
    meiSha256: "bb",
    engraving: { pageSize: "a4", verovio: "6.3.0" },
  });
  assert.deepEqual(report.original, { fileName: "Sonata.pdf", sha256: "aa" });
  assert.deepEqual(report.stages.map((s) => [s.position, s.step, s.seconds]), [[1, "ingest", 12.3], [2, "layout", 12.3], [3, "engrave", 12.3]]);
  assert.deepEqual(report.stages[1].modelConfig, { name: "Opus in the EU", provider: "anthropic-bedrock", model: "anthropic.claude-opus-5-5", effort: "high", region: "eu-central-1", freeTier: false });
  assert.equal(report.stages[1].result, "4 systems");
  assert.equal(report.totalCostUsd, 0.12);
  assert.ok(!JSON.stringify(report).includes("BEDROCK"));
});
