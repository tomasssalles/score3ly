import { test } from "node:test";
import assert from "node:assert/strict";
import { versionText } from "./about.ts";

test("the version names the commit it was built from", () => {
  assert.equal(
    versionText({ version: "0.1.0", commit: "61c081d", dirty: false, dev: false }),
    "0.1.0 · commit 61c081d",
  );
});

test("the version says when it doesn't match a commit exactly", () => {
  assert.equal(
    versionText({ version: "0.1.0", commit: "61c081d", dirty: true, dev: true }),
    "0.1.0 · commit 61c081d with uncommitted changes · development server",
  );
  assert.equal(versionText({ version: "0.1.0", commit: null, dirty: false, dev: false }), "0.1.0");
});
