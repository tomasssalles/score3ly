import { test } from "node:test";
import assert from "node:assert/strict";
import { firstFreeName, MAX_NAME_LENGTH, nameTooLong } from "./names.ts";

test("firstFreeName numbers taken names, ignoring case", () => {
  assert.equal(firstFreeName("Sonata", []), "Sonata");
  assert.equal(firstFreeName("Sonata", ["sonata"]), "Sonata (1)");
  assert.equal(firstFreeName("Sonata", ["Sonata", "Sonata (1)", "Sonata (3)"]), "Sonata (2)");
  assert.equal(firstFreeName("Sonata", ["Sonata (1)"]), "Sonata");
  // A name that is numbered already gets a number of its own, like a file manager's copy of "Sonata (1).pdf".
  assert.equal(firstFreeName("Sonata (1)", ["Sonata (1)"]), "Sonata (1) (1)");
});

test("names are at most 200 characters without one number at the end", () => {
  const base = "x".repeat(MAX_NAME_LENGTH);
  assert.ok(!nameTooLong(base));
  assert.ok(!nameTooLong(`${base} (1)`));
  assert.ok(!nameTooLong(`${base} (999)`));
  assert.ok(nameTooLong(`${base}x`));
  assert.ok(nameTooLong(`${base} (1000)`));
  assert.ok(nameTooLong(`${base} (1) (1)`));
  assert.ok(nameTooLong(`${base}(1)`));
});

test("a numbered name always fits: the base cut to 200 characters, and further from (1000) on", () => {
  const base = "x".repeat(MAX_NAME_LENGTH);
  assert.equal(firstFreeName(base, [base]), `${base} (1)`);
  assert.equal(firstFreeName(`${base}yyy`, []), base);
  assert.equal(firstFreeName(`${base}yyy`, [base]), `${base} (1)`);
  const taken = [base, ...Array.from({ length: 999 }, (_, i) => `${base} (${i + 1})`)];
  const thousandth = firstFreeName(base, taken);
  assert.equal(thousandth, `${"x".repeat(MAX_NAME_LENGTH - 7)} (1000)`);
  assert.ok(!nameTooLong(thousandth));
  // A name whose own number puts it over 200 is kept when free; numbered again, its stem is cut.
  const numbered = `${base} (12)`;
  assert.equal(firstFreeName(numbered, []), numbered);
  const again = firstFreeName(numbered, [numbered]);
  assert.ok(!nameTooLong(again), again);
  assert.equal(again, `${base} (1)`);
});
