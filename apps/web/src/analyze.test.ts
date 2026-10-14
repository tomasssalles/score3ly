import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeNote, pageResultsForScore, piecesOf, type PageAnalysis } from "./analyze.ts";

const emptyMetadata = {
  titles: [],
  people: [],
  pieces: [],
  catalogueNumbers: [],
  dedications: [],
  instrumentation: [],
  compositionDates: [],
  publishers: [],
  places: [],
  dates: [],
  plateNumbers: [],
  notices: [],
};

test("the whole-score call reads every page's metadata items with their page", () => {
  const page: PageAnalysis = {
    page: 3,
    systems: [5, 6],
    metadata: { ...emptyMetadata, titles: [{ text: "Träumerei", type: "main", confidence: "medium" }] },
    observations: { systems: [], changes: [], specialBarLines: [], endings: [], directions: [], notes: "" },
  };
  const [result] = pageResultsForScore([page]) as { metadata: { titles: unknown[] } }[];
  assert.deepEqual(result.metadata.titles, [{ text: "Träumerei", type: "main", confidence: "medium", page: 3 }]);
});

test("the note counts pages, and pieces when there are several", () => {
  assert.equal(analyzeNote(1, 0), "1 page");
  assert.equal(analyzeNote(12, 1), "12 pages");
  assert.equal(analyzeNote(22, 13), "22 pages · 13 pieces");
});

test("the pieces start at their systems, ascending, each once, the first always at system 1", () => {
  const piece = (system: number) => ({ title: "", system, confidence: "high" as const, page: 1 });
  assert.deepEqual(piecesOf({ pieces: [] }), [1]);
  assert.deepEqual(piecesOf({ pieces: [piece(14), piece(1), piece(30), piece(14)] }), [1, 14, 30]);
  assert.deepEqual(piecesOf({ pieces: [piece(30), piece(5)] }), [1, 5, 30]);
});
