import { test } from "node:test";
import assert from "node:assert/strict";
import { trackCall, type CallProgress } from "./callProgress.ts";

test("a call's start, progress and end reach the stage's run as one state", () => {
  const seen: CallProgress[] = [];
  let clock = 1000;
  const tracked = trackCall({ call: (c) => seen.push(c) }, "System 4", () => clock);
  tracked.onEvent({ event: "progress", elapsedMs: 1, outputTokens: 9, exact: false, textChars: 0, thinkingChars: 36 }); // before its start: ignored
  tracked.onEvent({ event: "started", callId: "c1", startedAt: "2026-11-14T10:00:00.000Z", timeoutMs: 60_000 });
  clock = 3000;
  tracked.onEvent({ event: "progress", elapsedMs: 2000, outputTokens: 100, exact: true, textChars: 40, thinkingChars: 360 });
  clock = 4000;
  tracked.ended();
  assert.deepEqual(seen, [
    { callId: "c1", label: "System 4", startedAt: 1000, timeoutMs: 60_000, outputTokens: 0, exact: false, textChars: 0, thinkingChars: 0 },
    { callId: "c1", label: "System 4", startedAt: 1000, timeoutMs: 60_000, outputTokens: 100, exact: true, textChars: 40, thinkingChars: 360 },
    { callId: "c1", label: "System 4", startedAt: 1000, timeoutMs: 60_000, outputTokens: 100, exact: true, textChars: 40, thinkingChars: 360, endedAt: 4000 },
  ]);
});

test("a call served from the record reports nothing", () => {
  const seen: CallProgress[] = [];
  trackCall({ call: (c) => seen.push(c) }, "Page 1").ended();
  assert.deepEqual(seen, []);
});
