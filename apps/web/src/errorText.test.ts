import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

// Errors from providers and the Worker can hold long words and JSON, which pushed a failed stage's card and the Test
// dialog wider than their place (found 2026-11-07): every element that shows an error has the class that wraps it
// anywhere (docs/style.md, "Feedback and notifications"). Checked here by name: a class ending in "error" or "problem(s)",
// in every component, the kits' (ui/, editor/) too.
function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tsxFiles(join(dir, e.name)) : e.name.endsWith(".tsx") ? [join(dir, e.name)] : []));
}

test("every element with an error's class also has error-text", () => {
  const missing: string[] = [];
  const files = tsxFiles(import.meta.dirname);
  assert.ok(files.some((f) => f.includes("/editor/")), "the page-editor kit's components weren't found");
  for (const path of files) {
    const file = relative(import.meta.dirname, path);
    const source = readFileSync(path, "utf8");
    for (const match of source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      const classes = match[1] ?? match[2];
      const tokens = classes.split(/\s+/);
      if (tokens.some((t) => /(^|-)(error|problems?)$/.test(t)) && !tokens.includes("error-text")) missing.push(`${file}: ${classes}`);
    }
  }
  assert.deepEqual(missing, []);
});
