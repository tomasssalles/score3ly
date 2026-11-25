import { test } from "node:test";
import assert from "node:assert/strict";
import { OUTCOMES } from "@score3ly/core";
import { OUTCOME_LABELS } from "./outcomes.ts";

// The code review's F17: Usage's reasons and Costs' call statuses are one table, total over `Outcome`: every outcome the
// Worker can send has its label, and no label is left for one it can't; no two outcomes read alike.
test("the outcome labels: one for every outcome, none more, all different", () => {
  assert.deepEqual(Object.keys(OUTCOME_LABELS).sort(), [...OUTCOMES].sort());
  const labels = Object.values(OUTCOME_LABELS);
  assert.equal(new Set(labels).size, labels.length);
});
