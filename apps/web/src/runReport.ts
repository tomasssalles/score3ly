// The run report (docs/stages/engrave.md, "Downloads"): how the downloaded files were made, as JSON, so that programs
// can read it back. The app that made them, the original PDF, and every stage of the pipeline that led to them: its
// step and version, its config, the model config of an LLM stage (never its secrets), its times, cost and result.

import type { ApiStage, ModelConfig, Project } from "./api";
import type { EngraveConfig } from "./engrave";
import type { StageKind } from "./pipeline";

export const REPORT_VERSION = 1;

export type ReportModelConfig = { name: string | null; provider: string; model: string; effort: string | null; region: string | null; freeTier: boolean };

export type RunReport = {
  report: "score3ly run report";
  reportVersion: number;
  madeAt: string;
  app: { name: "score3ly"; version: string; commit: string | null; uncommittedChanges: boolean; repository: string };
  project: { name: string; createdAt: string };
  original: { fileName: string; sha256: string };
  mei: { sha256: string };
  engraving: EngraveConfig & { verovio: string };
  stages: {
    position: number;
    step: string;
    title: string;
    kind: StageKind;
    version: number | null;
    status: ApiStage["status"];
    config: Record<string, unknown> | null;
    modelConfig: ReportModelConfig | null;
    pageCount: number | null;
    startedAt: string | null;
    finishedAt: string | null;
    seconds: number | null;
    costUsd: number | null;
    result: string | null;
  }[];
  totalCostUsd: number;
};

export type ReportInput = {
  madeAt: Date;
  app: RunReport["app"];
  project: Project;
  stages: ApiStage[]; // the pipeline, first to last
  stepOf: (step: string) => { title: string; kind: StageKind };
  modelConfigs: Map<string, ModelConfig>; // by id, for the LLM stages' configs
  meiSha256: string;
  engraving: RunReport["engraving"];
};

export function runReport(input: ReportInput): RunReport {
  const stages = input.stages.map((s, i) => {
    const id = typeof s.config?.modelConfigId === "string" ? s.config.modelConfigId : null;
    const mc = id ? input.modelConfigs.get(id) : undefined;
    const seconds = s.startedAt && s.finishedAt ? Math.round((Date.parse(s.finishedAt) - Date.parse(s.startedAt)) / 100) / 10 : null;
    const { title, kind } = input.stepOf(s.step);
    return {
      position: i + 1,
      step: s.step,
      title,
      kind,
      version: s.stepVersion,
      status: s.status,
      config: s.config,
      modelConfig: mc
        ? { name: mc.name, provider: mc.provider, model: mc.model, effort: mc.effort, region: mc.params.region ?? null, freeTier: mc.freeTier }
        : null,
      pageCount: s.pageCount,
      startedAt: s.startedAt,
      finishedAt: s.finishedAt,
      seconds,
      costUsd: s.costUsd,
      result: s.note,
    };
  });
  return {
    report: "score3ly run report",
    reportVersion: REPORT_VERSION,
    madeAt: input.madeAt.toISOString(),
    app: input.app,
    project: { name: input.project.name, createdAt: input.project.createdAt },
    original: { fileName: input.project.pdfFilename, sha256: input.project.pdfSha256 },
    mei: { sha256: input.meiSha256 },
    engraving: input.engraving,
    stages,
    totalCostUsd: Math.round(stages.reduce((t, s) => t + (s.costUsd ?? 0), 0) * 1e6) / 1e6,
  };
}
