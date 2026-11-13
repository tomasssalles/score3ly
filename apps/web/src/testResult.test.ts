import { test } from "node:test";
import assert from "node:assert/strict";
import { resultText } from "./testResult.ts";

const priced = { price: { kind: "priced", price: { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 }, borrowedFrom: null } } as const;

test("a test's result in words: the time and the cost; or what went wrong", () => {
  const ok = { status: "ok", error: null, costUsd: 0.0006, vatPercent: 0, durationMs: 2412 } as const;
  assert.equal(resultText(ok, "Claude Opus 5.5", priced), 'Success: Claude Opus 5.5 responded in the requested format in 2.4 s. Cost: <$0.01.');
  assert.equal(resultText({ ...ok, costUsd: 0.0123 }, "Claude Opus 5.5", priced), 'Success: Claude Opus 5.5 responded in the requested format in 2.4 s. Cost: $0.01.');
  assert.equal(resultText({ ...ok, costUsd: 0 }, "x", { price: { kind: "free" } }), 'Success: x responded in the requested format in 2.4 s. Cost: $0.00 (free tier).');
  assert.equal(resultText({ ...ok, costUsd: null }, "x", { price: { kind: "unpriced" } }), 'Success: x responded in the requested format in 2.4 s. Cost: unknown (unpriced).');
  // With VAT, the cost says so (docs/llm.md, "VAT").
  assert.equal(resultText({ ...ok, costUsd: 0.0119, vatPercent: 19 }, "x", priced), "Success: x responded in the requested format in 2.4 s. Cost: $0.01 incl. VAT.");
  assert.equal(resultText({ ...ok, status: "error", error: "401 invalid x-api-key", costUsd: null }, "x", priced), "Failed (after 2.4 s): 401 invalid x-api-key");
});
