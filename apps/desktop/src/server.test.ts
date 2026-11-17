import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { startServer } from "./server.ts";

const migrationsDir = join(import.meta.dirname, "../../worker/migrations");

// Found in the code review (E11): the server registered no 'error' listener, so a port in use was an uncaught
// exception (`npm run serve` while another server runs), not a refusal the caller could report.
test("startServer on a port in use rejects", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "score3ly-server-"));
  const taken = createServer();
  await new Promise<void>((resolve) => taken.listen(0, "127.0.0.1", resolve));
  const port = (taken.address() as { port: number }).port;
  try {
    await assert.rejects(startServer({ dataDir, webDir: dataDir, migrationsDir, host: "local", port }), /EADDRINUSE/);
  } finally {
    taken.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("startServer on a free port answers, and closes", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "score3ly-server-"));
  try {
    const server = await startServer({ dataDir, webDir: dataDir, migrationsDir, host: "local" });
    assert.deepEqual(await (await fetch(`${server.url}api/info`)).json(), { host: "local" });
    await server.close();
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});
