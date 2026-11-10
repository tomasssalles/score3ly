// The Wrangler configs, generated from wrangler.jsonc.template each time before they are used, never committed, never
// to be edited (docs/database.md, "Deploying"). There is no wrangler.jsonc, so every Wrangler command names its config,
// and a command that doesn't fails instead of reaching the wrong database:
// - wrangler.local-dev.jsonc: the template as it is (the placeholder id, which the local database is named after). For
//   `dev`, the tests, `migrate:local`, the scripts and local commands typed by hand.
// - wrangler.deploy.jsonc: the template with your account's parts from cloudflare.env, which `npm run setup:cloudflare`
//   writes once. For `deploy` and every command on the deployed Worker (`wrangler secret put`, `d1 … --remote`).
//
//   node scripts/config.ts local-dev   generates the first
//   node scripts/config.ts deploy      generates the second; fails without a cloudflare.env
//   node scripts/config.ts             (`npm run config -w apps/worker`) both, the second only where there is a
//                                      cloudflare.env

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const workerDir = join(import.meta.dirname, "..");
export const templatePath = join(workerDir, "wrangler.jsonc.template");
export const localDevConfigPath = join(workerDir, "wrangler.local-dev.jsonc");
export const deployConfigPath = join(workerDir, "wrangler.deploy.jsonc");
export const accountPath = join(workerDir, "cloudflare.env");

export const JURISDICTIONS = ["eu", "fedramp", "none"] as const;
export type Jurisdiction = (typeof JURISDICTIONS)[number];
export type Account = { jurisdiction: Jurisdiction; databaseId: string };

const BUCKET = "score3ly-pdfs";
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const GENERATED = `// Generated from wrangler.jsonc.template by scripts/config.ts, and generated again before every use: don't edit it,
// change the template (or, for your account's parts, cloudflare.env).
`;

// The template without its own opening comment, which is about the template.
function templateBody(): string {
  const template = readFileSync(templatePath, "utf8");
  return template.slice(template.indexOf("{"));
}

// cloudflare.env as written by the setup: CLOUDFLARE_JURISDICTION and CLOUDFLARE_D1_ID, `NAME=value` lines.
export function parseAccount(text: string): Account | { error: string } {
  const values = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) values.set(m[1], m[2].replace(/^"(.*)"$/, "$1"));
  }
  const jurisdiction = values.get("CLOUDFLARE_JURISDICTION");
  const databaseId = values.get("CLOUDFLARE_D1_ID");
  if (!jurisdiction || !(JURISDICTIONS as readonly string[]).includes(jurisdiction))
    return { error: `CLOUDFLARE_JURISDICTION must be one of ${JURISDICTIONS.join(", ")}` };
  if (!databaseId || !ID.test(databaseId)) return { error: "CLOUDFLARE_D1_ID must be the D1 database's id" };
  return { jurisdiction: jurisdiction as Jurisdiction, databaseId };
}

export function formatAccount(account: Account): string {
  return `# Your Cloudflare account's parts of the Worker's config, written once by \`npm run setup:cloudflare\`
# (scripts/config.ts reads them into wrangler.deploy.jsonc). Not committed.
CLOUDFLARE_JURISDICTION=${account.jurisdiction}
CLOUDFLARE_D1_ID=${account.databaseId}
`;
}

// The config's text with the database's id in place of the placeholder and the bucket's jurisdiction (none for
// "none"), the rest as it was; or what couldn't be found.
export function withAccount(config: string, account: Account): string | { error: string } {
  const idPattern = /("database_id":\s*")[0-9a-f-]{36}(")/;
  if (!idPattern.test(config)) return { error: `Couldn't find "database_id"` };
  const withId = config.replace(idPattern, `$1${account.databaseId}$2`);
  const binding = new RegExp(`\\{[^{}]*"bucket_name":\\s*"${BUCKET}"[^{}]*\\}`).exec(withId)?.[0];
  if (!binding) return { error: `Couldn't find the bucket ${BUCKET}` };
  const bare = binding.replace(/,\s*"jurisdiction":\s*"[^"]*"/, "");
  const next = account.jurisdiction === "none" ? bare : bare.replace(/\s*\}$/, `, "jurisdiction": "${account.jurisdiction}" }`);
  return withId.replace(binding, next);
}

export function writeLocalDevConfig(): void {
  writeFileSync(localDevConfigPath, GENERATED + templateBody());
}

// Throws where there is no usable cloudflare.env.
export function writeDeployConfig(): void {
  if (!existsSync(accountPath))
    throw new Error(`There is no ${accountPath}: run \`npm run setup:cloudflare -w apps/worker\` first (docs/database.md, "Deploying").`);
  const account = parseAccount(readFileSync(accountPath, "utf8"));
  if ("error" in account) throw new Error(`${accountPath}: ${account.error}.`);
  const config = withAccount(GENERATED + templateBody(), account);
  if (typeof config !== "string") throw new Error(`${templatePath}: ${config.error}.`);
  writeFileSync(deployConfigPath, config);
}

if (import.meta.main) {
  const which = process.argv[2];
  try {
    if (which !== "deploy") writeLocalDevConfig();
    if (which === "deploy" || (which === undefined && existsSync(accountPath))) writeDeployConfig();
    if (which !== undefined && which !== "deploy" && which !== "local-dev") throw new Error(`Unknown config: ${which}`);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}
