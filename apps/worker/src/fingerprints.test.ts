import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getPlatformProxy } from "wrangler";
import app from "./index.ts";

// The fingerprint endpoints against Wrangler's local D1, kept in memory.
const workerDir = join(import.meta.dirname, "..");
let platform: Awaited<ReturnType<typeof getPlatformProxy<Env>>>;
let env: Env;

before(async () => {
  platform = await getPlatformProxy<Env>({ configPath: join(workerDir, "wrangler.jsonc"), persist: false });
  env = platform.env;
  for (const file of readdirSync(join(workerDir, "migrations")).sort()) {
    const sql = readFileSync(join(workerDir, "migrations", file), "utf8");
    await env.DB.exec(sql.replace(/--.*$/gm, "").replace(/\s+/g, " ").replace(/; /g, ";\n"));
  }
});

after(async () => {
  await platform.dispose();
});

const fingerprint = (fields: Record<string, unknown> = {}) => ({
  recipeKey: "a".repeat(64),
  pdfSha256: "b".repeat(64),
  version: 1,
  width: 1200,
  height: 1600,
  pixelsSha256: "c".repeat(64),
  thumbnail: btoa("thumbnail"),
  thumbnailWidth: 64,
  thumbnailHeight: 64,
  ...fields,
});

function post(body: unknown) {
  return app.request("/api/fingerprints", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, env);
}

test("a fingerprint is stored once per recipe key: the first stays", async () => {
  assert.deepEqual(await (await app.request(`/api/fingerprints/${"a".repeat(64)}`, {}, env)).json(), { fingerprint: null });
  assert.equal((await post({ fingerprints: [fingerprint()] })).status, 204);
  assert.equal((await post({ fingerprints: [fingerprint({ pixelsSha256: "d".repeat(64) })] })).status, 204);
  const { fingerprint: stored } = (await (await app.request(`/api/fingerprints/${"a".repeat(64)}`, {}, env)).json()) as {
    fingerprint: Record<string, unknown>;
  };
  assert.deepEqual(stored, fingerprint());

  assert.equal((await post({ fingerprints: [] })).status, 400);
  assert.equal((await post({ fingerprints: [fingerprint({ recipeKey: "not a hash" })] })).status, 400);
  assert.equal((await post({ fingerprints: [fingerprint({ width: 0 })] })).status, 400);
});
