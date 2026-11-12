import { test } from "node:test";
import assert from "node:assert/strict";
import { shortIds } from "./requestLog.ts";

test("ids in a path are shortened to their first 7 characters, the rest kept", () => {
  assert.equal(
    shortIds("/api/projects/3f2a1b9c-1234-4abc-8def-0123456789ab/stages/88ac1d0e-aaaa-4bbb-8ccc-dddddddddddd/llm"),
    "/api/projects/3f2a1b9/stages/88ac1d0/llm",
  );
  assert.equal(shortIds(`/api/content/${"ab".repeat(32)}`), "/api/content/abababa");
  assert.equal(shortIds("/api/settings/spendingCapUsd"), "/api/settings/spendingCapUsd");
});
