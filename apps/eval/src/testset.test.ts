import { test } from "node:test";
import assert from "node:assert/strict";
import { listPieces, parseCandidate, planEngraving } from "./testset.ts";

test("parseCandidate splits piece and method", () => {
  assert.deepEqual(parseCandidate("debussy_clair_de_lune_mutopia.orig_source.ly"), {
    piece: "debussy_clair_de_lune_mutopia",
    method: "orig_source",
    format: "ly",
    sourceName: "debussy_clair_de_lune_mutopia.orig_source.ly",
    pdfName: "debussy_clair_de_lune_mutopia.orig_source.pdf",
  });
});

test("parseCandidate rejects names outside the scheme", () => {
  for (const name of [
    "piece.ly", // no method
    "a.b.c.ly", // dot inside piece or method
    ".method.ly", // empty piece
    "piece..ly", // empty method
    "piece.method.pdf", // not LilyPond or MusicXML
    "piece.orig.ly", // its PDF would be the input score
    "piece.orig.musicxml",
  ]) {
    assert.equal(parseCandidate(name), null, name);
  }
});

test("planEngraving skips candidates that already have a PDF", () => {
  const plan = planEngraving([
    "x.orig.pdf",
    "x.b.ly",
    "x.a.ly",
    "x.a.pdf",
    "x.orig.ly",
    "README.md",
  ]);
  assert.deepEqual(
    plan.toEngrave.map((c) => c.sourceName),
    ["x.b.ly"],
  );
  assert.deepEqual(
    plan.alreadyEngraved.map((c) => c.sourceName),
    ["x.a.ly"],
  );
  assert.deepEqual(plan.invalidNames, ["x.orig.ly"]);
  assert.deepEqual(plan.conflicts, []);
});

test("parseCandidate accepts MusicXML", () => {
  assert.deepEqual(parseCandidate("x.newzik.musicxml"), {
    piece: "x",
    method: "newzik",
    format: "musicxml",
    sourceName: "x.newzik.musicxml",
    pdfName: "x.newzik.pdf",
  });
});

test("planEngraving sets aside candidates that would share a PDF", () => {
  const plan = planEngraving(["x.a.ly", "x.a.musicxml", "x.b.musicxml", "x.c.musicxml", "x.c.pdf"]);
  assert.deepEqual(
    plan.toEngrave.map((c) => c.sourceName),
    ["x.b.musicxml"],
  );
  assert.deepEqual(
    plan.alreadyEngraved.map((c) => c.sourceName),
    ["x.c.musicxml"],
  );
  assert.deepEqual(
    plan.conflicts.map((c) => c.sourceName),
    ["x.a.ly", "x.a.musicxml"],
  );
});

test("listPieces groups PDFs by piece", () => {
  assert.deepEqual(
    listPieces(["b.orig.pdf", "a.y.pdf", "a.orig.pdf", "a.x.pdf", "a.x.ly", "c.x.pdf", "README.md"]),
    [
      { name: "a", hasOrig: true, methods: ["x", "y"] },
      { name: "b", hasOrig: true, methods: [] },
      { name: "c", hasOrig: false, methods: ["x"] },
    ],
  );
});
