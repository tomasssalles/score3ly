// A project's export file (docs/database.md, "Exporting and importing a project"): `<name>.s3l`, a plain zip of
//   manifest.json          the export format's version, the app's version and commit, the date, the project's name,
//                          and each content object's media type
//   project.json           the rows of the project's current pipeline, as the Worker hands them out
//   pdf/<sha256>.pdf       the PDF
//   content/<sha256>       every object the rows refer to (outputs, calls' requests and responses)
// Made and read here, in the browser: zipping is too much work for a Worker's CPU limit. Images aren't in it (they are
// made again from their recipes).

import { sha256Hex } from "@score3ly/core";
import type { Project, ProjectRows } from "./api.ts";
import { fetchContent, fetchExport, fetchPdf, importRows, missingContent, putContent, storePdf } from "./api.ts";
import { fileBase } from "./engrave.ts";

// The export formats this version reads (the Worker's `EXPORT_FORMAT`; kept equal by a test).
export const EXPORT_FORMATS = [1];
export const EXTENSION = ".s3l";

export type Manifest = {
  format: number;
  app: { version: string; commit: string | null };
  exportedAt: string;
  project: string;
  contentTypes: Record<string, string>;
};

export type ProjectArchive = { manifest: Manifest; rows: ProjectRows; pdf: Uint8Array<ArrayBuffer>; content: Map<string, Uint8Array<ArrayBuffer>> };

export function exportName(projectName: string): string {
  return `${fileBase(projectName)}${EXTENSION}`;
}

export async function zipArchive(archive: ProjectArchive): Promise<Uint8Array<ArrayBuffer>> {
  const { zip } = await import("fflate");
  const text = (value: unknown) => new TextEncoder().encode(JSON.stringify(value, null, 2) + "\n");
  const files: Record<string, [Uint8Array, { level: number }]> = {
    "manifest.json": [text(archive.manifest), { level: 6 }],
    "project.json": [text(archive.rows), { level: 6 }],
    [`pdf/${archive.rows.project.pdf_sha256}.pdf`]: [archive.pdf, { level: 0 }], // already compressed
  };
  for (const [sha, bytes] of archive.content) files[`content/${sha}`] = [bytes, { level: 6 }];
  return new Promise((resolve, reject) => zip(files as never, (err, data) => (err ? reject(err) : resolve(data as Uint8Array<ArrayBuffer>))));
}

// Reads a file made by `zipArchive`, or says, for the user, why it can't be imported.
export async function unzipArchive(bytes: Uint8Array): Promise<ProjectArchive> {
  const { unzip } = await import("fflate");
  let files: Record<string, Uint8Array>;
  try {
    files = await new Promise((resolve, reject) => unzip(bytes, (err, data) => (err ? reject(err) : resolve(data))));
  } catch {
    throw new Error("The file isn't a score3ly project: it isn't a zip.");
  }
  const json = (name: string) => {
    const file = files[name];
    if (!file) throw new Error(`The file isn't a score3ly project: it has no ${name}.`);
    try {
      return JSON.parse(new TextDecoder().decode(file));
    } catch {
      throw new Error(`The file is damaged: its ${name} can't be read.`);
    }
  };
  const manifest = json("manifest.json") as Manifest;
  if (!EXPORT_FORMATS.includes(manifest.format)) {
    throw new Error(
      typeof manifest.format === "number" && manifest.format > Math.max(...EXPORT_FORMATS)
        ? `The file was exported by a newer version of score3ly (export format ${manifest.format}). Update the app to import it.`
        : `The file's export format (${String(manifest.format)}) isn't one this version of score3ly reads.`,
    );
  }
  const rows = json("project.json") as ProjectRows;
  const pdf = files[`pdf/${rows.project?.pdf_sha256}.pdf`];
  if (!pdf) throw new Error("The file is incomplete: it has no PDF.");
  const content = new Map<string, Uint8Array<ArrayBuffer>>();
  for (const sha of rows.content ?? []) {
    const file = files[`content/${sha}`];
    if (!file) throw new Error("The file is incomplete: some of its content is missing.");
    content.set(sha, file as Uint8Array<ArrayBuffer>);
  }
  return { manifest, rows, pdf: pdf as Uint8Array<ArrayBuffer>, content };
}

// Makes a project's export file from what the Worker stores. `progress` gets a fraction from 0 to 1.
export async function exportProject(project: Project, progress: (fraction: number) => void = () => {}): Promise<Blob> {
  const rows = await fetchExport(project);
  const pdf = await fetchPdf(rows.project.pdf_sha256);
  const content = new Map<string, Uint8Array<ArrayBuffer>>();
  const contentTypes: Record<string, string> = {};
  for (const [i, sha] of rows.content.entries()) {
    const { bytes, contentType } = await fetchContent(sha);
    content.set(sha, bytes);
    contentTypes[sha] = contentType;
    progress((i + 1) / (rows.content.length + 1));
  }
  const manifest: Manifest = {
    format: rows.format,
    app: { version: __APP_VERSION__, commit: __APP_COMMIT__ },
    exportedAt: new Date().toISOString(),
    project: rows.project.name,
    contentTypes,
  };
  const bytes = await zipArchive({ manifest, rows, pdf, content });
  progress(1);
  return new Blob([bytes], { type: "application/zip" });
}

// Stores what an archive needs (the PDF, the content the Worker doesn't have), then imports its rows. Returns the new
// project's id and name.
export async function importArchive(archive: ProjectArchive, progress: (fraction: number) => void = () => {}): Promise<{ id: string; name: string }> {
  const sha = archive.rows.project.pdf_sha256;
  if ((await sha256Hex(archive.pdf)) !== sha) throw new Error("The file is damaged: its PDF doesn't match its hash.");
  await storePdf(sha, archive.pdf);
  const missing = await missingContent([...archive.content.keys()]);
  for (const [i, key] of missing.entries()) {
    await putContent(archive.content.get(key)!, archive.manifest.contentTypes?.[key] ?? "application/octet-stream");
    progress((i + 1) / (missing.length + 1));
  }
  const imported = await importRows(archive.rows);
  progress(1);
  return imported;
}
