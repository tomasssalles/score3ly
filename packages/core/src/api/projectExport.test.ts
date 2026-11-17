import { test } from "node:test";
import assert from "node:assert/strict";
import { EXPORT_FORMAT, formatProblem } from "./projectExport.ts";

test("only the export format of this version is read; a newer one asks for an update", () => {
  assert.equal(formatProblem(EXPORT_FORMAT), null);
  assert.equal(formatProblem(EXPORT_FORMAT + 1), `The file was exported by a newer version of score3ly (export format ${EXPORT_FORMAT + 1}). Update the app to import it.`);
  assert.equal(formatProblem(0), "The file's export format (0) isn't one this version of score3ly reads.");
  assert.equal(formatProblem(undefined), "The file's export format (undefined) isn't one this version of score3ly reads.");
});
