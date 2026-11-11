import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EXPORT_FORMATS, exportName, type ProjectArchive, unzipArchive, zipArchive } from "./projectFile.ts";

const bytes = (text: string) => new TextEncoder().encode(text) as Uint8Array<ArrayBuffer>;

function archive(format = 1): ProjectArchive {
  return {
    manifest: { format, app: { version: "0.1.0", commit: "abc" }, exportedAt: "2026-11-11T00:00:00.000Z", project: "Suite", contentTypes: { ["b".repeat(64)]: "application/json" } },
    rows: { format, project: { name: "Suite", pdf_sha256: "a".repeat(64), pdf_filename: "suite.pdf" }, content: ["b".repeat(64)] },
    pdf: bytes("%PDF"),
    content: new Map([["b".repeat(64), bytes('{"x":1}')]]),
  };
}

test("a project's file: a zip that reads back as it was written", async () => {
  const read = await unzipArchive(await zipArchive(archive()));
  assert.deepEqual(read.manifest, archive().manifest);
  assert.deepEqual(read.rows, archive().rows);
  assert.deepEqual([...read.pdf], [...bytes("%PDF")]);
  assert.deepEqual([...read.content.get("b".repeat(64))!], [...bytes('{"x":1}')]);
  assert.equal(exportName("Bach: Suite"), "Bach_ Suite.s3l");
});

test("a project's file: refused with a reason when it isn't one, is newer, or misses a part", async () => {
  await assert.rejects(unzipArchive(bytes("not a zip")), /isn't a zip/);
  await assert.rejects(unzipArchive(await zipArchive(archive(2))), /newer version of score3ly/);
  const incomplete = archive();
  incomplete.content = new Map();
  await assert.rejects(unzipArchive(await zipArchive(incomplete)), /some of its content is missing/);
});

test("the formats the app reads include the Worker's own", () => {
  const worker = readFileSync(join(import.meta.dirname, "../../worker/src/projectFile.ts"), "utf8");
  const format = Number(/export const EXPORT_FORMAT = (\d+);/.exec(worker)?.[1]);
  assert.ok(EXPORT_FORMATS.includes(format));
});
