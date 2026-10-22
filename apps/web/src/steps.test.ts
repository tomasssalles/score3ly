import { test } from "node:test";
import assert from "node:assert/strict";
import { fixOffered, STEPS } from "./steps.ts";
import type { ApiStage } from "./api.ts";

// Every step's kind, as it was declared. A step's kind never changes (DESIGN.md §5.8): add new steps here, but
// never edit an entry.
const KINDS: Record<string, string> = {
  ingest: "ingest",
  rasterize: "computed",
  skew_analysis: "computed",
  layout: "llm",
  analyze: "llm",
  extract: "llm",
  engrave: "computed",
  fix_skew: "manual",
  fix_layout: "manual",
  fix_metadata: "manual",
  fix_observations: "manual",
  fix_mei: "manual",
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

test("Fix MEI is offered only after the latest stage that produces the extraction", () => {
  const stage = (step: string) => ({ step }) as ApiStage;
  assert.ok(STEPS.extract.fixes.includes("fix_mei"));
  assert.equal(fixOffered("fix_mei", [stage("engrave")]), true);
  assert.equal(fixOffered("fix_mei", [stage("extract"), stage("engrave")]), false);
  assert.equal(fixOffered("fix_layout", [stage("extract")]), true);
});
