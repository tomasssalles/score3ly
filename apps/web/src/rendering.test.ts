import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VEROVIO_VERSION } from "./rendering.ts";

// The cache key of a rendering has Verovio's version: it must be the installed one.
test("VEROVIO_VERSION is the installed Verovio's version", () => {
  const installed = JSON.parse(readFileSync(join(import.meta.dirname, "../../../node_modules/verovio/package.json"), "utf8")).version;
  assert.equal(VEROVIO_VERSION, installed);
});
