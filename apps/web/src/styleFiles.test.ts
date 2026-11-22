import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

// The styles are one file per kit component and per screen under styles/, brought together by styles.css in one
// order (docs/style.md, "Where the styles live"). A file that isn't in that list isn't in the app, and one listed twice
// would come twice in the cascade.
const SRC = import.meta.dirname;

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? cssFiles(join(dir, e.name)) : e.name.endsWith(".css") ? [join(dir, e.name)] : []));
}

test("styles.css imports every style sheet under styles/ once, and holds nothing else", () => {
  const entry = readFileSync(join(SRC, "styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const imports = [...entry.matchAll(/@import "\.\/([^"]+)";/g)].map((m) => m[1]);
  assert.equal(entry.replace(/@import "[^"]+";/g, "").trim(), "", "styles.css holds only @imports");
  assert.ok(imports.length > 0, "no @import found in styles.css");
  assert.deepEqual([...imports].sort(), cssFiles(join(SRC, "styles")).map((f) => relative(SRC, f)).sort());
});

test("only styles.css imports style sheets, so that their order is in one place", () => {
  for (const file of cssFiles(join(SRC, "styles"))) assert.doesNotMatch(readFileSync(file, "utf8"), /@import/, relative(SRC, file));
});
