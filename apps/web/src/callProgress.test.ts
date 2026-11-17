import { test } from "node:test";
import assert from "node:assert/strict";
import { charsText, itemText, trackCall, type ItemProgress } from "./callProgress.ts";

test("a call served from the record reports nothing; progress before a call's start is ignored", () => {
  const items: ItemProgress[] = [];
  const onEvent = trackCall({ item: (i) => items.push(i) }, "p1");
  onEvent({ event: "progress", elapsedMs: 1, outputTokens: 9, textChars: 0, thinkingChars: 36 });
  assert.deepEqual(items, []);
});

test("an item's characters count over its calls, and start again for the next item", () => {
  const items: ItemProgress[] = [];
  const run = { item: (i: ItemProgress) => items.push(i) };
  const started = { event: "started" as const, callId: "c", startedAt: "2026-11-15T10:00:00.000Z", timeoutMs: 60_000 };
  const progress = (textChars: number, thinkingChars: number) => ({ event: "progress" as const, elapsedMs: 1, outputTokens: null, textChars, thinkingChars });
  const round1 = trackCall(run, "p4");
  round1(started);
  round1(progress(100, 200));
  const round2 = trackCall(run, "p4");
  round2(started);
  round2(progress(50, 0));
  const next = trackCall(run, "p5");
  next(started);
  next(progress(10, 0));
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
  const again = trackCall({ item: (i) => other.push(i) }, "p5");
  again(started);
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
