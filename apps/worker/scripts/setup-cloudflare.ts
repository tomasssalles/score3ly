// Creates the app's storage on Cloudflare, in the EU (docs/overview.md §3 and §14: the jurisdiction can only be set at
// creation), once per Cloudflare account:
//
//   npm run setup:cloudflare -w apps/worker
//
// - the R2 bucket for the PDFs and the stage outputs, `score3ly-pdfs`, in the EU jurisdiction;
// - the D1 database, `score3ly`, in the EU jurisdiction, whose id it writes into wrangler.jsonc (a placeholder until
//   then; commit the change, or keep it local: the id is no secret, but it is your account's).
//
// Run it logged in with Wrangler (`npx wrangler login`, which opens a browser), from a computer of your own. Running it
// again changes nothing: what exists already is kept, and the id is written again. Then deploy with `npm run deploy`,
// which applies the migrations to the remote database first (docs/database.md, "Deploying").

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const workerDir = join(import.meta.dirname, "..");
const configPath = join(workerDir, "wrangler.jsonc");
const BUCKET = "score3ly-pdfs";
const DATABASE = "score3ly";
const PLACEHOLDER = "00000000-0000-0000-0000-000000000000";

// Wrangler's output, or its error output where it fails (thrown with `failed`).
function wrangler(args: string[]): { ok: boolean; out: string } {
  try {
    return { ok: true, out: execFileSync("npx", ["wrangler", ...args], { cwd: workerDir, encoding: "utf8", stdio: ["inherit", "pipe", "pipe"] }) };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

const who = wrangler(["whoami"]);
if (!who.ok || /not authenticated|You are not logged in/i.test(who.out)) {
  console.error("Log in to Cloudflare first: npx wrangler login");
  process.exit(1);
}

// The bucket.
const bucket = wrangler(["r2", "bucket", "create", BUCKET, "--jurisdiction", "eu"]);
if (bucket.ok) console.log(`Created the R2 bucket ${BUCKET} in the EU.`);
else if (/already exists|already own/i.test(bucket.out)) console.log(`The R2 bucket ${BUCKET} exists already in the EU.`);
else {
  console.error(`Couldn't create the R2 bucket ${BUCKET}:\n${bucket.out}`);
  process.exit(1);
}

// The database, and its id.
let databaseId: string | null = null;
const database = wrangler(["d1", "create", DATABASE, "--jurisdiction", "eu"]);
if (database.ok) {
  databaseId = /"?database_id"?\s*[:=]\s*"([0-9a-f-]{36})"/.exec(database.out)?.[1] ?? null;
  console.log(`Created the D1 database ${DATABASE} in the EU.`);
} else if (/already exists/i.test(database.out)) {
  console.log(`The D1 database ${DATABASE} exists already.`);
} else {
  console.error(`Couldn't create the D1 database ${DATABASE}:\n${database.out}`);
  process.exit(1);
}
if (!databaseId) {
  const list = wrangler(["d1", "list", "--json"]);
  const found = list.ok ? (JSON.parse(list.out) as { name: string; uuid: string }[]).find((d) => d.name === DATABASE) : undefined;
  databaseId = found?.uuid ?? null;
}
if (!databaseId) {
  console.error(`Couldn't find the id of the D1 database ${DATABASE}: put it into ${configPath} by hand (wrangler d1 list).`);
  process.exit(1);
}

// The id into wrangler.jsonc, in place of the placeholder or an earlier id.
const config = readFileSync(configPath, "utf8");
const updated = config.replace(/("database_id":\s*")[0-9a-f-]{36}(")/, `$1${databaseId}$2`);
if (updated === config && !config.includes(databaseId)) {
  console.error(`Couldn't find "database_id" in ${configPath}: put ${databaseId} there by hand.`);
  process.exit(1);
}
writeFileSync(configPath, updated);
console.log(`${configPath}: database_id ${databaseId}${config.includes(PLACEHOLDER) ? " (was the placeholder)" : ""}.`);
console.log(`
Next:
  1. The secrets your model configs name, each with: npx wrangler secret put <NAME>   (in apps/worker)
  2. npm run deploy   (builds the web app, applies the migrations to the remote database, deploys the Worker)
  3. Cloudflare Access in front of the app (docs/database.md, "Deploying").`);
