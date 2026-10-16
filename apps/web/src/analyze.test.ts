import { test } from "node:test";
import assert from "node:assert/strict";
import { stavesProblem, type PageObservations, type ScoreAnswer } from "@score3ly/prompts";
import { analyzeNote, combineObservations, pageItems, pageResultsForScore, piecesOf, placeLabel, type PageAnalysis } from "./analyze.ts";

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
    observations: { ...noObservations(), notes: [{ text: "Two voices", confidence: "high" }] },
  };
  const [result] = pageResultsForScore([page]) as { metadata: { titles: unknown[] }; observations: { notes: unknown[] } }[];
  assert.deepEqual(result.metadata.titles, [{ text: "Träumerei", type: "main", confidence: "medium", page: 3 }]);
  assert.deepEqual(result.observations.notes, [{ id: "p3-1", text: "Two voices", confidence: "high" }]);
});

const noObservations = <Extra = object>(): PageObservations<Extra> => ({
  systems: [],
  changes: [],
  ottavas: [],
  specialBarLines: [],
  endings: [],
  directions: [],
  notes: [],
});
const at = (system: number, at: "start" | "barLine" | "stretch" | "end", number = 0) => ({ system, at, number });

// Page 1 with systems 1 and 2; page 2 with system 3.
const pages: PageAnalysis[] = [
  {
    page: 1,
    systems: [1, 2],
    metadata: emptyMetadata,
    observations: {
      ...noObservations(),
      specialBarLines: [
        { kind: "final", place: at(2, "end"), confidence: "high" }, // p1-1
        { kind: "startRepeat", place: at(1, "barLine", 2), confidence: "low" }, // p1-2
      ],
      endings: [{ numbers: "1.", start: at(2, "barLine", 3), end: null, confidence: "medium" }], // p1-3
    },
  },
  {
    page: 2,
    systems: [3],
    metadata: emptyMetadata,
    observations: { ...noObservations(), endings: [{ numbers: "1.", start: null, end: at(3, "barLine", 1), confidence: "medium" }] }, // p2-1
  },
];

const answer = (overrides: Partial<ScoreAnswer> = {}): ScoreAnswer => ({
  metadata: { ...emptyMetadata, pieces: [] } as ScoreAnswer["metadata"],
  corrections: noObservations(),
  removals: [],
  additions: noObservations(),
  score: { instrumentation: [], style: [{ text: "romantic", confidence: "high" }], form: [], recurringMaterial: [], notesForTranscription: [] },
  ...overrides,
});

test("the pages' items are known by id, with their list and page", () => {
  const items = pageItems(pages);
  assert.deepEqual(items.get("p1-3"), { list: "endings", page: 1 });
  assert.deepEqual(items.get("p2-1"), { list: "endings", page: 2 });
  assert.equal(items.size, 4);
});

test("the observations become one document: corrected, removed and added items, and the whole score's", () => {
  const stored = combineObservations(
    pages,
    answer({
      corrections: { ...noObservations(), specialBarLines: [{ id: "p1-2", kind: "startRepeat", place: at(1, "start"), confidence: "high" }] },
      removals: ["p2-1"],
      additions: { ...noObservations(), directions: [{ page: 2, text: "Fine", place: at(3, "end"), confidence: "medium" }] },
    }),
  );
  // A corrected item keeps its id; the list is in the score's order.
  assert.deepEqual(stored.pages[0].specialBarLines, [
    { id: "p1-2", kind: "startRepeat", place: at(1, "start"), confidence: "high" },
    { id: "p1-1", kind: "final", place: at(2, "end"), confidence: "high" },
  ]);
  // The ending open at the end of page 1 stays open; its other part on page 2 was removed.
  assert.equal(stored.pages[0].endings[0].end, null);
  assert.deepEqual(stored.pages[1].endings, []);
  assert.deepEqual(stored.pages[1].directions, [{ id: "a1", text: "Fine", place: at(3, "end"), confidence: "medium" }]);
  assert.deepEqual(stored.score.style, [{ id: "s1", text: "romantic", confidence: "high" }]);
});

test("a correction that changes a system's staves leaves the staves named on it disagreeing, as the run checks", () => {
  const page: PageAnalysis = {
    page: 1,
    systems: [1],
    metadata: emptyMetadata,
    observations: {
      ...noObservations(),
      systems: [{ system: 1, staves: 2, instruments: [], confidence: "high" }], // p1-1
      ottavas: [{ text: "8va", staff: { number: 1, of: 2 }, start: at(1, "stretch", 1), end: null, confidence: "high" }], // p1-2
    },
  };
  assert.equal(stavesProblem(page.observations, [1]), null);
  const corrections = { ...noObservations<{ id: string }>(), systems: [{ id: "p1-1", system: 1, staves: 3, instruments: [], confidence: "high" as const }] };
  const [stored] = combineObservations([page], answer({ corrections })).pages;
  assert.match(stavesProblem(stored, [1])!, /staff 1\/2 of system 1, which has 3 staves/);
});

test("places by name", () => {
  assert.equal(placeLabel(at(17, "start")), "system 17, start");
  assert.equal(placeLabel(at(17, "barLine", 4)), "system 17, bar line 4");
  assert.equal(placeLabel(at(17, "stretch", 3)), "system 17, stretch 3");
  assert.equal(placeLabel(at(17, "end")), "system 17, end");
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
