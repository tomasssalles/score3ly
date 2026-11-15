import { test } from "node:test";
import assert from "node:assert/strict";
import { charsText, itemText, trackCall, type CallProgress, type ItemProgress } from "./callProgress.ts";

test("a call's start, progress and end reach the stage's run as one state", () => {
  const seen: CallProgress[] = [];
  let clock = 1000;
  const tracked = trackCall({ call: (c) => seen.push(c) }, "System 4", "p2/s4", () => clock);
  tracked.onEvent({ event: "progress", elapsedMs: 1, outputTokens: 9, textChars: 0, thinkingChars: 36 }); // before its start: ignored
  tracked.onEvent({ event: "started", callId: "c1", startedAt: "2026-11-14T10:00:00.000Z", timeoutMs: 60_000 });
  clock = 3000;
  tracked.onEvent({ event: "progress", elapsedMs: 2000, outputTokens: 100, textChars: 40, thinkingChars: 360 });
  // A report without a count says so: what to show then is the view's choice.
  tracked.onEvent({ event: "progress", elapsedMs: 3000, outputTokens: null, textChars: 80, thinkingChars: 360 });
  clock = 4000;
  tracked.ended();
  assert.deepEqual(seen, [
    { callId: "c1", label: "System 4", startedAt: 1000, timeoutMs: 60_000, outputTokens: null, textChars: 0, thinkingChars: 0 },
    { callId: "c1", label: "System 4", startedAt: 1000, timeoutMs: 60_000, outputTokens: 100, textChars: 40, thinkingChars: 360 },
    { callId: "c1", label: "System 4", startedAt: 1000, timeoutMs: 60_000, outputTokens: null, textChars: 80, thinkingChars: 360 },
    { callId: "c1", label: "System 4", startedAt: 1000, timeoutMs: 60_000, outputTokens: null, textChars: 80, thinkingChars: 360, endedAt: 4000 },
  ]);
});

test("a call served from the record reports nothing", () => {
  const seen: CallProgress[] = [];
  trackCall({ call: (c) => seen.push(c) }, "Page 1", "p1").ended();
  assert.deepEqual(seen, []);
});

test("an item's characters count over its calls, and start again for the next item", () => {
  const items: ItemProgress[] = [];
  const run = { item: (i: ItemProgress) => items.push(i) };
  const started = { event: "started" as const, callId: "c", startedAt: "2026-11-15T10:00:00.000Z", timeoutMs: 60_000 };
  const progress = (textChars: number, thinkingChars: number) => ({ event: "progress" as const, elapsedMs: 1, outputTokens: null, textChars, thinkingChars });
  const round1 = trackCall(run, "Page 4", "p4");
  round1.onEvent(started);
  round1.onEvent(progress(100, 200));
  round1.ended();
  const round2 = trackCall(run, "Page 4", "p4");
  round2.onEvent(started);
  round2.onEvent(progress(50, 0));
  round2.ended();
  const next = trackCall(run, "Page 5", "p5");
  next.onEvent(started);
  next.onEvent(progress(10, 0));
  assert.deepEqual(items, [
    { item: "p4", chars: 0 },
    { item: "p4", chars: 300 },
    { item: "p4", chars: 300 },
    { item: "p4", chars: 350 },
    { item: "p5", chars: 0 },
    { item: "p5", chars: 10 },
  ]);
  // Another run counts apart.
  const other: ItemProgress[] = [];
  const again = trackCall({ item: (i) => other.push(i) }, "Page 5", "p5");
  again.onEvent(started);
  assert.deepEqual(other, [{ item: "p5", chars: 0 }]);
});

test("the characters, short", () => {
  assert.equal(charsText(0), "0 chars");
  assert.equal(charsText(1), "1 char");
  assert.equal(charsText(999), "999 chars");
  assert.equal(charsText(1000), "1.00k chars");
  assert.equal(charsText(1234), "1.23k chars");
  assert.equal(charsText(999_994), "999.99k chars");
  assert.equal(charsText(999_995), "1.00M chars");
  assert.equal(charsText(2_345_678), "2.35M chars");
});

test("the item's line: preparing, then the characters; the whole score by name; no count without a model", () => {
  assert.equal(itemText({ item: "p4/s3", chars: null }, true), "p4/s3: preparing…");
  assert.equal(itemText({ item: "p4/s3", chars: 0 }, true), "p4/s3: 0 chars");
  assert.equal(itemText({ item: "p4/s3", chars: 1234 }, true), "p4/s3: 1.23k chars");
  assert.equal(itemText({ item: "", chars: 5 }, true), "full score: 5 chars");
  assert.equal(itemText({ item: "p2", chars: null }, false), "p2…");
  assert.equal(itemText({ item: "", chars: null }, false), "full score…");
});
