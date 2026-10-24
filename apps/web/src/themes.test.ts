import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveTheme, THEMES } from "./themes.ts";

test("Auto follows the system's preference where a theme matches it, else the first theme", () => {
  assert.equal(resolveTheme("auto", true).id, "dark");
  assert.equal(resolveTheme("auto", false).id, THEMES.find((t) => !t.dark)?.id ?? THEMES[0].id);
  assert.equal(resolveTheme("dark", false).id, "dark");
  assert.equal(resolveTheme("no such theme", true).id, THEMES[0].id);
});

test("every theme in the list has a block in themes.css with every token the first one has", () => {
  const css = readFileSync(join(import.meta.dirname, "themes.css"), "utf8");
  const blocks = [...css.matchAll(/:root\[data-theme="([\w-]+)"\]\s*\{([^}]*)\}/g)].map((m) => ({ id: m[1], tokens: new Set([...m[2].matchAll(/(--[\w-]+)\s*:/g)].map((t) => t[1])) }));
  assert.deepEqual(blocks.map((b) => b.id).sort(), THEMES.map((t) => t.id).sort());
  for (const b of blocks) assert.deepEqual([...b.tokens].sort(), [...blocks[0].tokens].sort(), `the ${b.id} theme's tokens`);
});
