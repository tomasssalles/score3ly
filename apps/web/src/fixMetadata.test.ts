import { test } from "node:test";
import assert from "node:assert/strict";
import {
  changedFields,
  confirmAll,
  FIELD_KINDS,
  fixMetadataNote,
  metadataOf,
  normalizeMetadata,
  pieceProblem,
  rowsOf,
  sectionsOf,
  withKind,
  type MetadataRow,
} from "./fixMetadata.ts";

const analyzed = normalizeMetadata({
  titles: [{ text: "Kinderscenen", type: "main", page: 1, confidence: "high" }],
  people: [
    { name: "R. Schumann", role: "composer", printedRole: "", page: 1, confidence: "high" },
    { name: "Clara Schumann", role: "editor", printedRole: "Herausgegeben von", page: 1, confidence: "medium" },
  ],
  pieces: [
    { title: "Träumerei", system: 30, page: 9, confidence: "high" },
    { title: "Von fremden Ländern", system: 1, page: 2, confidence: "high" },
  ],
  dates: [{ text: "1839", page: 1, confidence: "low" }],
});

test("stored metadata from an older version gets the lists it lacks", () => {
  assert.deepEqual(analyzed.compositionDates, []);
  assert.deepEqual(analyzed.comments, []);
});

test("the rows and the stored metadata go back and forth, empty fields dropped and pieces by their system", () => {
  const rows = rowsOf(analyzed);
  assert.equal(rows.length, 6);
  const empty: MetadataRow = { kind: "text", field: "comments", text: "  ", page: null, confidence: "confirmed" };
  const m = metadataOf([...rows, empty]);
  assert.deepEqual(m.comments, []);
  assert.deepEqual(
    m.pieces.map((p) => p.system),
    [1, 30],
  );
  assert.deepEqual(m.titles, analyzed.titles);
});

test("finishing confirms every field", () => {
  const all = rowsOf(confirmAll(analyzed));
  assert.ok(all.every((r) => r.confidence === "confirmed"));
});

test("the sections come in their order, each with its kinds in theirs", () => {
  const rows: MetadataRow[] = [
    { kind: "text", field: "comments", text: "x", page: null, confidence: "confirmed" },
    ...rowsOf(analyzed),
    { kind: "person", role: "arranger", name: "A", printedRole: "", page: null, confidence: "confirmed" },
  ];
  const sections = sectionsOf(rows);
  assert.deepEqual(
    sections.map((s) => s.title),
    ["Titles", "Work", "Arrangement", "Pieces or movements", "Edition", "Comment"],
  );
  // The pieces by their system; the editor before the date.
  const pieces = sections[3].indices.map((i) => rows[i]);
  assert.deepEqual(
    pieces.map((p) => (p.kind === "piece" ? p.system : null)),
    [1, 30],
  );
  const edition = sections[4].indices.map((i) => rows[i].kind);
  assert.deepEqual(edition, ["person", "text"]);
});

test("a piece needs a system that exists and starts no other piece", () => {
  const rows = rowsOf(analyzed);
  const piece = (system: number | null): MetadataRow => ({ kind: "piece", title: "", system, page: null, confidence: "confirmed" });
  assert.match(pieceProblem(piece(null), rows, 40)!, /needs the system/);
  assert.match(pieceProblem(piece(41), rows, 40)!, /no system 41/);
  assert.match(pieceProblem(piece(0), rows, 40)!, /no system 0/);
  assert.match(pieceProblem(piece(NaN), rows, 40)!, /is a number/);
  assert.match(pieceProblem(piece(30), rows, 40)!, /Another piece/);
  assert.equal(pieceProblem(piece(12), rows, 40), null);
});

test("a field can become another of its sort, keeping what was typed", () => {
  const composer: MetadataRow = { kind: "person", role: "composer", name: "R. Schumann", printedRole: "", page: 1, confidence: "high" };
  const arranger = FIELD_KINDS.find((k) => k.label === "Arranger")!;
  assert.deepEqual(withKind(composer, arranger), { ...composer, role: "arranger" });
  const date: MetadataRow = { kind: "text", field: "dates", text: "1838", page: 1, confidence: "low" };
  const composed = FIELD_KINDS.find((k) => k.label === "Composition date")!;
  assert.deepEqual(withKind(date, composed), { ...date, field: "compositionDates" });
});

test("an edit, an addition and a removal each count as one changed field; confidence doesn't count", () => {
  const rows = rowsOf(analyzed);
  assert.equal(changedFields(analyzed, confirmAll(analyzed)), 0);
  const edited = rows.map((r, i) => (i === 1 && r.kind === "person" ? { ...r, name: "Robert Schumann" } : r));
  assert.equal(changedFields(analyzed, metadataOf(edited)), 1);
  const added: MetadataRow = { kind: "text", field: "comments", text: "Transcribed for my students", page: null, confidence: "confirmed" };
  assert.equal(changedFields(analyzed, metadataOf([...edited, added])), 2);
  assert.equal(changedFields(analyzed, metadataOf(rows.slice(1))), 1);
  const moved = rows.map((r) => (r.kind === "text" ? { ...r, page: 2 } : r));
  assert.equal(changedFields(analyzed, metadataOf(moved)), 1);
});

test("the card's note", () => {
  assert.equal(fixMetadataNote(0), "no changes");
  assert.equal(fixMetadataNote(1), "1 field changed");
  assert.equal(fixMetadataNote(3), "3 fields changed");
});
