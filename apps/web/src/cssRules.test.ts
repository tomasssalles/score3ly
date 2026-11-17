import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCss, rulesFor } from "./cssRules.ts";

test("a style sheet's rules: comments dropped, selectors split, at-rules read with what they hold", () => {
  const rules = parseCss(`
@import url("x.css");
/* A comment, with commas, and { braces } in it */
.a, .b > .c {
  color: var(--ink);
}
@media (max-width: 480px) {
  .a { opacity: 0.5; }
}
@keyframes spin { to { transform: rotate(360deg); } }
.d{}`);
  assert.deepEqual(rules, [
    { selectors: [".a", ".b > .c"], body: "color: var(--ink);", within: [] },
    { selectors: [".a"], body: "opacity: 0.5;", within: ["@media (max-width: 480px)"] },
    { selectors: [".d"], body: "", within: [] },
  ]);
  assert.equal(rulesFor(rules, ".a").length, 2);
  assert.equal(rulesFor(rules, ".b").length, 0);
});
