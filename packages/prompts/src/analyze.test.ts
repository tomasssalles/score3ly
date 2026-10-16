import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ANALYZE_PAGE_SCHEMA,
  ANALYZE_SCORE_SCHEMA,
  checkPageAnswer,
  checkScoreAnswer,
  PAGE_LISTS,
  TEXT_FIELDS,
  withIds,
  type AnalyzeContext,
  type PageObservations,
} from "./analyze.ts";

const emptyMetadata = () => ({
  titles: [],
  people: [],
  pieces: [],
  ...Object.fromEntries(TEXT_FIELDS.map((f) => [f, []])),
});

const emptyLists = () => Object.fromEntries(PAGE_LISTS.map((list) => [list, []])) as unknown as PageObservations;

const at = (system: number, at: string, number = 0) => ({ system, at, number });

const observations = (overrides: Record<string, unknown> = {}) => ({
  systems: [
    { system: 5, staves: 2, instruments: ["piano right hand", "piano left hand"], confidence: "high" },
    { system: 6, staves: 2, instruments: ["piano right hand", "piano left hand"], confidence: "high" },
  ],
  changes: [{ kind: "key", text: "G major", place: at(5, "start"), staff: null, confidence: "high" }],
  ottavas: [{ text: "8va", staff: { number: 1, of: 2 }, start: at(6, "stretch", 2), end: null, confidence: "medium" }],
  specialBarLines: [{ kind: "endRepeat", place: at(6, "barLine", 4), confidence: "high" }],
  endings: [{ numbers: "1.", start: at(6, "barLine", 3), end: at(6, "barLine", 4), confidence: "high" }],
  directions: [],
  notes: [{ text: "Two voices in the right hand", confidence: "medium" }],
  ...overrides,
});

const page = (overrides: Record<string, unknown> = {}) => ({
  metadata: { ...emptyMetadata(), titles: [{ text: "Kinderscenen", type: "main", confidence: "high" }] },
  observations: observations(overrides),
});

// Systems 5 and 6 are on page 2, with 4 bar lines each.
const context: AnalyzeContext = {
  systems: new Map([
    [5, { barLines: 4, page: 2 }],
    [6, { barLines: 4, page: 2 }],
  ]),
};
const problem = (answer: unknown) => (answer as { problem: string }).problem;

test("a page's answer whose places are all on the page is used", () => {
  assert.ok(!("problem" in checkPageAnswer(page(), context)));
});

test("the start and the end of a system are numbered 0, whatever the model gave", () => {
  const checked = checkPageAnswer(page({ specialBarLines: [{ kind: "final", place: at(6, "end", 5), confidence: "high" }] }), context);
  assert.deepEqual((checked as { observations: PageObservations }).observations.specialBarLines[0].place, at(6, "end"));
});

test("a page's answer naming a system, a bar line or a stretch that isn't there can't be used", () => {
  const direction = (place: object) => page({ directions: [{ text: "Fine", place, confidence: "high" }] });
  assert.equal(problem(checkPageAnswer(direction(at(9, "end")), context)), '"Fine": there is no system 9');
  assert.equal(problem(checkPageAnswer(direction(at(6, "barLine", 5)), context)), '"Fine": system 6 has no bar line 5 (it has 4)');
  assert.equal(problem(checkPageAnswer(direction(at(6, "barLine", 0)), context)), '"Fine": system 6 has no bar line 0 (it has 4)');
  // Four bar lines make five stretches.
  assert.ok(!("problem" in checkPageAnswer(direction(at(6, "stretch", 5)), context)));
  assert.equal(problem(checkPageAnswer(direction(at(6, "stretch", 6)), context)), '"Fine": system 6 has no stretch 6 (it has 5)');
});

test("a special bar line is never in a stretch, and a staff is one of its system's", () => {
  const inStretch = page({ specialBarLines: [{ kind: "double", place: at(5, "stretch", 1), confidence: "high" }] });
  assert.match(problem(checkPageAnswer(inStretch, context)), /double bar line is in system 5, stretch 1, not at a bar line/);
  const clef = (staff: object) => page({ changes: [{ kind: "clef", text: "bass", place: at(5, "stretch", 2), staff, confidence: "low" }] });
  assert.ok(!("problem" in checkPageAnswer(clef({ number: 2, of: 2 }), context)));
  assert.match(problem(checkPageAnswer(clef({ number: 3, of: 2 }), context)), /no staff 3\/2/);
});

test("a staff k/n names a system whose staves are reported, n of them", () => {
  const clef = (system: number, of: number) =>
    page({ changes: [{ kind: "clef", text: "bass", place: at(system, "start"), staff: { number: 1, of }, confidence: "high" }] });
  assert.match(problem(checkPageAnswer(clef(5, 3), context)), /staff 1\/3 of system 5, which has 2 staves/);
  const unreported = { ...page(), observations: { ...observations(), systems: [observations().systems[0]], ottavas: [] } };
  unreported.observations.changes = clef(6, 2).observations.changes;
  assert.match(problem(checkPageAnswer(unreported, context)), /system 6, whose staves aren't reported/);
  // An ottava through the whole page is on every system of the page.
  const through = page({ ottavas: [{ text: "8va", staff: { number: 1, of: 2 }, start: null, end: null, confidence: "high" }] });
  assert.ok(!("problem" in checkPageAnswer(through, context)));
  const twice = page({ systems: [...observations().systems, observations().systems[0]] });
  assert.match(problem(checkPageAnswer(twice, context)), /system 5 is reported twice/);
});

test("a spanning item may be open at either end, or both", () => {
  const ending = (start: object | null, end: object | null) => page({ endings: [{ numbers: "2.", start, end, confidence: "high" }] });
  assert.ok(!("problem" in checkPageAnswer(ending(null, at(5, "barLine", 2)), context)));
  assert.ok(!("problem" in checkPageAnswer(ending(null, null), context)));
});

test("an answer of the wrong form can't be used", () => {
  const wrongKind = checkPageAnswer(page({ specialBarLines: [{ kind: "single", place: at(6, "barLine", 4), confidence: "high" }] }), context);
  assert.match(problem(wrongKind), /specialBarLines\[0\]\.kind isn't one of/);
  const noConfidence = checkPageAnswer(page({ notes: [{ text: "x" }] }), context);
  assert.match(problem(noConfidence), /notes\[0\]\.confidence/);
  assert.ok("problem" in checkPageAnswer({ metadata: {} }, context));
});

test("a page's items are numbered through its lists", () => {
  const numbered = withIds(7, observations() as unknown as PageObservations);
  assert.equal(numbered.systems[0].id, "p7-1");
  assert.equal(numbered.changes[0].id, "p7-3");
  assert.equal(numbered.notes[0].id, "p7-7");
});

// The whole score: systems 1 and 2 on page 1, 5 and 6 on page 2; items p2-1 (a system) and p2-2 (a change).
const full: AnalyzeContext = {
  systems: new Map([
    [1, { barLines: 3, page: 1 }],
    [2, { barLines: 3, page: 1 }],
    [5, { barLines: 4, page: 2 }],
    [6, { barLines: 4, page: 2 }],
  ]),
  pages: [1, 2],
  items: new Map([
    ["p2-1", { list: "systems", page: 2 }],
    ["p2-2", { list: "changes", page: 2 }],
  ]),
};

const score = (overrides: Record<string, unknown> = {}) => ({
  metadata: {
    ...emptyMetadata(),
    titles: [{ text: "Kinderscenen", type: "main", confidence: "high", page: 1 }],
    pieces: [{ title: "Von fremden Ländern und Menschen", system: 1, confidence: "high", page: 1 }],
  },
  corrections: emptyLists(),
  removals: [],
  additions: emptyLists(),
  score: { instrumentation: [], style: [{ text: "romantic", confidence: "medium" }], form: [], recurringMaterial: [], notesForTranscription: [] },
  ...overrides,
});
const change = (system: number, extra = {}) => ({ kind: "key", text: "D major", place: at(system, "start"), staff: null, confidence: "high", ...extra });

test("the whole score's answer names pages among the pages, and pieces start at systems that exist", () => {
  assert.ok(!("problem" in checkScoreAnswer(score(), full)));
  const piece = { title: "x", system: 7, confidence: "high", page: 1 };
  assert.match(problem(checkScoreAnswer(score({ metadata: { ...emptyMetadata(), pieces: [piece] } }), full)), /starts at system 7/);
  const title = { text: "x", type: "main", confidence: "high", page: 3 };
  assert.match(problem(checkScoreAnswer(score({ metadata: { ...emptyMetadata(), titles: [title] } }), full)), /page 3/);
});

test("corrections and removals name items that exist, corrections in their own list and on their own page", () => {
  const corrected = (list: string, item: object) => score({ corrections: { ...emptyLists(), [list]: [item] } });
  assert.ok(!("problem" in checkScoreAnswer(corrected("changes", { id: "p2-2", ...change(6) }), full)));
  assert.match(problem(checkScoreAnswer(corrected("changes", { id: "p2-9", ...change(6) }), full)), /p2-9, which doesn't exist/);
  assert.match(problem(checkScoreAnswer(corrected("directions", { id: "p2-2", text: "Fine", place: at(6, "end"), confidence: "high" }), full)), /one of the changes/);
  assert.match(problem(checkScoreAnswer(corrected("changes", { id: "p2-2", ...change(1) }), full)), /system 1 isn't on page 2/);
  assert.ok(!("problem" in checkScoreAnswer(score({ removals: ["p2-1"] }), full)));
  assert.match(problem(checkScoreAnswer(score({ removals: ["p1-1"] }), full)), /p1-1, which doesn't exist/);
});

test("additions are on one of the pages, their places on that page", () => {
  const added = (item: object) => score({ additions: { ...emptyLists(), changes: [item] } });
  assert.ok(!("problem" in checkScoreAnswer(added({ page: 1, ...change(2) }), full)));
  assert.match(problem(checkScoreAnswer(added({ page: 2, ...change(2) }), full)), /system 2 isn't on page 2/);
  assert.match(problem(checkScoreAnswer(added({ page: 4, ...change(2) }), full)), /page 4, which isn't one of the pages/);
});

test("the schemas require every property and allow no others (for structured output)", () => {
  const walk = (schema: Record<string, unknown>) => {
    if (Array.isArray(schema.anyOf)) (schema.anyOf as Record<string, unknown>[]).forEach(walk);
    if (schema.type === "object") {
      assert.equal(schema.additionalProperties, false);
      assert.deepEqual(schema.required, Object.keys(schema.properties as object));
      Object.values(schema.properties as Record<string, Record<string, unknown>>).forEach(walk);
    }
    if (schema.type === "array") walk(schema.items as Record<string, unknown>);
  };
  walk(ANALYZE_PAGE_SCHEMA);
  walk(ANALYZE_SCORE_SCHEMA);
});
