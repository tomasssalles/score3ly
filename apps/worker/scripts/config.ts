// wrangler.jsonc, which isn't committed: it holds your Cloudflare account's parts, which `npm run setup:cloudflare`
// writes (the database's id, the bucket's jurisdiction), and is otherwise a copy of wrangler.template.jsonc.
//
//   node scripts/config.ts   copies the template where there is no wrangler.jsonc yet; runs after every install, and
//                            before `dev` and `deploy`. An existing wrangler.jsonc is never touched.

import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export const workerDir = join(import.meta.dirname, "..");
export const configPath = join(workerDir, "wrangler.jsonc");
export const templatePath = join(workerDir, "wrangler.template.jsonc");

export const JURISDICTIONS = ["eu", "fedramp", "none"] as const;
export type Jurisdiction = (typeof JURISDICTIONS)[number];

export function ensureConfig(): void {
  if (existsSync(configPath)) return;
  copyFileSync(templatePath, configPath);
  console.log(`Created ${configPath} from wrangler.template.jsonc.`);
}

// The config's text with the database's id (in place of the placeholder or an earlier id) and the bucket's
// jurisdiction (set, replaced, or removed for "none"), the rest as it was; or what couldn't be found.
export function withAccount(config: string, bucket: string, databaseId: string, jurisdiction: Jurisdiction): string | { error: string } {
  const idPattern = /("database_id":\s*")[0-9a-f-]{36}(")/;
  if (!idPattern.test(config)) return { error: `Couldn't find "database_id"` };
  const withId = config.replace(idPattern, `$1${databaseId}$2`);
  const binding = new RegExp(`\\{[^{}]*"bucket_name":\\s*"${bucket}"[^{}]*\\}`).exec(withId)?.[0];
  if (!binding) return { error: `Couldn't find the bucket ${bucket}` };
  const bare = binding.replace(/,\s*"jurisdiction":\s*"[^"]*"/, "");
  const next = jurisdiction === "none" ? bare : bare.replace(/\s*\}$/, `, "jurisdiction": "${jurisdiction}" }`);
  return withId.replace(binding, next);
}

if (import.meta.main) ensureConfig();
