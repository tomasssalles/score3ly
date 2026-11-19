import { test } from "node:test";
import assert from "node:assert/strict";
import { bundleFiles, downloadName, zipFiles } from "./files.ts";

test("the downloads' names: the project's name, then what the file is, never `.s3l` (an export's)", () => {
  assert.equal(downloadName("Bach: Suite 1/2", "zip"), "Bach_ Suite 1_2.score3ly-bundle.zip");
  assert.equal(downloadName("x", "mei"), "x.score3ly-source.mei");
  assert.equal(downloadName("x", "pdf"), "x.score3ly-render.pdf");
  assert.equal(downloadName("x", "report.json"), "x.score3ly-report.json");
  assert.equal(downloadName("  ", "zip"), "score.score3ly-bundle.zip");
});

// Code review, batch 31: the bundle as `download` zipped it before `zipFiles` (the MEI, the PDF stored, the report).
test("the bundle: its files in order, named after the project, the PDF stored", async () => {
  const { unzipSync } = await import("fflate");
  const bytes = (text: string) => new TextEncoder().encode(text);
  const entries: [string, number][] = [];
  const files = unzipSync(await zipFiles(bundleFiles("Bach: Suite", { mei: bytes("<mei/>"), pdf: bytes("%PDF"), report: bytes("{}") })), {
    filter: (f) => (entries.push([f.name, f.compression]), true),
  });
  assert.deepEqual(entries, [
    ["Bach_ Suite.score3ly-source.mei", 8],
    ["Bach_ Suite.score3ly-render.pdf", 0],
    ["Bach_ Suite.score3ly-report.json", 8],
  ]);
  assert.deepEqual(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, new TextDecoder().decode(v)])), {
    "Bach_ Suite.score3ly-source.mei": "<mei/>",
    "Bach_ Suite.score3ly-render.pdf": "%PDF",
    "Bach_ Suite.score3ly-report.json": "{}",
  });
});
