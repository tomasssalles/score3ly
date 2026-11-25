import assert from "node:assert/strict";
import { test } from "node:test";
import { testsetServer } from "./testsetServer.ts";

type Handler = (req: { url?: string; method?: string }, res: FakeResponse) => unknown;
type FakeResponse = { statusCode: number; ended: boolean; setHeader: () => void; end: () => void };

// The plugin's middlewares, by their paths, as Vite's dev server would call them.
function middlewares(): Map<string, Handler> {
  const handlers = new Map<string, Handler>();
  const plugin = testsetServer() as { configureServer: (server: unknown) => void };
  plugin.configureServer({ middlewares: { use: (path: string, handler: Handler) => handlers.set(path, handler) } });
  return handlers;
}

function response(): FakeResponse {
  const res: FakeResponse = { statusCode: 200, ended: false, setHeader() {}, end: () => void (res.ended = true) };
  return res;
}

// A malformed name made decodeURIComponent throw inside the async middleware: an unhandled rejection, and a request
// that never got an answer (review E21).
test("a malformed file name is answered, not left hanging", async () => {
  const res = response();
  await middlewares().get("/testset")!({ url: "/%E0%A4%A", method: "GET" }, res);
  assert.equal(res.ended, true);
  assert.equal(res.statusCode, 400);
});

test("a name outside the test set is refused, a missing file not found", async () => {
  for (const [url, status] of [["/..%2Fpackage.json", 400], ["/.hidden", 400], ["/no-such-file.pdf", 404]] as const) {
    const res = response();
    await middlewares().get("/testset")!({ url, method: "GET" }, res);
    assert.deepEqual([res.ended, res.statusCode], [true, status], url);
  }
});
