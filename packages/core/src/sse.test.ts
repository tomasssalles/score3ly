import { test } from "node:test";
import assert from "node:assert/strict";
import { readSse } from "./sse.ts";

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
