import { test } from "node:test";
import assert from "node:assert/strict";
import { pricesStale, versionText } from "./about.ts";

test("the version names the commit it was built from", () => {
  assert.equal(versionText({ version: "0.1.0", commit: "61c081d", dirty: false, dev: false }), "0.1.0 @ 61c081d");
});

test("the version says when it doesn't match a commit exactly", () => {
  assert.equal(
    versionText({ version: "0.1.0", commit: "61c081d", dirty: true, dev: true }),
    "0.1.0 @ 61c081d [+ uncommitted changes] [dev server]",
  );
  assert.equal(
    versionText({ version: "0.1.0", commit: "61c081d", dirty: false, dev: true }),
    "0.1.0 @ 61c081d [dev server]",
  );
  assert.equal(versionText({ version: "0.1.0", commit: null, dirty: false, dev: false }), "0.1.0");
});

test("the price table is stale after three months", () => {
  const now = Date.parse("2026-10-13T00:00:00Z");
  assert.equal(pricesStale("2026-10-06", now), false);
  assert.equal(pricesStale("2026-07-01", now), true);
});
