import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parseSecrets, SecretsFile, SECRETS_EXAMPLE } from "./secrets.ts";

test("NAME=value lines as .dev.vars has them", () => {
  const text = [
    "# a comment",
    "",
    "A=plain value  # trailing comment",
    "export B=exported",
    "C='single # not a comment'",
    'D="escaped\\nnewline \\"quoted\\""',
    'E="{',
    '  \\"type\\": \\"service_account\\"',
    '}"',
    "not a line",
    "F=",
  ].join("\n");
  assert.deepEqual(parseSecrets(text), {
    A: "plain value",
    B: "exported",
    C: "single # not a comment",
    D: 'escaped\nnewline "quoted"',
    E: '{\n  "type": "service_account"\n}',
    F: "",
  });
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
