import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
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

// The server's own parts (the code review, E17): the host's answer, the Worker's routes on the Node adapters (a project
// created, its PDF stored in the data folder), the web app's files, and no file outside the web app's folder.
test("startServer on port 0: the host, a project created, the web app served, a path out of its folder refused", async () => {
  const root = mkdtempSync(join(tmpdir(), "score3ly-server-"));
  const dataDir = join(root, "data");
  const webDir = join(root, "web");
  mkdirSync(webDir);
  writeFileSync(join(webDir, "index.html"), "<!doctype html><title>app</title>");
  mkdirSync(join(webDir, "assets"));
  writeFileSync(join(webDir, "assets", "index-abc123.js"), "export {};");
  writeFileSync(join(root, "secret.txt"), "not for the web");
  const server = await startServer({ dataDir, webDir, migrationsDir, host: "desktop", port: 0 });
  try {
    const get = (path: string) => fetch(new URL(path, server.url));
    assert.deepEqual(await (await get("api/info")).json(), { host: "desktop" });

    const pdf = new TextEncoder().encode("%PDF-1.4 a score");
    const sha256 = createHash("sha256").update(pdf).digest("hex");
    assert.equal((await fetch(new URL(`api/pdfs/${sha256}`, server.url), { method: "PUT", body: pdf })).status, 204);
    const created = await fetch(new URL("api/projects", server.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sha256, filename: "Sonata.pdf", pageCount: 1 }),
    });
    assert.equal(created.status, 201);
    assert.equal(((await created.json()) as { name: string }).name, "Sonata");
    assert.equal(((await (await get("api/projects")).json()) as unknown[]).length, 1);
    assert.equal(await (await get(`api/pdfs/${sha256}/file`)).text(), "%PDF-1.4 a score");

    const index = await get("/");
    assert.equal(index.headers.get("Content-Type"), "text/html; charset=utf-8");
    assert.equal(index.headers.get("Cache-Control"), "no-cache");
    assert.match(await index.text(), /<title>app<\/title>/);
    const asset = await get("/assets/index-abc123.js");
    assert.equal(asset.headers.get("Content-Type"), "text/javascript; charset=utf-8");
    assert.equal(asset.headers.get("Cache-Control"), "public, max-age=31536000, immutable");
    assert.equal(await asset.text(), "export {};");
    assert.equal((await fetch(new URL("/assets/index-abc123.js", server.url), { method: "HEAD" })).status, 200);
    for (const path of ["/..%2fsecret.txt", "/%2e%2e/secret.txt", "/assets/..%2f..%2fsecret.txt", "/%E0%A4%A"]) {
      const response = await get(path);
      assert.doesNotMatch(await response.text(), /not for the web/, path);
      assert.equal(response.status, 404, path);
    }
  } finally {
    await server.close();
    rmSync(root, { recursive: true, force: true });
  }
});
