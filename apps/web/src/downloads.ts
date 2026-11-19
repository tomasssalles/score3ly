// `engrave`'s downloads (docs/stages/engrave.md, "Downloads"): everything in one zip, or each file on its own: the MEI
// file as stored, the engraved score as a PDF made now, and the run report. Files are named after the project.

import { fetchModelConfig, type ApiStage, type ModelConfig, type Project } from "./api";
import { REPOSITORY_URL } from "./about";
import { engravedPdf, meiFile } from "./engraving";
import { bundleFiles, downloadName, saveFile, zipFiles } from "./files";
import type { Engraving } from "./pipeline";
import { VEROVIO_VERSION } from "./rendering";
import { runReport } from "./runReport";
import { stepInfo } from "./steps";

export type DownloadKind = "bundle" | "mei" | "pdf" | "report";

// In the order of the card's menu: the bundle first.
export const DOWNLOADS: { kind: DownloadKind; label: string }[] = [
  { kind: "bundle", label: "Bundle (.zip)" },
  { kind: "mei", label: "MEI source (.mei)" },
  { kind: "pdf", label: "Re-engraved score (.pdf)" },
  { kind: "report", label: "Report (.json)" },
];

// The report on the pipeline up to the stage that made the files (`stages`: first to that stage).
async function report(project: Project, stages: ApiStage[], engraving: Engraving): Promise<Blob> {
  const ids = [...new Set(stages.flatMap((s) => (typeof s.config?.modelConfigId === "string" ? [s.config.modelConfigId] : [])))];
  const modelConfigs = new Map<string, ModelConfig>(await Promise.all(ids.map(async (id) => [id, await fetchModelConfig(id)] as const)));
  const json = runReport({
    madeAt: new Date(),
    app: { name: "score3ly", version: __APP_VERSION__, commit: __APP_COMMIT__, uncommittedChanges: __APP_DIRTY__, repository: REPOSITORY_URL },
    project,
    stages,
    stepOf: (step) => stepInfo(step),
    modelConfigs,
    meiSha256: engraving.meiSha256,
    engraving: { ...engraving.config, verovio: VEROVIO_VERSION },
  });
  return new Blob([JSON.stringify(json, null, 2) + "\n"], { type: "application/json" });
}

export async function download(kind: DownloadKind, project: Project, stages: ApiStage[], engraving: Engraving): Promise<void> {
  const name = (extension: Parameters<typeof downloadName>[1]) => downloadName(project.name, extension);
  if (kind === "mei") return saveFile(await meiFile(engraving), name("mei"));
  if (kind === "pdf") return saveFile(await engravedPdf(engraving), name("pdf"));
  if (kind === "report") return saveFile(await report(project, stages, engraving), name("report.json"));
  const bytes = async (blob: Promise<Blob>) => new Uint8Array(await (await blob).arrayBuffer());
  const [mei, pdf, json] = await Promise.all([bytes(meiFile(engraving)), bytes(engravedPdf(engraving)), bytes(report(project, stages, engraving))]);
  saveFile(new Blob([await zipFiles(bundleFiles(project.name, { mei, pdf, report: json }))], { type: "application/zip" }), name("zip"));
}
