import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// A planned stage's card holds a "⋮" menu (Show details, Change config). Opacity on the card itself dims the open menu
// too and puts it under the next card (opacity makes the card a layer of its own, with the menu inside it): found
// 2026-11-02, "Change config" on a planned card couldn't be clicked. So a card with a menu is dimmed part by part.
test("a planned card isn't dimmed as a whole, which would dim and cover its open menu", () => {
  const css = readFileSync(join(import.meta.dirname, "styles.css"), "utf8");
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selectors: m[1].split(",").map((s) => s.trim()), body: m[2] }));
  const dimmed = rules.filter((r) => r.selectors.includes(".stage-card.planned") && /(^|[;\s])opacity\s*:/.test(r.body));
  assert.deepEqual(dimmed.map((r) => r.selectors.join(", ")), []);
});
