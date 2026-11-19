// Files the app hands to the user: saving one, naming it after the project, zipping several (`engrave`'s downloads,
// docs/stages/engrave.md, "Downloads"; a project's export, docs/database.md, "Exporting and importing a project").

// A file name from the project's name: what a file system would refuse is replaced.
export function fileBase(projectName: string): string {
  return projectName.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").trim() || "score";
}

// The downloads' names (docs/stages/engrave.md, "Downloads"): the project's name, then what the file is. Not `.s3l`,
// which is a project's export (docs/database.md, "Exporting and importing a project").
const DOWNLOAD_SUFFIXES = { zip: "score3ly-bundle.zip", mei: "score3ly-source.mei", pdf: "score3ly-render.pdf", "report.json": "score3ly-report.json" } as const;

export function downloadName(projectName: string, kind: keyof typeof DOWNLOAD_SUFFIXES): string {
  return `${fileBase(projectName)}.${DOWNLOAD_SUFFIXES[kind]}`;
}

// The bundle's files (`engrave`'s "Bundle (.zip)"): the MEI, the PDF (stored: it is compressed already) and the report.
export function bundleFiles(projectName: string, files: { mei: Uint8Array; pdf: Uint8Array; report: Uint8Array }): Record<string, [Uint8Array, { level: 0 | 6 }]> {
  return {
    [downloadName(projectName, "mei")]: [files.mei, { level: 6 }],
    [downloadName(projectName, "pdf")]: [files.pdf, { level: 0 }],
    [downloadName(projectName, "report.json")]: [files.report, { level: 6 }],
  };
}

// Hands a file to the browser to save.
export function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// A zip of the files, in the order given, each at its compression level (0 for what is already compressed, a PDF).
export async function zipFiles(files: Record<string, [Uint8Array, { level: 0 | 6 }]>): Promise<Uint8Array<ArrayBuffer>> {
  const { zip } = await import("fflate");
  return new Promise((resolve, reject) => zip(files, (err, data) => (err ? reject(err) : resolve(data as Uint8Array<ArrayBuffer>))));
}
