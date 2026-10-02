import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NO_MARKS,
  type Stroke,
  marksName,
  parseMarks,
  serializeMarks,
  withLoaded,
  withStroke,
  withoutLastStroke,
} from "./marks.ts";

function stroke(page: number): Stroke {
  return { page, color: "yellow", width: 0.01, pdfSha256: "abc", points: [[0.5, 0.5]] };
}

test("marksName replaces the .pdf extension", () => {
  assert.equal(marksName("x.orig.pdf"), "x.orig.marks.jsonl");
});

test("undo removes strokes in reverse order across PDFs", () => {
  let marks = withLoaded(NO_MARKS, "a.pdf", [stroke(9)]); // loaded from file: not undoable
  marks = withStroke(marks, "a.pdf", stroke(1));
  marks = withStroke(marks, "b.pdf", stroke(2));
  marks = withStroke(marks, "a.pdf", stroke(3));

  const pages = (m: typeof marks, pdf: string) => (m.byPdf[pdf] ?? []).map((s) => s.page);
  assert.deepEqual(pages(marks, "a.pdf"), [9, 1, 3]);

  let undone = withoutLastStroke(marks)!;
  assert.equal(undone.pdf, "a.pdf");
  assert.deepEqual(pages(undone.marks, "a.pdf"), [9, 1]);

  undone = withoutLastStroke(undone.marks)!;
  assert.equal(undone.pdf, "b.pdf");
  assert.deepEqual(pages(undone.marks, "b.pdf"), []);

  undone = withoutLastStroke(undone.marks)!;
  assert.deepEqual(pages(undone.marks, "a.pdf"), [9]);

  assert.equal(withoutLastStroke(undone.marks), null);
});

test("serializeMarks writes one stroke per line, parseMarks reads them back", () => {
  const strokes = [stroke(1), stroke(2)];
  const text = serializeMarks(strokes);
  assert.equal(text.split("\n").length, 3); // 2 strokes, trailing newline
  assert.deepEqual(parseMarks(text), strokes);
  assert.equal(serializeMarks([]), "");
  assert.deepEqual(parseMarks(""), []);
});
