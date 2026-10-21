// `engrave`'s downloads (DESIGN.md §6, `engrave`, "Downloads"): everything in one zip, or each file on its own: the MEI
// file as stored, the engraved score as a PDF made now, and the run report. Files are named after the project.

import { fetchModelConfig, type ApiStage, type ModelConfig, type Project } from "./api";
import { REPOSITORY_URL } from "./about";
import { downloadName } from "./engrave";
import { engravedPdf, meiFile, saveFile } from "./engraving";
import type { Artifact } from "./pipeline";
import { VEROVIO_VERSION } from "./rendering";
import { runReport } from "./runReport";
import { stepInfo } from "./steps";

export type DownloadKind = "bundle" | "mei" | "pdf" | "report";

// In the order of the card's menu: the bundle first.
export const DOWNLOADS: { kind: DownloadKind; label: string }[] = [
  { kind: "bundle", label: "Everything (.zip)" },
  { kind: "mei", label: "MEI file (.mei)" },
  { kind: "pdf", label: "Engraved score (.pdf)" },
  { kind: "report", label: "Run report (.json)" },
];

type Engraving = NonNullable<Artifact["engraving"]>;

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
  if (kind === "pdf") return saveFile(await engravedPdf(engraving), name("engraved.pdf"));
  if (kind === "report") return saveFile(await report(project, stages, engraving), name("report.json"));
  const [mei, pdf, json, { zip }] = await Promise.all([meiFile(engraving), engravedPdf(engraving), report(project, stages, engraving), import("fflate")]);
  const bytes = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());
  const files = {
    [name("mei")]: [await bytes(mei), { level: 6 }],
    [name("engraved.pdf")]: [await bytes(pdf), { level: 0 }], // already compressed
    [name("report.json")]: [await bytes(json), { level: 6 }],
  } as const;
  const archive = await new Promise<Uint8Array>((resolve, reject) => zip(files as never, (err, data) => (err ? reject(err) : resolve(data))));
  saveFile(new Blob([archive as Uint8Array<ArrayBuffer>], { type: "application/zip" }), name("zip"));
}
