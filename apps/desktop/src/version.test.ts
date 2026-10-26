import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// The packages are built with the desktop package's version (electron-builder needs one there): the app's.
test("the desktop package has the app's version", () => {
  const read = (path: string) => JSON.parse(readFileSync(join(import.meta.dirname, path), "utf8")) as { version: string };
  assert.equal(read("../package.json").version, read("../../../package.json").version);
});
