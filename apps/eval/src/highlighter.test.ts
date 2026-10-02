import { test } from "node:test";
import assert from "node:assert/strict";
import { colorValue } from "./highlighter.ts";

test("colorValue looks up names and falls back to grey", () => {
  assert.equal(colorValue("yellow"), "#ffec1a");
  const grey = colorValue("no such colour");
  assert.equal(colorValue("#ffeb3b"), grey); // raw values are not names
  assert.equal(colorValue("constructor"), grey); // not fooled by object properties
});
