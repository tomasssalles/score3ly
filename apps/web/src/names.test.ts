import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_NAME_LENGTH, nameProblem } from "./names.ts";

test("a new, non-empty name of allowed length can be saved", () => {
  assert.equal(nameProblem("Sonata, Claude run", "Sonata"), null);
  assert.equal(nameProblem("  Sonata (2)  ", "Sonata"), null);
  assert.equal(nameProblem("x".repeat(MAX_NAME_LENGTH), "Sonata"), null);
});

test("only the case can be changed too", () => {
  assert.equal(nameProblem("sonata", "Sonata"), null);
});

test("empty, too long or unchanged names can't be saved", () => {
  assert.match(nameProblem("   ", "Sonata")!, /empty/);
  assert.match(nameProblem("x".repeat(MAX_NAME_LENGTH + 1), "Sonata")!, /at most 200/);
  // One number at the end isn't counted (decided 2026-11-17): the Worker numbers a 200-character name when it is taken.
  assert.equal(nameProblem(`${"x".repeat(MAX_NAME_LENGTH)} (1)`, "Sonata"), null);
  assert.equal(nameProblem(`${"x".repeat(MAX_NAME_LENGTH)} (999)`, "Sonata"), null);
  assert.match(nameProblem(`${"x".repeat(MAX_NAME_LENGTH)} (1000)`, "Sonata")!, /at most 200/);
  assert.match(nameProblem(`${"x".repeat(MAX_NAME_LENGTH)} (1) (1)`, "Sonata")!, /at most 200/);
  assert.match(nameProblem(" Sonata ", "Sonata")!, /current name/);
});
