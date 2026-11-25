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

// The import in several requests (docs/database.md, "Exporting and importing a project"; the code review's batch 11, E1:
// one request with a large project's rows took half a second of a Worker's CPU, against the free plan's 10 ms):
// `POST /api/projects/import` with the head (the project, its model configs, stages and pipeline) and the file's key,
// which makes the project, marked `importing`; then the other rows, a table at a time and a chunk at a time,
// `POST /api/projects/<id>/import/rows`; then `POST /api/projects/<id>/import/finish`, which unmarks it. The browser
// asks which content is missing (`POST /api/content/missing`) and uploads it after the head, before the rows: the head
// first removes an unfinished import of the same file, whose content the check must not count on.

// The head of an import. `key`: the SHA-256 of the file's project.json, by which a retry of the same file is recognised.
export type ImportHead = Pick<ProjectExport, "format" | "project" | "model_configs" | "stages" | "pipeline"> & { key: string };

// The tables that follow the head, in the order they go in: the calls before the outputs that name them, the outputs
// before what refers to them.
export const IMPORT_TABLES = ["llm_calls", "outputs", "output_inputs", "stage_inputs", "manual_saves", "image_fingerprints"] as const;
export type ImportTable = (typeof IMPORT_TABLES)[number];
export type ImportChunk = { table: ImportTable; rows: ExportRow[] };

// A chunk's size: small enough that the Worker reads, maps and writes it in a few milliseconds of CPU, and that its rows,
// sent to D1 as one JSON value, stay far within D1's 2 MB per value. A larger row goes alone.
export const IMPORT_CHUNK_BYTES = 150_000;
export const IMPORT_CHUNK_ROWS = 500;

// How many content objects one `POST /api/content/missing` asks about: each is one look into R2, about 0.3 ms of a
// Worker's CPU (E1's measure), so 20 stay well within 10 ms (the owner, 2026-11-24: "stay on the safe side").
export const MISSING_CONTENT_BATCH = 20;

export function importHead(rows: ProjectExport, key: string): ImportHead {
  const { format, project, model_configs, stages, pipeline } = rows;
  return { key, format, project, model_configs, stages, pipeline };
}

// The rows after the head, in chunks, in the order they go in. Outputs come parents first, so that an output's
// parent is always in an earlier chunk or the same one.
export function importChunks(rows: ProjectExport): ImportChunk[] {
  const chunks: ImportChunk[] = [];
  for (const table of IMPORT_TABLES) {
    const list = table === "outputs" ? parentsFirst(rows.outputs) : rows[table];
    let current: ExportRow[] = [];
    let bytes = 0;
    for (const row of list) {
      const size = JSON.stringify(row).length;
      if (current.length > 0 && (bytes + size > IMPORT_CHUNK_BYTES || current.length >= IMPORT_CHUNK_ROWS)) {
        chunks.push({ table, rows: current });
        current = [];
        bytes = 0;
      }
      current.push(row);
      bytes += size;
    }
    if (current.length > 0) chunks.push({ table, rows: current });
  }
  return chunks;
}

// Outputs ordered by how many parents they have above them among these (a manual stage's output corrects another,
// which may correct another), stably.
function parentsFirst(outputs: ExportRow[]): ExportRow[] {
  const byId = new Map(outputs.map((o) => [o.id, o]));
  const depth = new Map<unknown, number>();
  const depthOf = (o: ExportRow, seen = new Set<unknown>()): number => {
    const known = depth.get(o.id);
    if (known !== undefined) return known;
    const parent = o.parent_output_id ? byId.get(o.parent_output_id) : undefined;
    const d = parent && !seen.has(o.id) ? depthOf(parent, seen.add(o.id)) + 1 : 0;
    depth.set(o.id, d);
    return d;
  };
  return outputs.map((o, i) => ({ o, i, d: depthOf(o) })).sort((a, b) => a.d - b.d || a.i - b.i).map(({ o }) => o);
}
