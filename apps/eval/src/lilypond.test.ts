import { test } from "node:test";
import assert from "node:assert/strict";
import { warningLines } from "./lilypond.ts";

test("warningLines keeps only warnings", () => {
  const output = [
    "Processing `x.dev.ly'",
    "Interpreting music...",
    "x.dev.ly:2:14: warning: Bar number is 2; expected 5",
    "{ c4 c c c | ",
    "             \\barNumberCheck #5 c1 }",
    "Success: compilation successfully completed",
    "",
  ].join("\n");
  assert.deepEqual(warningLines(output), ["x.dev.ly:2:14: warning: Bar number is 2; expected 5"]);
});

test("warningLines returns nothing for clean output", () => {
  assert.deepEqual(warningLines("Processing `x.ly'\nSuccess: compilation successfully completed\n"), []);
});

test("warningLines drops ignored warnings", () => {
  const output = [
    "x.ly:242:14: warning: no viable initial configuration found: may not find good beam slope",
    "x.ly:98:3: warning: Bar number is 10; expected 9",
  ].join("\n");
  assert.deepEqual(warningLines(output), ["x.ly:98:3: warning: Bar number is 10; expected 9"]);
  assert.equal(warningLines(output, []).length, 2);
});
