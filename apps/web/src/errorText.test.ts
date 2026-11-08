import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Errors from providers and the Worker can hold long words and JSON, which pushed a failed stage's card and the Test
// dialog wider than their place (found 2026-11-07): every element that shows an error has the class that wraps it
// anywhere (docs/style.md, "Feedback and notifications"). Checked here by name: a class ending in "error" or "problem(s)".
test("every element with an error's class also has error-text", () => {
  const missing: string[] = [];
  for (const file of readdirSync(import.meta.dirname).filter((f) => f.endsWith(".tsx"))) {
    const source = readFileSync(join(import.meta.dirname, file), "utf8");
    for (const match of source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      const classes = match[1] ?? match[2];
      const tokens = classes.split(/\s+/);
      if (tokens.some((t) => /(^|-)(error|problems?)$/.test(t)) && !tokens.includes("error-text")) missing.push(`${file}: ${classes}`);
    }
  }
  assert.deepEqual(missing, []);
});
