import { test } from "node:test";
import assert from "node:assert/strict";
import { isDroppable, RECIPE, STEP_IDS, STEP_KINDS, stepsOfKind } from "./steps.ts";

// Every step's kind, as it was declared. A step's kind never changes (docs/database.md): add new steps here, but
// never edit an entry.
const KINDS: Record<string, string> = {
  ingest: "ingest",
  rasterize: "computed",
  skew_analysis: "computed",
  layout: "llm",
  analyze: "llm",
  extract: "llm",
  review: "llm",
  apply_review: "llm",
  build_mei: "computed",
  engrave: "computed",
  fix_skew: "manual",
  fix_layout: "manual",
  fix_metadata: "manual",
  fix_observations: "manual",
  human_review: "manual",
  fix_mei: "manual",
};

test("no step's kind ever changes", () => {
  assert.deepEqual(STEP_KINDS, KINDS);
});

test("the steps of a kind, and the recipe", () => {
  // As the Worker listed them before they were derived from the kinds.
  assert.deepEqual(stepsOfKind("llm"), ["layout", "analyze", "extract", "review", "apply_review"]);
  assert.deepEqual(stepsOfKind("manual"), ["fix_skew", "fix_layout", "fix_metadata", "fix_observations", "human_review", "fix_mei"]);
  assert.deepEqual(stepsOfKind("ingest"), ["ingest"]);
  assert.equal(RECIPE[0], "ingest");
  for (const step of RECIPE) assert.notEqual(STEP_KINDS[step], "manual", step);
});

test("the steps in the order of a pipeline, each manual one after the step it fixes", () => {
  // As the Run times tab listed them before they were derived from the kinds.
  assert.deepEqual(STEP_IDS, [
    "ingest",
    "rasterize",
    "skew_analysis",
    "fix_skew",
    "layout",
    "fix_layout",
    "analyze",
    "fix_metadata",
    "fix_observations",
    "extract",
    "review",
    "apply_review",
    "human_review",
    "build_mei",
    "fix_mei",
    "engrave",
  ]);
});

test("a manual stage and a further review can be dropped; the recipe's stages can't", () => {
  for (const step of STEP_IDS) {
    assert.equal(isDroppable({ step, inRecipe: true }), STEP_KINDS[step] === "manual", step);
    assert.equal(isDroppable({ step, inRecipe: false }), STEP_KINDS[step] === "manual" || step === "review", step);
  }
  assert.equal(isDroppable({ step: "unknown", inRecipe: false }), false);
});
