import { test } from "node:test";
import assert from "node:assert/strict";
import { EXPORT_FORMAT, formatProblem, IMPORT_CHUNK_BYTES, IMPORT_CHUNK_ROWS, IMPORT_TABLES, importChunks, type ProjectExport } from "./projectExport.ts";

test("only the export format of this version is read; a newer one asks for an update", () => {
  assert.equal(formatProblem(EXPORT_FORMAT), null);
  assert.equal(formatProblem(EXPORT_FORMAT + 1), `The file was exported by a newer version of score3ly (export format ${EXPORT_FORMAT + 1}). Update the app to import it.`);
  assert.equal(formatProblem(0), "The file's export format (0) isn't one this version of score3ly reads.");
  assert.equal(formatProblem(undefined), "The file's export format (undefined) isn't one this version of score3ly reads.");
});

test("an import's rows go in chunks: a table at a time in order, outputs parents first, each chunk within its size", () => {
  const big = "x".repeat(40_000);
  const rows = {
    outputs: [
      { id: "c", parent_output_id: "b" },
      { id: "b", parent_output_id: "a" },
      { id: "a", parent_output_id: null },
      { id: "d", parent_output_id: "gone" },
    ],
    output_inputs: Array.from({ length: IMPORT_CHUNK_ROWS + 1 }, (_, i) => ({ output_id: `o${i}`, input_id: "a" })),
    image_fingerprints: Array.from({ length: 5 }, (_, i) => ({ recipe_key: `k${i}`, thumbnail: big })),
    llm_calls: [{ id: "call" }],
    stage_inputs: [],
    manual_saves: [],
  } as unknown as ProjectExport;
  const chunks = importChunks(rows);
  assert.deepEqual([...new Set(chunks.map((c) => c.table))], IMPORT_TABLES.filter((t) => (rows[t] as unknown[]).length > 0));
  assert.deepEqual(chunks.find((c) => c.table === "outputs")!.rows.map((o) => o.id), ["a", "d", "b", "c"]);
  assert.deepEqual(chunks.filter((c) => c.table === "output_inputs").map((c) => c.rows.length), [IMPORT_CHUNK_ROWS, 1]);
  const prints = chunks.filter((c) => c.table === "image_fingerprints");
  assert.deepEqual(prints.map((c) => c.rows.length), [3, 2]);
  for (const c of chunks) assert.ok(c.rows.length === 1 || JSON.stringify(c.rows).length <= IMPORT_CHUNK_BYTES + 100);
});
