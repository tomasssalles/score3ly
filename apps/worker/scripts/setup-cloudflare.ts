// Creates the app's storage on Cloudflare, once per Cloudflare account, in the jurisdiction you choose (it can only be
// set at creation, docs/overview.md §14):
//
//   npm run setup:cloudflare -w apps/worker -- --jurisdiction eu        (stored in the EU)
//   npm run setup:cloudflare -w apps/worker -- --jurisdiction fedramp   (FedRAMP; Cloudflare Enterprise only)
//   npm run setup:cloudflare -w apps/worker -- --jurisdiction none      (wherever Cloudflare stores it)
//
// - the R2 bucket for the PDFs and the stage outputs, `score3ly-pdfs`;
// - the D1 database, `score3ly`;
// - cloudflare.env (not committed), with the jurisdiction and the database's id, written last, from which
//   scripts/config.ts generates wrangler.deploy.jsonc before every deployment.
//
// Run it logged in with Wrangler (`npx wrangler login`, which opens a browser), from a computer of your own. It refuses
// to run where there is a cloudflare.env already, so that file is never overwritten. If it fails before writing it, run
// it again: what it created already is kept. Then deploy with `npm run deploy` (docs/database.md, "Deploying").

import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { accountPath, formatAccount, type Jurisdiction, JURISDICTIONS, workerDir, writeDeployConfig } from "./config.ts";

const BUCKET = "score3ly-pdfs";
const DATABASE = "score3ly";

if (existsSync(accountPath)) {
  console.error(`${accountPath} exists already: this account is set up. It is never overwritten; delete it by hand only if
it is wrong (the bucket and the database it names stay on Cloudflare).`);
  process.exit(1);
}

// --jurisdiction <value> or --jurisdiction=<value>; required, since it can't be changed afterwards.
function jurisdictionArg(): Jurisdiction {
  const args = process.argv.slice(2);
  const i = args.findIndex((a) => a === "--jurisdiction" || a.startsWith("--jurisdiction="));
  const value = i < 0 ? undefined : args[i].includes("=") ? args[i].split("=")[1] : args[i + 1];
  if (!value || !(JURISDICTIONS as readonly string[]).includes(value)) {
    console.error(`Say where Cloudflare stores the data, which can't be changed later:
  --jurisdiction eu        in the EU
  --jurisdiction fedramp   FedRAMP (Cloudflare Enterprise only)
  --jurisdiction none      wherever Cloudflare stores it`);
    process.exit(1);
  }
  return value as Jurisdiction;
}

const jurisdiction = jurisdictionArg();
const jurisdictionFlag = jurisdiction === "none" ? [] : ["--jurisdiction", jurisdiction];
const where = jurisdiction === "none" ? "" : ` (jurisdiction ${jurisdiction})`;

// Wrangler's output, or its error output where it fails. It runs without a config (there is no wrangler.jsonc), so it
// creates what it is asked to and offers to add nothing to a config.
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
const bucket = wrangler(["r2", "bucket", "create", BUCKET, ...jurisdictionFlag]);
if (bucket.ok) console.log(`Created the R2 bucket ${BUCKET}${where}.`);
else if (/already exists|already own/i.test(bucket.out)) console.log(`The R2 bucket ${BUCKET} exists already${where}.`);
else {
  console.error(`Couldn't create the R2 bucket ${BUCKET}:\n${bucket.out}`);
  process.exit(1);
}

// The database, and its id.
let databaseId: string | null = null;
const database = wrangler(["d1", "create", DATABASE, ...jurisdictionFlag]);
if (database.ok) {
  databaseId = /"?database_id"?\s*[:=]\s*"([0-9a-f-]{36})"/.exec(database.out)?.[1] ?? null;
  console.log(`Created the D1 database ${DATABASE}${where}.`);
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
  console.error(`Couldn't find the id of the D1 database ${DATABASE}: find it with \`npx wrangler d1 list\` and write ${accountPath} by hand:\n${formatAccount({ jurisdiction, databaseId: "<its id>" })}`);
  process.exit(1);
}

// cloudflare.env, last, and the deploy config from it.
writeFileSync(accountPath, formatAccount({ jurisdiction, databaseId }));
console.log(`Wrote ${accountPath}.`);
writeDeployConfig();
console.log(`
Next:
  1. The secrets your model configs name, each with (in apps/worker):
       npx wrangler secret put <NAME> -c wrangler.deploy.jsonc
  2. npm run deploy   (builds the web app, applies the migrations to the remote database, deploys the Worker)
  3. Cloudflare Access in front of the app (docs/database.md, "Deploying").
`);
