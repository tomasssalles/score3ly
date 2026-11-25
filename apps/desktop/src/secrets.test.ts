import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { getPlatformProxy } from "wrangler";
import { localDevConfigPath, NO_ENV_FILES, writeLocalDevConfig } from "../../worker/scripts/config.ts";
import { parseSecrets, SecretsFile, SECRETS_EXAMPLE } from "./secrets.ts";

// A secrets file as a user writes one: a comment after a bare value, `export`, quotes of each kind, a service
// account's JSON key over several lines in single quotes (its "\n" kept for JSON to read), "\n" in double quotes.
const EXAMPLE = [
  "# a comment",
  "",
  "A=plain value  # trailing comment",
  "export B=exported",
  "C='single # not a comment'",
  'D="two\nlines"',
  "VERTEX_SERVICE_ACCOUNT='{",
  '  "type": "service_account",',
  '  "private_key": "-----BEGIN PRIVATE KEY-----\\nMII\\n-----END PRIVATE KEY-----\\n"',
  "}'",
  "not a line",
  "F=",
].join("\n");

test("NAME=value lines as .dev.vars has them", () => {
  const secrets = parseSecrets(EXAMPLE);
  assert.deepEqual(secrets, {
    A: "plain value",
    B: "exported",
    C: "single # not a comment",
    D: "two\nlines",
    VERTEX_SERVICE_ACCOUNT: '{\n  "type": "service_account",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\nMII\\n-----END PRIVATE KEY-----\\n"\n}',
    F: "",
  });
  assert.equal(JSON.parse(secrets.VERTEX_SERVICE_ACCOUNT).private_key, "-----BEGIN PRIVATE KEY-----\nMII\n-----END PRIVATE KEY-----\n");
});

// The rule of the desktop's secrets file is the Worker's .dev.vars' (docs/desktop.md): the same file read by Wrangler,
// as `wrangler dev` reads .dev.vars, gives the same values (review E20).
test("secrets.env and .dev.vars read the same example the same", async () => {
  writeLocalDevConfig();
  const file = join(mkdtempSync(join(tmpdir(), "score3ly-secrets-")), ".dev.vars");
  writeFileSync(file, EXAMPLE);
  const proxy = await getPlatformProxy<Record<string, unknown>>({ configPath: localDevConfigPath, persist: false, envFiles: [file] });
  try {
    const secrets = parseSecrets(EXAMPLE);
    assert.deepEqual(Object.fromEntries(Object.keys(secrets).map((name) => [name, proxy.env[name]])), secrets);
  } finally {
    await proxy.dispose();
  }
  // And without the file, none of them: the comparison isn't Wrangler finding them elsewhere.
  const none = await getPlatformProxy<Record<string, unknown>>({ configPath: localDevConfigPath, persist: false, envFiles: NO_ENV_FILES });
  try {
    assert.equal(none.env.VERTEX_SERVICE_ACCOUNT, undefined);
  } finally {
    await none.dispose();
  }
});

test("the example has no secrets", () => {
  assert.deepEqual(parseSecrets(SECRETS_EXAMPLE), {});
});

test("the file is created with the example, for the user only, and read again when it changes", () => {
  const path = join(mkdtempSync(join(tmpdir(), "score3ly-secrets-")), "secrets.env");
  const file = new SecretsFile(path);
  assert.equal(readFileSync(path, "utf8"), SECRETS_EXAMPLE);
  if (process.platform !== "win32") assert.equal(statSync(path).mode & 0o777, 0o600);
  assert.deepEqual(file.read(), {});
  writeFileSync(path, "KEY=one\n");
  assert.deepEqual(file.read(), { KEY: "one" });
  writeFileSync(path, "KEY=two-longer\n");
  assert.deepEqual(file.read(), { KEY: "two-longer" });
});
