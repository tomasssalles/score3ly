import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { join } from "node:path";
import { test } from "node:test";

// The scripts here have no tests of their own, and most aren't run often; a syntax error in one would go unnoticed
// until it is needed (found 2026-11-10: seedStats.ts had lost its `()` in three arrow functions).
test("every script parses", () => {
  for (const name of readdirSync(import.meta.dirname).filter((n) => n.endsWith(".ts"))) {
    const source = readFileSync(join(import.meta.dirname, name), "utf8");
    assert.doesNotThrow(() => stripTypeScriptTypes(source), name);
  }
});
