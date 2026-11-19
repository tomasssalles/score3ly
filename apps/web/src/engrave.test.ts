import { test } from "node:test";
import assert from "node:assert/strict";
import type { ApiStage } from "./api.ts";
import { engraveStageKey, latestMei, meiMetadata } from "./engrave.ts";
import { pdfPageCount, withoutDate } from "./engravePage.ts";
import { pdfRecipe } from "./recipes.ts";
import { FIELD_KINDS, metadataOf, newRow, type MetadataRow } from "./fixMetadata.ts";

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

// Taken before the code review's batch 28 moved the key out of runEngrave.ts: the same recipe, the same key.
test("engrave's stage key: the step, its version and the PDF's recipe", async () => {
  assert.equal(await engraveStageKey(pdfRecipe("ab".repeat(32), { pageSize: "a4" })), "b31fe18c55c6eedfd27e1fa6db54c65d40244fc58a3975e1c602f1d083f747eb");
  assert.equal(await engraveStageKey(pdfRecipe("ab".repeat(32), { pageSize: "letter" })), "8d648ea0349be7d8b2379d8575fa90a6228ef678485b996ee1982a8a902d0d2e");
});

// Code review, D26: `meiMetadata` was tested on nothing; here on what `fix_metadata`'s form stores.
test("the MEI's header takes the form's metadata: every field without its page and confidence, the comments too", () => {
  const kind = (id: string) => FIELD_KINDS.find((k) => k.id === id)!;
  const systems = { pageOf: [1, 1, 2] };
  let rows: MetadataRow[] = [];
  const add = (id: string, text: string) => (rows = [...rows, { ...newRow(kind(id), rows, systems), text }]);
  add("title:main", " Kinderscenen ");
  add("person:composer", "Robert Schumann");
  add("piece", "Bittendes Kind");
  add("piece", "");
  add("text:catalogueNumbers", "Op. 15");
  add("text:comments", "Checked against the first edition.");
  add("text:dates", "   "); // empty: not stored
  const stored = JSON.parse(JSON.stringify(metadataOf(rows)));
  assert.deepEqual(meiMetadata(stored), {
    titles: [{ text: "Kinderscenen", type: "main" }],
    people: [{ name: "Robert Schumann", role: "composer" }],
    pieces: [
      { title: "Bittendes Kind", system: 1 },
      { title: "", system: 2 },
    ],
    catalogueNumbers: [{ text: "Op. 15" }],
    dedications: [],
    instrumentation: [],
    compositionDates: [],
    publishers: [],
    places: [],
    dates: [],
    plateNumbers: [],
    notices: [],
    comments: [{ text: "Checked against the first edition." }],
  });
  // `analyze`'s metadata, without `confirmed` or comments, reads the same way.
  const analyzed = { ...stored, pieces: [], comments: undefined, titles: [{ text: "Kinderscenen", type: "main", page: 1, confidence: "high" }] };
  assert.deepEqual(meiMetadata(analyzed).titles, [{ text: "Kinderscenen", type: "main" }]);
  assert.deepEqual(meiMetadata(analyzed).comments, []);
});
