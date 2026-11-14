// The one-time script that fills in the place (item and round) of the LLM calls made before migration 0004 recorded
// it (docs/overview.md §12, "Each call records its place"; the logic: callPlaces.ts). Until it has run on a database,
// that database's older calls have the placeholders "?" and 0, which the app treats as errors (exporting a project with
// one is refused).
//
//   npm run fill-call-places -w apps/worker -- --remote     the deployed database and bucket (after deploying 0004)
//   npm run fill-call-places -w apps/worker -- --local [--persist-to <folder>]
//                                                            wrangler dev's (its default folder, .wrangler/state)
//
// --remote reads and writes the deployed D1 and R2 directly, through Wrangler's remote bindings: log in first
// (`npx wrangler login`), and have cloudflare.env (docs/database.md, "Deploying"). It changes only the calls that have
// the placeholders, so running it again does nothing more. Calls whose place can't be told are listed and keep the
// placeholders.

import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getPlatformProxy } from "wrangler";
import { accountPath, localDevConfigPath, parseAccount, templatePath, withAccount, workerDir, writeLocalDevConfig } from "./config.ts";
import { fillCallPlaces } from "./callPlaces.ts";

const args = process.argv.slice(2);
const remote = args.includes("--remote");
const local = args.includes("--local");
if (remote === local) {
  console.error("Say which database: --remote (the deployed one) or --local (wrangler dev's).");
  process.exit(1);
}
const persistAt = args.indexOf("--persist-to");
const persistTo = persistAt >= 0 ? args[persistAt + 1] : undefined;

// The remote run's config: the deploy config with both bindings remote, written next to the others and removed after.
const remoteConfigPath = join(workerDir, "wrangler.fill-call-places.jsonc");

function remoteConfig(): string {
  const account = parseAccount(readFileSync(accountPath, "utf8"));
  if ("error" in account) throw new Error(`${accountPath}: ${account.error}`);
  const config = withAccount(readFileSync(templatePath, "utf8"), account);
  if (typeof config !== "string") throw new Error(config.error);
  const remoteBinding = (text: string, binding: string) => {
    const marker = `"binding": "${binding}",`;
    if (!text.includes(marker)) throw new Error(`The config has no binding ${binding}.`);
    return text.replace(marker, `${marker} "remote": true,`);
  };
  return remoteBinding(remoteBinding(config, "DB"), "PDFS");
}

let configPath = localDevConfigPath;
if (remote) {
  writeFileSync(remoteConfigPath, remoteConfig());
  configPath = remoteConfigPath;
} else {
  writeLocalDevConfig();
}

try {
  const platform = await getPlatformProxy<Env>({
    configPath,
    remoteBindings: remote,
    ...(local ? { persist: persistTo ? { path: persistTo } : true } : {}),
    envFiles: ["no-such-file"],
  });
  try {
    const { env } = platform;
    // The columns come with migration 0004: deployed (`npm run deploy`), or `npm run migrate:local`.
    try {
      await env.DB.prepare("SELECT item, round FROM llm_calls LIMIT 1").all();
    } catch {
      throw new Error("The database has no place columns yet: apply migration 0004 first (npm run deploy, or npm run migrate:local).");
    }
    const { unplaced } = await fillCallPlaces(env.DB, env.PDFS, (line) => console.log(line));
    if (unplaced.length > 0) {
      console.log("\nCalls left without a place (they keep the placeholders \"?\" and 0):");
      for (const u of unplaced) console.log(`- ${u.id} (${u.step ?? "no stage"}, ${u.status}, ${u.startedAt}): ${u.reason}`);
    }
  } finally {
    await platform.dispose();
  }
} finally {
  if (remote) rmSync(remoteConfigPath, { force: true });
}
