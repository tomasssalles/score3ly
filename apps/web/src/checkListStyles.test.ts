import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { cssRules, rulesFor } from "./cssRules.ts";

// A check list's rows line their texts up on a baseline. An empty box's baseline is its bottom edge, and a box with a
// check or a dash in it takes its content's, so on the baseline the box and the row's height moved whenever the
// selection changed (found 2026-11-09, the project filter of Run times). Measured in Chromium: the box placed at the top
// of the row, centred on the name's first line, stays put. This keeps it off the baseline.
test("a check list's box is placed at the top of its row, not on the baseline, so a change of selection moves nothing", () => {
  const rules = rulesFor(cssRules(join(import.meta.dirname, "styles.css")), ".check-box");
  assert.ok(rules.length > 0, "the check box's rule wasn't found");
  assert.ok(rules.some((r) => /align-self:\s*flex-start/.test(r.body)));
});
