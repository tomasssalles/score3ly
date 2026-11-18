import assert from "node:assert/strict";
import test from "node:test";
import { gatheringDrift } from "../model-list/gather/all.ts";
import { fetchedOn, readJsonl } from "../model-list/gather/common.ts";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("the committed excerpts give the committed provider files", () => {
  assert.deepEqual(gatheringDrift(), []);
});

test("an excerpt that doesn't say when it was fetched stops the gathering, never dated today", () => {
  assert.equal(fetchedOn("x", "# fetched 2026-11-06; the table"), "2026-11-06");
  assert.throws(() => fetchedOn("x", "# the table"), /doesn't say when it was fetched/);
  assert.throws(() => fetchedOn("x", undefined), /doesn't say when it was fetched/);
  const dir = mkdtempSync(join(tmpdir(), "gather-"));
  writeFileSync(join(dir, "a.jsonl"), `{"url":"u","note":"n"}\n{"a":1}\n`);
  assert.throws(() => readJsonl(join(dir, "a.jsonl")), /doesn't say when it was fetched/);
  writeFileSync(join(dir, "b.jsonl"), `{"url":"u","fetched":"2026-11-06","note":"n"}\n{"a":1}\n`);
  assert.deepEqual(readJsonl(join(dir, "b.jsonl")).rows, [{ a: 1 }]);
});
