import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeNote, pageResultsForScore, type PageAnalysis } from "./analyze.ts";

const emptyMetadata = {
  titles: [],
  people: [],
  pieces: [],
  catalogueNumbers: [],
  dedications: [],
  instrumentation: [],
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
