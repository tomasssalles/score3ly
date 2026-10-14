import { test } from "node:test";
import assert from "node:assert/strict";
import { STEPS } from "./steps.ts";

// Every step's kind, as it was declared. A step's kind never changes (DESIGN.md §5.8): add new steps here, but
// never edit an entry.
const KINDS: Record<string, string> = {
  ingest: "ingest",
  rasterize: "computed",
  skew_analysis: "computed",
  layout: "llm",
  analyze: "llm",
  fix_skew: "manual",
  fix_layout: "manual",
};

test("no step's kind ever changes", () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(STEPS).map(([id, info]) => [id, info.kind])),
    KINDS,
  );
});

test("rasterize's config is checked against the PDF's page count before it is saved", () => {
  const { check } = STEPS.rasterize.config!;
  assert.equal(check({ pages: "1-3", dpi: 300 }, { pageCount: 3 }), null);
  assert.equal(check({ pages: "2, 5", dpi: 300 }, { pageCount: 3 }), "The PDF has 3 pages: there is no page 5.");
  // Unknown page count: only the config itself is checked.
  assert.equal(check({ pages: "5", dpi: 300 }, { pageCount: null }), null);
  assert.notEqual(check({ pages: "5", dpi: 10 }, { pageCount: null }), null);
});
