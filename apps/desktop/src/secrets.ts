// The secrets of the desktop version (DESIGN.md §3): a file in the app's data folder, in the same `NAME=value` format
// as `.dev.vars` (§10). Created on first start with a commented example, readable by the user only; read again
// whenever it changes, so new keys work without a restart.

import { chmodSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";

export const SECRETS_EXAMPLE = `# score3ly's secrets: one NAME=value per line. A model config (Settings) names the secrets it uses, e.g.
#
# ANTHROPIC_API_KEY=sk-ant-...
# GEMINI_API_KEY=...
#
# A value in double quotes may span lines and use \\n, e.g. a Google service account's JSON key:
#
# VERTEX_SERVICE_ACCOUNT="{
#   \\"type\\": \\"service_account\\",
#   ...
# }"
#
# Lines starting with # are comments. Changes take effect at once, without restarting the app.
`;

// `NAME=value` lines, as dotenv and Wrangler's .dev.vars have them: comments, blank lines, an optional "export ",
// values in single quotes (as they are), in double quotes (escapes, and possibly several lines) or bare (trimmed,
// up to a " #" comment).
export function parseSecrets(text: string): Record<string, string> {
  const secrets: Record<string, string> = {};
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(lines[i]);
    if (!match) continue;
    const [, name] = match;
    let value = match[2];
    if (value.startsWith('"')) {
      let raw = value.slice(1);
      while (!/(^|[^\\])(\\\\)*"\s*(#.*)?$/.test(raw) && i + 1 < lines.length) raw += "\n" + lines[++i];
      raw = raw.replace(/"\s*(#.*)?$/, "");
      value = raw.replace(/\\([nrt"\\])/g, (_, c: string) => ({ n: "\n", r: "\r", t: "\t", '"': '"', "\\": "\\" })[c]!);
    } else if (value.startsWith("'")) {
      value = value.slice(1).replace(/'\s*(#.*)?$/, "");
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }
    secrets[name] = value;
  }
  return secrets;
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
