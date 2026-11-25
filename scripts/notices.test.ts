import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildNotices, NOTICES_FILE, packages } from "./notices.ts";

test("THIRD_PARTY_NOTICES.md is up to date with the installed packages", () => {
  assert.equal(readFileSync(NOTICES_FILE, "utf8"), buildNotices(), "the dependencies changed: run `npm run notices`");
});

// (A package without a license file of its own and without a standard text for its license fails `packages()` itself.)
test("every package names its license", () => {
  for (const p of packages()) {
    assert.notEqual(p.license, "unknown", `${p.name} ${p.version} names no license`);
  }
});
