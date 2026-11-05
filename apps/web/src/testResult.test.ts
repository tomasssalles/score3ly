import { test } from "node:test";
import assert from "node:assert/strict";
import { resultText } from "./testResult.ts";

const priced = { price: { kind: "priced", price: { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 }, borrowedFrom: null } } as const;

test("a test's result in words: the answer, the time and the cost; or what went wrong", () => {
  const ok = { status: "ok", error: null, answer: "black", costUsd: 0.0006, durationMs: 2412 } as const;
  assert.equal(resultText(ok, "Claude Opus 5.5", priced), 'It works: Claude Opus 5.5 answered "black" in 2.4 s. Cost: <$0.01.');
  assert.equal(resultText({ ...ok, costUsd: 0.0123 }, "Claude Opus 5.5", priced), 'It works: Claude Opus 5.5 answered "black" in 2.4 s. Cost: $0.01.');
  assert.equal(resultText({ ...ok, costUsd: 0 }, "x", { price: { kind: "free" } }), 'It works: x answered "black" in 2.4 s. Cost: $0.00 (free tier).');
  assert.equal(resultText({ ...ok, costUsd: null }, "x", { price: { kind: "unpriced" } }), 'It works: x answered "black" in 2.4 s. Cost: unknown (unpriced).');
  assert.equal(resultText({ ...ok, status: "error", error: "401 invalid x-api-key", answer: null, costUsd: null }, "x", priced), "It didn't work, after 2.4 s: 401 invalid x-api-key");
});
