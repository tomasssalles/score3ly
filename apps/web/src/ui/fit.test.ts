import { test } from "node:test";
import assert from "node:assert/strict";
import { largestFitting, splitAtMatch, truncateMiddle } from "./fit.ts";

test("truncateMiddle keeps the start and the end", () => {
  assert.equal(truncateMiddle("abcdefghij", 4), "ab…ij");
  assert.equal(truncateMiddle("abcdefghij", 5), "abc…ij");
  assert.equal(truncateMiddle("abcdefghij", 1), "a…");
  assert.equal(truncateMiddle("abcdefghij", 0), "…");
});

test("truncateMiddle leaves a text alone that is short enough", () => {
  assert.equal(truncateMiddle("abc", 3), "abc");
  assert.equal(truncateMiddle("abc", 10), "abc");
  assert.equal(truncateMiddle("", 0), "");
});

test("truncateMiddle drops spaces next to the ellipsis and never cuts a character in half", () => {
  assert.equal(truncateMiddle("ab cd ef gh", 6), "ab…gh");
  assert.equal(truncateMiddle("🎹🎹🎹🎹🎹", 2), "🎹…🎹");
});

test("largestFitting finds the largest number that fits", () => {
  for (const limit of [0, 1, 7, 99, 100]) {
    assert.equal(largestFitting(100, (n) => n <= limit), limit);
  }
  assert.equal(largestFitting(0, () => true), 0);
});

test("largestFitting needs few tries", () => {
  let tries = 0;
  largestFitting(200, (n) => {
    tries++;
    return n <= 137;
  });
  assert.ok(tries <= 8, `${tries} tries`);
});

test("splitAtMatch splits around the first match, ignoring case", () => {
  assert.deepEqual(splitAtMatch("Sonata in A", "ONA"), ["S", "ona", "ta in A"]);
  assert.deepEqual(splitAtMatch("aXbXc", "x"), ["a", "X", "bXc"]);
});

test("splitAtMatch finds nothing without a query or a match", () => {
  assert.equal(splitAtMatch("Sonata", ""), null);
  assert.equal(splitAtMatch("Sonata", "fugue"), null);
});
