// Exporting and importing a project (docs/database.md, "Exporting and importing a project"): the rows the Worker hands
// out (`GET /api/projects/<id>/export`) and takes back in (`POST /api/projects/import`), and their format's version.

// The export format's own version (`format` in the file, its manifest's and its rows'), apart from the app's: raised
// when an export can't be read the same way any more. Only this format is read (decided 2026-11-17: no reader for old
// formats).
export const EXPORT_FORMAT = 1;

// A row of a table, as stored (its columns by name).
export type ExportRow = Record<string, unknown>;

// What an export holds, besides the PDF and the content, which the browser fetches.
export type ProjectExport = {
  format: number;
  // name, pdf_sha256, pdf_filename, run_mode, next_issue_number and the times
  project: ExportRow & { name: string; pdf_sha256: string; pdf_filename: string };
  pipeline: ExportRow[]; // position, stage_id, carried
  stages: ExportRow[];
  outputs: ExportRow[];
  output_inputs: ExportRow[];
  stage_inputs: ExportRow[];
  llm_calls: ExportRow[];
  model_configs: ExportRow[];
  manual_saves: ExportRow[];
  image_fingerprints: ExportRow[];
  content: string[]; // every content object the rows refer to, by SHA-256 (outputs, calls' requests and responses)
};

// An imported project: the new one's id and name.
export type Imported = { id: string; name: string };

// Why a file of this export format can't be read here, for the user, or null.
export function formatProblem(format: unknown): string | null {
  if (format === EXPORT_FORMAT) return null;
  return typeof format === "number" && format > EXPORT_FORMAT
    ? `The file was exported by a newer version of score3ly (export format ${format}). Update the app to import it.`
    : `The file's export format (${String(format)}) isn't one this version of score3ly reads.`;
}
