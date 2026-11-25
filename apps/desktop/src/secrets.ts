// The secrets of the desktop version (docs/desktop.md): a file in the app's data folder, in the same `NAME=value` format
// as `.dev.vars` (§10). Created on first start with a commented example, readable by the user only; read again
// whenever it changes, so new keys work without a restart.

import { chmodSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";

export const SECRETS_EXAMPLE = `# score3ly's secrets: one NAME=value per line. A model config (Settings) names the secrets it uses, e.g.
#
# ANTHROPIC_API_KEY=sk-ant-...
# GEMINI_API_KEY=...
#
# A value in single quotes may span lines and is taken as it is, e.g. a Google service account's JSON key:
#
# VERTEX_SERVICE_ACCOUNT='{
#   "type": "service_account",
#   ...
# }'
#
# Lines starting with # are comments. Changes take effect at once, without restarting the app.
`;

// `NAME=value` lines, read by Node's `util.parseEnv` (dotenv's format, decided 2026-11-17: review E20): comments, blank
// lines, an optional "export ", values bare (trimmed, up to a " #" comment), in single quotes (as they are) or in double
// quotes ("\n" a new line), the quoted ones possibly over several lines. Wrangler reads .dev.vars by the same rule
// (dotenv), with two differences no key should meet: it replaces "$NAME" in a value with another variable's value, and
// keeps a \" inside double quotes, where this ends the value.
export function parseSecrets(text: string): Record<string, string> {
  return { ...parseEnv(text) } as Record<string, string>;
}

// The file's secrets, read again only when it changed.
export class SecretsFile {
  private cached: { mtimeMs: number; size: number; secrets: Record<string, string> } | null = null;

  readonly path: string;

  constructor(path: string) {
    this.path = path;
    if (!existsSync(path)) writeFileSync(path, SECRETS_EXAMPLE, { mode: 0o600 });
    try {
      chmodSync(path, 0o600);
    } catch {
      // Windows: permissions are the folder's.
    }
  }

  read(): Record<string, string> {
    let stat;
    try {
      stat = statSync(this.path);
    } catch {
      return {};
    }
    if (!this.cached || this.cached.mtimeMs !== stat.mtimeMs || this.cached.size !== stat.size) {
      this.cached = { mtimeMs: stat.mtimeMs, size: stat.size, secrets: parseSecrets(readFileSync(this.path, "utf8")) };
    }
    return this.cached.secrets;
  }
}
