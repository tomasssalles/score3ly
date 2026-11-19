// One table of items through `analyze`'s checks and its forms' (code review, D10): what the model may give, a person
// may save unchanged, and the other way round.

import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPageAnswer, flatMetadata, flatObservations, PAGE_LISTS, TEXT_FIELDS, withIds, type Place } from "@score3ly/prompts";
import * as fixMetadata from "./fixMetadata.ts";
import * as fixObservations from "./fixObservations.ts";

const at = (system: number, where: Place["at"], number = 0): Place => ({ system, at: where, number });

// Page 1 with systems 1 and 2, three bar lines each, two staves each.
const systems: fixObservations.ScoreSystems = [
  { page: 1, barLines: 3 },
  { page: 1, barLines: 3 },
];
const context = { systems: new Map(systems.map((s, i) => [i + 1, { barLines: s.barLines, page: s.page }])) };
const staves = [1, 2].map((system) => ({ system, staves: 2, instruments: ["", ""], confidence: "high" }));
const emptyLists = () => Object.fromEntries(PAGE_LISTS.map((list) => [list, []])) as Record<string, object[]>;
const emptyMetadata = () => ({ titles: [], people: [], pieces: [], ...Object.fromEntries(TEXT_FIELDS.map((f) => [f, []])) });

// An item of the observations: whether analyze uses a page with it, and whether the form saves it as it is.
function observation(list: "ottavas" | "endings", item: object): { analyze: boolean; form: boolean } {
  const lists = { ...emptyLists(), systems: staves, [list]: [{ ...item, confidence: "high" }] };
  const answer = { metadata: flatMetadata(emptyMetadata() as never), observations: flatObservations(lists as never) };
  const stored = { score: { instrumentation: [], style: [], form: [], recurringMaterial: [], notesForTranscription: [] }, pages: [{ page: 1, ...withIds(1, lists as never) }] };
  const rows = fixObservations.rowsOf(fixObservations.normalizeObservations(stored));
  const i = rows.findIndex((r) => r.list === list);
  return {
    analyze: !("problem" in checkPageAnswer(answer, context)),
    form: fixObservations.obsProblem(rows[i], rows.filter((_, j) => j !== i), systems) === null,
  };
}

// Pieces at these systems: whether analyze uses a page with them, and whether the form saves the last as it is.
function pieces(at: number[]): { analyze: boolean; form: boolean } {
  const metadata = { ...emptyMetadata(), pieces: at.map((system, i) => ({ title: `No. ${i + 1}`, system, confidence: "high" })) };
  const answer = { metadata: flatMetadata(metadata as never), observations: flatObservations({ ...emptyLists(), systems: staves } as never) };
  const rows = fixMetadata.rowsOf(fixMetadata.normalizeMetadata({ ...metadata, pieces: metadata.pieces.map((p) => ({ ...p, page: 1 })) }));
  const last = rows.length - 1;
  return {
    analyze: !("problem" in checkPageAnswer(answer, context)),
    form: fixMetadata.pieceProblem(rows[last], rows.slice(0, last)) === null,
  };
}

const TABLE: { what: string; verdict: () => { analyze: boolean; form: boolean }; used: boolean }[] = [
  { what: "an ending from bar line 2 to bar line 3", verdict: () => observation("endings", { numbers: "1.", start: at(1, "barLine", 2), end: at(1, "barLine", 3) }), used: true },
  { what: "an ending at one bar line", verdict: () => observation("endings", { numbers: "1.", start: at(1, "barLine", 2), end: at(1, "barLine", 2) }), used: true },
  { what: "an ending open at its end", verdict: () => observation("endings", { numbers: "1.", start: at(2, "barLine", 1), end: null }), used: true },
  { what: "an ending open at its start", verdict: () => observation("endings", { numbers: "2.", start: null, end: at(1, "barLine", 1) }), used: true },
  { what: "an ending from bar line 3 back to bar line 2", verdict: () => observation("endings", { numbers: "1.", start: at(1, "barLine", 3), end: at(1, "barLine", 2) }), used: false },
  { what: "an ottava from system 2 back to system 1", verdict: () => observation("ottavas", { text: "8va", staff: { number: 1, of: 2 }, start: at(2, "stretch", 1), end: at(1, "end") }), used: false },
  { what: "an ottava ending at its system's start", verdict: () => observation("ottavas", { text: "8va", staff: { number: 1, of: 2 }, start: at(1, "stretch", 1), end: at(1, "start") }), used: false },
  { what: "an ottava over two systems", verdict: () => observation("ottavas", { text: "8va", staff: { number: 1, of: 2 }, start: at(1, "stretch", 4), end: at(2, "stretch", 1) }), used: true },
  { what: "pieces at systems 1 and 2", verdict: () => pieces([1, 2]), used: true },
  { what: "two pieces at system 1", verdict: () => pieces([1, 1]), used: false },
  { what: "two pieces at system 2 after one at 1", verdict: () => pieces([2, 1, 2]), used: false },
];

test("analyze's checks and the forms accept and refuse the same items", () => {
  for (const { what, verdict, used } of TABLE) {
    assert.deepEqual(verdict(), { analyze: used, form: used }, what);
  }
});
