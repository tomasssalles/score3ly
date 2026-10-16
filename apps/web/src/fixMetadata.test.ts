import { test } from "node:test";
import assert from "node:assert/strict";
import {
  changedFields,
  confirmedFields,
  FIELD_KINDS,
  fixNote,
  metadataOf,
  newRow,
  normalizeMetadata,
  pieceProblem,
  rowsOf,
  sectionsOf,
  shownConfidence,
  takenSystems,
  withKind,
  withSystem,
  type MetadataRow,
  type Systems,
} from "./fixMetadata.ts";

const analyzed = normalizeMetadata({
  titles: [{ text: "Kinderscenen", type: "main", page: 1, confidence: "high" }],
  people: [
    { name: "R. Schumann", role: "composer", page: 1, confidence: "high" },
    // An older `analyze` stored the role as printed too.
    { name: "Clara Schumann", role: "editor", printedRole: "Herausgegeben von", page: 1, confidence: "medium" },
  ],
  pieces: [
    { title: "Träumerei", system: 30, page: 9, confidence: "high" },
    { title: "Von fremden Ländern", system: 1, page: 2, confidence: "high" },
  ],
  dates: [{ text: "1839", page: 1, confidence: "low" }],
});

// 40 systems, 4 on each of pages 1 to 10.
const systems: Systems = { pageOf: Array.from({ length: 40 }, (_, i) => Math.floor(i / 4) + 1) };
const kind = (label: string) => FIELD_KINDS.find((k) => k.label === label)!;
const row = (kind: string, text: string, extra: Partial<MetadataRow> = {}): MetadataRow => ({
  kind,
  text,
  system: null,
  page: null,
  confidence: null,
  confirmed: true,
  ...extra,
});

test("stored metadata from an older version gets the lists it lacks, and loses the printed role", () => {
  assert.deepEqual(analyzed.compositionDates, []);
  assert.deepEqual(analyzed.comments, []);
  assert.deepEqual(analyzed.people[1], { name: "Clara Schumann", role: "editor", page: 1, confidence: "medium", confirmed: false });
});

test("`analyze`'s fields aren't confirmed; a confirmed field shows as confirmed and keeps the model's confidence", () => {
  const [title] = rowsOf(analyzed);
  assert.equal(shownConfidence(title), "high");
  const confirmed = { ...title, confirmed: true };
  assert.equal(shownConfidence(confirmed), "confirmed");
  assert.equal(metadataOf([confirmed]).titles[0].confidence, "high");
  assert.equal(shownConfidence(newRow(kind("Comment"), [], systems)), "confirmed");
});

test("the rows and the stored metadata go back and forth, empty fields dropped and pieces by their system", () => {
  const rows = rowsOf(analyzed);
  assert.equal(rows.length, 6);
  const m = metadataOf([...rows, row("text:comments", "  ")]);
  assert.deepEqual(m.comments, []);
  assert.deepEqual(
    m.pieces.map((p) => p.system),
    [1, 30],
  );
  assert.deepEqual(m.titles, analyzed.titles);
  assert.deepEqual(m.people, analyzed.people);
  // A piece without a title still says where it starts.
  assert.equal(metadataOf([row("piece", "", { system: 12, page: 3 })]).pieces.length, 1);
});

test("the sections come in their order, each with its kinds in theirs", () => {
  const rows: MetadataRow[] = [row("text:comments", "x"), ...rowsOf(analyzed), row("person:arranger", "A")];
  const sections = sectionsOf(rows);
  assert.deepEqual(
    sections.map((s) => s.title),
    ["Titles", "Work", "Arrangement", "Pieces or movements", "Edition", "Comment"],
  );
  assert.deepEqual(
    sections[3].indices.map((i) => rows[i].system),
    [1, 30],
  );
  assert.deepEqual(
    sections[4].indices.map((i) => rows[i].kind),
    ["person:editor", "text:dates"],
  );
});

test("a field becomes any other kind, keeping its text; as a piece, at the first free system and on its page", () => {
  const rows = rowsOf(analyzed);
  const composer = rows[1];
  assert.deepEqual(withKind(composer, kind("Editor"), rows, 1, systems), { ...composer, kind: "person:editor" });
  assert.deepEqual(withKind(composer, kind("Subtitle"), rows, 1, systems), { ...composer, kind: "title:subtitle" });
  // Systems 1 and 30 start pieces: 2 is the first free one, on page 1.
  assert.deepEqual(withKind(composer, kind("Piece or movement"), rows, 1, systems), { ...composer, kind: "piece", system: 2, page: 1 });
  // A piece that becomes something else keeps its page.
  const piece = rows.find((r) => r.system === 30)!;
  assert.deepEqual(withKind(piece, kind("Title"), rows, rows.indexOf(piece), systems), { ...piece, kind: "title:main", system: null });
  // With every system taken, a new piece has none, and can't be saved.
  const full: Systems = { pageOf: [1] };
  const made = newRow(kind("Piece or movement"), [row("piece", "", { system: 1 })], full);
  assert.equal(made.system, null);
  assert.match(pieceProblem(made, [])!, /Every system/);
});

test("a piece moved to another system takes its page; taken systems are those of the other pieces", () => {
  const rows = rowsOf(analyzed);
  const i = rows.findIndex((r) => r.system === 30);
  assert.deepEqual(withSystem(rows[i], 13, systems).page, 4);
  assert.deepEqual([...takenSystems(rows, i)], [1]);
  assert.match(pieceProblem({ ...rows[i], system: 1 }, rows)!, /Another piece/);
  assert.equal(pieceProblem(withSystem(rows[i], 13, systems), rows.filter((_, j) => j !== i)), null);
});

test("an edit, an addition and a removal each count as one changed field; confirming doesn't count", () => {
  const rows = rowsOf(analyzed);
  const allConfirmed = metadataOf(rows.map((r) => ({ ...r, confirmed: true })));
  assert.equal(changedFields(analyzed, allConfirmed), 0);
  assert.equal(confirmedFields(allConfirmed), 6);
  assert.equal(confirmedFields(analyzed), 0);
  const edited = rows.map((r, i) => (i === 1 ? { ...r, text: "Robert Schumann" } : r));
  assert.equal(changedFields(analyzed, metadataOf(edited)), 1);
  assert.equal(changedFields(analyzed, metadataOf([...edited, row("text:comments", "For my students")])), 2);
  assert.equal(changedFields(analyzed, metadataOf(rows.slice(1))), 1);
  const moved = rows.map((r) => (r.kind === "text:dates" ? { ...r, page: 2 } : r));
  assert.equal(changedFields(analyzed, metadataOf(moved)), 1);
});

test("the card's note", () => {
  assert.equal(fixNote(0, 0), "no changes");
  assert.equal(fixNote(2, 5), "2 changed · 5 confirmed");
  assert.equal(fixNote(0, 5), "5 confirmed");
  assert.equal(fixNote(1, 0), "1 changed");
});
