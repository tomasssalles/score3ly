import { test } from "node:test";
import assert from "node:assert/strict";
import type { ApiStage } from "./api.ts";
import { latestMei, meiNote, pdfPageCount, withoutDate } from "./engrave.ts";

const stage = (step: string, status: ApiStage["status"], outputs: { id: string; type: string; sha: string }[] = []): ApiStage =>
  ({
    id: step,
    step,
    status,
    outputs: outputs.map((o) => ({ id: o.id, item: "", type: o.type, contentSha256: o.sha, recipeKey: null, recipe: null })),
  }) as ApiStage;

test("engrave takes the latest MEI: Fix MEI's right before it, once finished, else Build MEI's", () => {
  const built = stage("build_mei", "done", [{ id: "x", type: "mei", sha: "3".repeat(64) }]);
  const touches = stage("fix_mei", "done", [
    { id: "b", type: "mei_base", sha: "1".repeat(64) },
    { id: "m", type: "mei", sha: "2".repeat(64) },
  ]);
  assert.deepEqual(latestMei([stage("extract", "done"), built]), { id: "x", sha256: "3".repeat(64), step: "build_mei" });
  assert.deepEqual(latestMei([stage("extract", "done"), built, touches]), { id: "m", sha256: "2".repeat(64), step: "fix_mei" });
  assert.deepEqual(latestMei([built, { ...touches, status: "wip" }]), { missing: "\"Fix MEI\" isn't finished yet." });
  assert.deepEqual(latestMei([stage("extract", "done")]), { missing: "the MEI hasn't been built yet." });
});

test("the PDF has no date, its offsets kept: the same recipe gives the same bytes", () => {
  const text = "%PDF-1.3\n1 0 obj\n<< /Producer (jsPDF) /CreationDate (D:20261103120000+01'00') >>\nendobj\n";
  const out = new TextDecoder("latin1").decode(withoutDate(new TextEncoder().encode(text) as Uint8Array<ArrayBuffer>));
  assert.equal(out.length, text.length);
  assert.ok(!out.includes("CreationDate") && !out.includes("2026"));
  assert.ok(out.includes("<< /Producer (jsPDF)"));
  assert.equal(pdfPageCount("<< /Type /Pages /Kids [3 0 R 5 0 R] >> << /Type /Page >> << /Type /Page /Parent 2 0 R >>"), 2);
});

test("an edited MEI's result: its pieces and measures, a multi-measure rest counting each", () => {
  const mei = [
    '<mdiv xml:id="piece-1" n="1">',
    '  <measure xml:id="p1m1" n="1">',
    '  <measure xml:id="p1m2-s1t2" n="2">',
    '  <measure xml:id="p1m2-s1t3" n="2">',
    '  <measure xml:id="p1m3" n="3–5">',
    '<mdiv xml:id="piece-2" n="2">',
    '  <measure xml:id="p2m1" n="1">',
  ].join("\n");
  assert.equal(meiNote(mei), "2 pieces · 6 measures");
  assert.equal(meiNote('<mdiv n="1">\n<measure n="1">'), "1 measure");
});
