import assert from "node:assert/strict";
import { createServer } from "node:net";
import { test } from "node:test";
import { portFree, start, stopAll, turns, until } from "./appServers.ts";

function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer().listen(0, "127.0.0.1", () => {
      const port = (server.address() as { port: number }).port;
      server.close(() => resolve(port));
    });
  });
}

// What `startServers` starts is a process that starts others (npx → wrangler → workerd), and a second fixture's
// servers take the same ports right after the first's are stopped (found in the code review, E5: "port 8884 is taken").
test("stopAll returns once what it stopped has let go of its ports", async () => {
  const port = await freePort();
  const grandchild = `require("node:net").createServer().listen(${port}, "127.0.0.1"); process.on("SIGTERM", () => setTimeout(() => process.exit(0), 300));`;
  const child = `require("node:child_process").spawn(process.execPath, ["-e", ${JSON.stringify(grandchild)}], { stdio: "inherit" }); setInterval(() => {}, 1000);`;
  start(process.execPath, ["-e", child], import.meta.dirname);
  for (let i = 0; i < 100 && (await portFree(port)); i++) await new Promise((r) => setTimeout(r, 50));
  assert.equal(await portFree(port), false, "the grandchild listens");
  await stopAll();
  assert.equal(await portFree(port), true, "the port is free once stopAll has returned");
  await stopAll(); // nothing left to stop
});

test("turns numbers each entry among those of its step", () => {
  const steps = ["layout", "review", "apply_review", "review", "apply_review", "human_review", "apply_review"];
  assert.deepEqual(turns(steps, (s) => s), [1, 1, 1, 2, 2, 1, 3]);
});

test("until returns the first answer, or fails saying what it waited for", async () => {
  const seen: number[] = [];
  assert.equal(await until((attempt) => (seen.push(attempt), attempt === 2 && "ready"), { every: 1, timeout: 1000, what: () => "never" }), "ready");
  assert.deepEqual(seen, [0, 1, 2]);
  await assert.rejects(until(() => false, { every: 5, timeout: 20, what: () => "the thing didn't come" }), /the thing didn't come/);
});
