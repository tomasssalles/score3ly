import { test } from "node:test";
import assert from "node:assert/strict";
import { readSse, sseData } from "./sse.ts";

test("events are read as they arrive, whatever the pieces the bytes come in; comments and empty lines skipped", async () => {
  const pieces = [": waiting\n\ndata: {\"a\"", ":1}\r\n\r\nda", "ta: [DONE]\n", "\ndata: last"];
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const piece of pieces) controller.enqueue(new TextEncoder().encode(piece));
      controller.close();
    },
  });
  const seen: string[] = [];
  await readSse(new Response(body), (data) => seen.push(data));
  assert.deepEqual(seen, ['{"a":1}', "[DONE]", "last"]);
});

test("reading that stops early (onData throws) cancels the body, so its connection is let go", async () => {
  let cancelled: unknown = "not cancelled";
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("data: one\n\ndata: two\n\n"));
    },
    cancel(reason) {
      cancelled = reason;
    },
  });
  await assert.rejects(readSse(new Response(body), () => {
    throw new Error("stop here");
  }), /stop here/);
  assert.notEqual(cancelled, "not cancelled");
});

test("sseData frames an event as readSse reads it", async () => {
  const events = [{ a: 1, text: "two\nlines" }, "[DONE]"];
  const seen: string[] = [];
  await readSse(new Response(events.map((e) => sseData(e)).join("")), (data) => seen.push(data));
  assert.deepEqual(seen, [JSON.stringify(events[0]), "[DONE]"]);
  assert.equal(sseData({ b: 2 }), 'data: {"b":2}\n\n');
});
