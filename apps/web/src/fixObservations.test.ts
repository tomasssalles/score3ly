import { test } from "node:test";
import assert from "node:assert/strict";
import type { Place } from "@score3ly/prompts";
import type { StoredObservations } from "./analyze.ts";
import {
  addStaff,
  changedItems,
  confirmedItems,
  inSystem,
  newRow,
  normalizeObservations,
  OBS_KINDS,
  obsProblem,
  observationsOf,
  positionsIn,
  removeProblem,
  removeStaff,
  rowsOf,
  sectionsOf,
  shownConfidence,
  stavesPickable,
  withPlace,
  type ObsRow,
  type ScoreSystems,
} from "./fixObservations.ts";

const at = (system: number, where: Place["at"], number = 0): Place => ({ system, at: where, number });
const none = { systems: [], changes: [], ottavas: [], specialBarLines: [], endings: [], directions: [], notes: [] };

// Systems 1 and 2 on page 1 (3 bar lines each), 3 and 4 on page 2 (2 bar lines each).
const systems: ScoreSystems = [
  { page: 1, barLines: 3 },
  { page: 1, barLines: 3 },
  { page: 2, barLines: 2 },
  { page: 2, barLines: 2 },
];

// As `analyze` stores them: no `confirmed`.
const analyzed = normalizeObservations({
  score: {
    instrumentation: [{ id: "s1", text: "Piano", confidence: "high" }],
    style: [],
    form: [],
    recurringMaterial: [{ id: "s2", description: "The theme", places: [at(1, "stretch", 1), at(3, "stretch", 2)], confidence: "medium" }],
    notesForTranscription: [],
  },
  pages: [
    {
      page: 1,
      ...none,
      systems: [
        { id: "p1-1", system: 1, staves: 2, instruments: ["right hand", "left hand"], confidence: "high" },
        { id: "p1-2", system: 2, staves: 2, instruments: ["right hand", "left hand"], confidence: "high" },
      ],
      changes: [{ id: "p1-3", kind: "clef", text: "bass", place: at(2, "stretch", 2), staff: { number: 1, of: 2 }, confidence: "low" }],
      ottavas: [{ id: "p1-4", text: "8va", staff: { number: 1, of: 2 }, start: at(1, "stretch", 2), end: at(2, "barLine", 1), confidence: "medium" }],
      notes: [{ id: "p1-5", text: "Two voices", confidence: "medium" }],
    },
    {
      page: 2,
      ...none,
      systems: [{ id: "p2-1", system: 3, staves: 2, instruments: ["", ""], confidence: "high" }],
      endings: [{ id: "p2-2", numbers: "1.", start: null, end: at(3, "barLine", 1), confidence: "high" }],
    },
  ],
});

const rows = rowsOf(analyzed);
const find = (id: string, from = rows) => from.findIndex((r) => r.id === id);
const problem = (result: ObsRow[] | string) => (typeof result === "string" ? result : null);

test("the stored observations and the rows go back and forth; `analyze`'s items aren't confirmed", () => {
  assert.deepEqual(observationsOf(rows, [1, 2]), analyzed);
  assert.ok(rows.every((r) => !r.confirmed));
  assert.equal(shownConfidence(rows[find("p1-3")]), "low");
  assert.equal(analyzed.pages[0].changes[0].confirmed, false);
});

test("the form shows the whole score's items, then page by page", () => {
  const sections = sectionsOf(rows);
  assert.deepEqual(
    sections.map((s) => s.title),
    ["The whole score", "Page 1", "Page 2"],
  );
  assert.deepEqual(
    sections[1].indices.map((i) => rows[i].id),
    ["p1-1", "p1-2", "p1-3", "p1-4", "p1-5"],
  );
});

test("a system's positions, in order; a bar line's kind only at the start, a bar line or the end", () => {
  assert.deepEqual(
    positionsIn(3, 2).map((p) => (p.number ? `${p.at} ${p.number}` : p.at)),
    ["start", "stretch 1", "barLine 1", "stretch 2", "barLine 2", "stretch 3", "end"],
  );
  assert.deepEqual(
    positionsIn(3, 2, true).map((p) => p.at),
    ["start", "barLine", "barLine", "end"],
  );
  // Moved to a system without that position, a place goes to its start.
  assert.deepEqual(inSystem(at(1, "barLine", 3), 3, systems), at(3, "start"));
  assert.deepEqual(inSystem(at(1, "barLine", 2), 3, systems), at(3, "barLine", 2));
});

test("an item moved to a system on another page moves there; a span's other end there becomes open", () => {
  const ottava = rows[find("p1-4")];
  const moved = withPlace(ottava, "start", at(3, "stretch", 1), rows, systems);
  assert.equal(moved.page, 2);
  assert.equal(moved.end, null);
  assert.deepEqual(moved.staff, { number: 1, of: 2 });
  // On a system whose staves aren't given (system 4), it has no staff, and can't be saved.
  const nowhere = withPlace(ottava, "start", at(4, "start"), rows, systems);
  assert.equal(nowhere.staff, null);
  assert.match(obsProblem(nowhere, rows.filter((r) => r.id !== "p1-4"), systems)!, /needs a staff/);
});

test("a span can't end before it starts; staves are given once per system", () => {
  const ottava = rows[find("p1-4")];
  const others = rows.filter((r) => r.id !== "p1-4");
  assert.equal(obsProblem(ottava, others, systems), null);
  assert.match(obsProblem({ ...ottava, end: at(1, "start") }, others, systems)!, /ends before it starts/);
  const second = newRow(OBS_KINDS.find((k) => k.list === "systems")!, rows, systems, [1, 2]);
  assert.equal(second.system, 4); // the first system without staves
  assert.match(obsProblem({ ...second, system: 1 }, rows, systems)!, /given already/);
});

test("a change of a system's number of staves, by hand, must leave the staves named on it agreeing", () => {
  const system2 = rows[find("p1-2")];
  const others = rows.filter((r) => r.id !== "p1-2");
  assert.match(obsProblem({ ...system2, staves: 3 }, others, systems)!, /staff 1\/2 of system 2, which has 3 staves/);
  // The picker is offered only where nothing names its staves.
  assert.equal(stavesPickable(rows, 2, systems), false);
  assert.equal(stavesPickable(rows, 3, systems), true);
});

test("a staff added above or below renumbers what names that system's staves", () => {
  const index = find("p1-2");
  const below = addStaff(rows, index, "below", systems) as ObsRow[];
  // The ottava runs from system 1 to 2: it is in the way.
  assert.match(problem(below)!, /Ottava "8va" runs on from system 2/);
  const without = rows.filter((r) => r.id !== "p1-4");
  const i = find("p1-2", without);
  const added = addStaff(without, i, "above", systems) as ObsRow[];
  assert.equal(added[i].staves, 3);
  assert.equal(added[i].confirmed, true);
  assert.deepEqual(added[i].instruments, ["", "right hand", "left hand"]);
  assert.deepEqual(added[find("p1-3", added)].staff, { number: 2, of: 3 });
  const lower = addStaff(without, i, "below", systems) as ObsRow[];
  assert.deepEqual(lower[find("p1-3", lower)].staff, { number: 1, of: 3 });
  assert.deepEqual(lower[i].instruments, ["right hand", "left hand", ""]);
});

test("the top or bottom staff is removed only when nothing names it", () => {
  const without = rows.filter((r) => r.id !== "p1-4");
  const i = find("p1-2", without);
  assert.match(problem(removeStaff(without, i, "top", systems))!, /Staff 1\/2 of system 2 is named by Clef "bass"/);
  const removed = removeStaff(without, i, "bottom", systems) as ObsRow[];
  assert.equal(removed[i].staves, 1);
  assert.deepEqual(removed[find("p1-3", removed)].staff, { number: 1, of: 1 });
  assert.match(problem(removeStaff(removed, i, "bottom", systems))!, /only one staff/);
});

test("a system's staves can't be removed while something names them", () => {
  assert.match(removeProblem(rows, find("p1-2"), systems)!, /can't be removed/);
  assert.equal(removeProblem(rows, find("p2-1"), systems), null);
});

test("new items are the user's: confirmed, without a confidence, with ids of their own", () => {
  const clef = newRow(OBS_KINDS.find((k) => k.id === "changes:clef")!, rows, systems, [1, 2]);
  assert.equal(clef.id, "u1");
  assert.equal(clef.confidence, null);
  assert.equal(clef.confirmed, true);
  assert.deepEqual(clef.place, at(1, "start"));
  assert.equal(clef.page, 1);
  assert.equal(newRow(OBS_KINDS[0], [...rows, clef], systems, [1, 2]).id, "u2");
});

test("changes are counted by id, confirming isn't one; the confirmed are counted apart", () => {
  const confirmed = rows.map((r) => (r.id === "p1-3" ? { ...r, confirmed: true } : r));
  assert.equal(changedItems(analyzed, observationsOf(confirmed, [1, 2])), 0);
  assert.equal(confirmedItems(observationsOf(confirmed, [1, 2])), 1);
  const edited = rows.map((r) => (r.id === "p1-3" ? { ...r, text: "treble" } : r)).filter((r) => r.id !== "p1-5");
  const added = newRow(OBS_KINDS[0], edited, systems, [1, 2]);
  const after: StoredObservations = observationsOf([...edited, { ...added, text: "Romantic" }], [1, 2]);
  assert.equal(changedItems(analyzed, after), 3);
});
