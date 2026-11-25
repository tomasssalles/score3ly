import { test } from "node:test";
import assert from "node:assert/strict";
import { sha256Hex, type ProjectExport } from "@score3ly/core";
import { exportName, importArchive, type ProjectArchive, unzipArchive, zipArchive } from "./projectFile.ts";

const bytes = (text: string) => new TextEncoder().encode(text) as Uint8Array<ArrayBuffer>;

function archive(format = 1): ProjectArchive {
  return {
    manifest: { format, app: { version: "0.1.0", commit: "abc" }, exportedAt: "2026-11-11T00:00:00.000Z", project: "Suite", contentTypes: { ["b".repeat(64)]: "application/json" } },
    rows: { format, project: { name: "Suite", pdf_sha256: "a".repeat(64), pdf_filename: "suite.pdf" }, content: ["b".repeat(64)] } as unknown as ProjectExport,
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

// Taken before the code review's batch 31 moved the zipping to files.ts: the entries, their order, bytes and
// compression (8: deflated, 0: stored, the PDF), as the export wrote them.
test("a project's file: its entries, in order, the PDF stored and the rest deflated", async () => {
  const { unzipSync } = await import("fflate");
  const entries: [string, number][] = [];
  const files = unzipSync(await zipArchive(archive()), { filter: (f) => (entries.push([f.name, f.compression]), true) });
  assert.deepEqual(entries, [
    ["manifest.json", 8],
    ["project.json", 8],
    [`pdf/${"a".repeat(64)}.pdf`, 0],
    [`content/${"b".repeat(64)}`, 8],
  ]);
  assert.equal(new TextDecoder().decode(files["manifest.json"]), JSON.stringify(archive().manifest, null, 2) + "\n");
  assert.equal(new TextDecoder().decode(files["project.json"]), JSON.stringify(archive().rows, null, 2) + "\n");
});

// The code review's E7: a zip's entries aren't checked by fflate (no CRC check), so an object damaged in the file was
// stored under its new hash while the rows named the old one, and the project failed later. Refused before anything
// is sent.
test("a project's file: an object that doesn't match its hash is refused before anything is stored", async () => {
  const sent: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    sent.push(String(input));
    throw new Error("nothing should be sent");
  }) as typeof fetch;
  try {
    const damaged = archive();
    damaged.rows.project.pdf_sha256 = await sha256Hex(damaged.pdf);
    const sha = await sha256Hex(bytes('{"x":1}'));
    damaged.rows.content = [sha];
    damaged.content = new Map([[sha, bytes('{"x":2}')]]);
    await assert.rejects(importArchive(damaged), /^Error: The file is damaged: some of its content doesn't match its hash\.$/);
    assert.deepEqual(sent, []);
  } finally {
    globalThis.fetch = realFetch;
  }
});
