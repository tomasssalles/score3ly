import { test } from "node:test";
import assert from "node:assert/strict";
import { LLM_TIMEOUT_MINUTES, llmTimeoutMs, timedOutMessage, withTimeout } from "./timeouts.ts";

test("every LLM step and the Test have a timeout; another step gets the longest", () => {
  for (const step of ["layout", "analyze", "extract", "review", "apply_review", "test"]) {
    assert.equal(llmTimeoutMs(step), LLM_TIMEOUT_MINUTES[step] * 60_000);
  }
  assert.equal(llmTimeoutMs("rasterize"), Math.max(...Object.values(LLM_TIMEOUT_MINUTES)) * 60_000);
});

test("the message names the limit", () => {
  assert.match(timedOutMessage(60 * 60_000), /^Timed out: no answer within 60 minutes, /);
  assert.match(timedOutMessage(60_000), /within 1 minute, /);
  assert.match(timedOutMessage(30_000), /within 30 seconds, /);
});

test("withTimeout aborts when the time is up, and says so", async () => {
  const t = withTimeout(undefined, 20);
  await new Promise((resolve) => t.signal.addEventListener("abort", resolve));
  assert.equal(t.timedOut(), true);
  assert.equal((t.signal.reason as Error).name, "AbortError");
  t.clear();
});

test("withTimeout aborts with the outer signal, not as a timeout", () => {
  const outer = new AbortController();
  const t = withTimeout(outer.signal, 60_000);
  outer.abort();
  assert.equal(t.signal.aborted, true);
  assert.equal(t.timedOut(), false);
  t.clear();
  const already = withTimeout(outer.signal, 60_000);
  assert.equal(already.signal.aborted, true);
  already.clear();
});

test("withTimeout's clear stops the timer", async () => {
  const t = withTimeout(undefined, 10);
  t.clear();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(t.signal.aborted, false);
});
