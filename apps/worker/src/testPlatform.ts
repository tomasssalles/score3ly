import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPlatformProxy } from "wrangler";
import { migrate, NodeD1 } from "./node/d1.ts";
import { nodeEnv } from "./node/env.ts";
import { NodeR2 } from "./node/r2.ts";

// The platform the Worker's tests run on, with a migrated database (docs/overview.md §12): Wrangler's local D1 and R2,
// kept in memory, or the desktop version's (docs/desktop.md), a SQLite file and a folder in a temporary folder, with
// D1's limits enforced (NodeD1's limits mode). The route tests run on both: `TEST_HOST=node` picks the Node host for a
// test file that doesn't name one (the `*.node.test.ts` files set it before importing their test file).
//
// Without the developer's secrets: Wrangler would read them from .dev.vars, unless it is given env files to read
// instead, and a file that doesn't exist is skipped. So tests never see real keys, and pass the same with or without a
// .dev.vars. The local-dev config, made again from the template first (scripts/config.ts), never the deploy one.

export type TestHost = "wrangler" | "node";

export type TestPlatform = { host: TestHost; env: Env; dispose: () => Promise<void> };

const MIGRATIONS = join(import.meta.dirname, "..", "migrations");

export function testHost(): TestHost {
  return process.env.TEST_HOST === "node" ? "node" : "wrangler";
}

export async function testPlatform(host: TestHost = testHost()): Promise<TestPlatform> {
  if (host === "node") {
    const dir = mkdtempSync(join(tmpdir(), "score3ly-test-"));
    const db = new NodeD1(join(dir, "db.sqlite"));
    migrate(db, MIGRATIONS);
    const env = nodeEnv({ db, files: new NodeR2(join(dir, "files")) });
    return {
      host,
      env,
      dispose: async () => {
        db.close();
        rmSync(dir, { recursive: true, force: true });
      },
    };
  }
  const proxy = await getPlatformProxy<Env>({ configPath: join(import.meta.dirname, "..", "wrangler.local-dev.jsonc"), persist: false, envFiles: ["no-such-file"] });
  // D1's exec() wants each statement on one line, without comments.
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(MIGRATIONS, file), "utf8").replace(/--.*$/gm, "").replace(/\s+/g, " ").replace(/; /g, ";\n");
    await proxy.env.DB.exec(sql);
  }
  return { host, env: proxy.env, dispose: () => proxy.dispose() };
}
