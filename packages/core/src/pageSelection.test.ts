import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPages, parsePages, selectPages } from "./pageSelection.ts";

test("pages are read as in a print dialog", () => {
  assert.deepEqual(parsePages("1, 41-43"), { pages: [1, 41, 42, 43] });
  assert.deepEqual(parsePages(" 5,3 , 4–5 ,"), { pages: [3, 4, 5] });
  assert.deepEqual(parsePages(""), { pages: [] });
});

test("anything else is refused with a reason", () => {
  assert.ok("error" in parsePages("a"));
  assert.ok("error" in parsePages("0"));
  assert.ok("error" in parsePages("7-3"));
  assert.ok("error" in parsePages("1-"));
  assert.ok("error" in parsePages("2.5"));
});

test("an empty selection means every page, and pages beyond the PDF are refused", () => {
  assert.deepEqual(selectPages("", 3), { pages: [1, 2, 3] });
  assert.deepEqual(selectPages("2", 3), { pages: [2] });
  assert.deepEqual(selectPages("2-4", 3), { error: "The PDF has 3 pages: there is no page 4." });
});

test("pages are written the shortest way, the same for the same pages", () => {
  assert.equal(formatPages([9, 1, 3, 4, 5, 4]), "1, 3-5, 9");
  assert.equal(formatPages([1, 2]), "1-2");
  assert.equal(formatPages([]), "");
});
