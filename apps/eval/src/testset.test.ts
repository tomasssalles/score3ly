import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCandidate, planEngraving } from "./testset.ts";

test("parseCandidate splits piece and method", () => {
  assert.deepEqual(parseCandidate("debussy_clair_de_lune_mutopia.orig_source.ly"), {
    piece: "debussy_clair_de_lune_mutopia",
    method: "orig_source",
    lyName: "debussy_clair_de_lune_mutopia.orig_source.ly",
    pdfName: "debussy_clair_de_lune_mutopia.orig_source.pdf",
  });
});

test("parseCandidate rejects names outside the scheme", () => {
  for (const name of [
    "piece.ly", // no method
    "a.b.c.ly", // dot inside piece or method
    ".method.ly", // empty piece
    "piece..ly", // empty method
    "piece.method.pdf", // not LilyPond
    "piece.orig.ly", // its PDF would be the input score
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
    plan.toEngrave.map((c) => c.lyName),
    ["x.b.ly"],
  );
  assert.deepEqual(
    plan.alreadyEngraved.map((c) => c.lyName),
    ["x.a.ly"],
  );
  assert.deepEqual(plan.invalidNames, ["x.orig.ly"]);
});
