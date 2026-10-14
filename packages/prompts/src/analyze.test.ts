import { test } from "node:test";
import assert from "node:assert/strict";
import { ANALYZE_PAGE_SCHEMA, checkPageAnswer, checkScoreAnswer, TEXT_FIELDS } from "./analyze.ts";

const emptyMetadata = (withPage = false) => ({
  titles: [],
  people: [],
  pieces: [],
  ...Object.fromEntries(TEXT_FIELDS.map((f) => [f, []])),
  ...(withPage ? {} : {}),
});

const page = (overrides: Record<string, unknown> = {}) => ({
  metadata: { ...emptyMetadata(), titles: [{ text: "Kinderscenen", type: "main", confidence: "high" }] },
  observations: {
    systems: [{ system: 5, staves: 2, instruments: ["piano right hand", "piano left hand"] }],
    changes: [{ system: 5, barLine: 0, kind: "key", text: "G major" }],
    specialBarLines: [{ system: 6, barLine: 4, kind: "endRepeat" }],
    endings: [{ numbers: "1.", start: { system: 6, barLine: 3 }, end: { system: 6, barLine: 4 }, fromPreviousPage: false, toNextPage: false }],
    directions: [],
    notes: "",
    ...overrides,
  },
});

// Systems 5 and 6 are on the page, with 4 bar lines each.
const context = { systems: new Map([[5, 4], [6, 4]]) };

test("a page's answer whose places are all on the page is used", () => {
  assert.ok(!("problem" in checkPageAnswer(page(), context)));
});

test("a page's answer naming a system that isn't on the page, or a bar line a system doesn't have, can't be used", () => {
  const otherSystem = checkPageAnswer(page({ directions: [{ system: 9, barLine: 1, text: "Fine" }] }), context);
  assert.deepEqual(otherSystem, { problem: '"Fine": there is no system 9 here' });
  const noBarLine = checkPageAnswer(page({ specialBarLines: [{ system: 6, barLine: 5, kind: "final" }] }), context);
  assert.deepEqual(noBarLine, { problem: "a final bar line: system 6 has no bar line 5 (it has 4)" });
});

test("an answer of the wrong form can't be used", () => {
  const wrongKind = checkPageAnswer(page({ specialBarLines: [{ system: 6, barLine: 4, kind: "single" }] }), context);
  assert.match((wrongKind as { problem: string }).problem, /specialBarLines\[0\]\.kind isn't one of/);
  assert.ok("problem" in checkPageAnswer({ metadata: {} }, context));
});

test("the whole score's answer names pages among the pages, and pieces start at systems that exist", () => {
  const score = (pieceSystem: number, titlePage: number) => ({
    metadata: {
      ...emptyMetadata(),
      titles: [{ text: "Kinderscenen", type: "main", confidence: "high", page: titlePage }],
      pieces: [{ title: "Von fremden Ländern und Menschen", system: pieceSystem, confidence: "high", page: 2 }],
    },
    observations: { instrumentation: "piano", style: "romantic", form: "", repeats: [], recurringMaterial: [], notesForExtraction: "" },
  });
  const full = { systems: new Map([[1, 3], [2, 3], [5, 4]]), pages: [1, 2] };
  assert.ok(!("problem" in checkScoreAnswer(score(1, 1), full)));
  assert.match((checkScoreAnswer(score(7, 1), full) as { problem: string }).problem, /starts at system 7/);
  assert.match((checkScoreAnswer(score(1, 3), full) as { problem: string }).problem, /page 3/);
});

test("the schemas require every property and allow no others (for structured output)", () => {
  const walk = (schema: Record<string, unknown>) => {
    if (schema.type === "object") {
      assert.equal(schema.additionalProperties, false);
      assert.deepEqual(schema.required, Object.keys(schema.properties as object));
      Object.values(schema.properties as Record<string, Record<string, unknown>>).forEach(walk);
    }
    if (schema.type === "array") walk(schema.items as Record<string, unknown>);
  };
  walk(ANALYZE_PAGE_SCHEMA);
});
