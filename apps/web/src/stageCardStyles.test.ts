import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { cssRules, rulesFor } from "./cssRules.ts";

// A planned stage's card holds a "⋮" menu (Show details, Change config). Opacity on the card itself dims the open menu
// too and puts it under the next card (opacity makes the card a layer of its own, with the menu inside it): found
// 2026-11-02, "Change config" on a planned card couldn't be clicked. So a card with a menu is dimmed part by part.
test("a planned card isn't dimmed as a whole, which would dim and cover its open menu", () => {
  const rules = rulesFor(cssRules(join(import.meta.dirname, "styles/stages.css")), ".stage-card.planned");
  assert.ok(rules.length > 0, "the planned card's rule wasn't found");
  assert.deepEqual(rules.filter((r) => /(^|[;\s])opacity\s*:/.test(r.body)).map((r) => r.body), []);
});
