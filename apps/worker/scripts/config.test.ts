import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { formatAccount, parseAccount, templatePath, withAccount } from "./config.ts";

const template = readFileSync(templatePath, "utf8");
const ID = "0123abcd-4567-89ef-0123-456789abcdef";
const PLACEHOLDER = "00000000-0000-0000-0000-000000000000";

test("the template has the placeholder id and a bucket without a jurisdiction", () => {
  assert.match(template, new RegExp(`"database_id": "${PLACEHOLDER}"`));
  assert.match(template, /\{ "binding": "PDFS", "bucket_name": "score3ly-pdfs" \}/);
});

test("withAccount writes the id and the bucket's jurisdiction, and changes nothing else", () => {
  assert.equal(
    withAccount(template, { jurisdiction: "eu", databaseId: ID }),
    template
      .replace(PLACEHOLDER, ID)
      .replace('"bucket_name": "score3ly-pdfs" }', '"bucket_name": "score3ly-pdfs", "jurisdiction": "eu" }'),
  );
  assert.equal(withAccount(template, { jurisdiction: "none", databaseId: ID }), template.replace(PLACEHOLDER, ID));
});

test("withAccount says what it couldn't find", () => {
  assert.deepEqual(withAccount("{}", { jurisdiction: "eu", databaseId: ID }), { error: `Couldn't find "database_id"` });
  assert.deepEqual(withAccount(template.replace("score3ly-pdfs", "other"), { jurisdiction: "eu", databaseId: ID }), {
    error: "Couldn't find the bucket score3ly-pdfs",
  });
});

test("cloudflare.env is read back as written, and refused where it is incomplete", () => {
  for (const jurisdiction of ["eu", "fedramp", "none"] as const)
    assert.deepEqual(parseAccount(formatAccount({ jurisdiction, databaseId: ID })), { jurisdiction, databaseId: ID });
  assert.deepEqual(parseAccount(`CLOUDFLARE_JURISDICTION="eu"\nCLOUDFLARE_D1_ID = ${ID}\n`), { jurisdiction: "eu", databaseId: ID });
  assert.ok("error" in parseAccount(`CLOUDFLARE_D1_ID=${ID}`));
  assert.ok("error" in parseAccount(`CLOUDFLARE_JURISDICTION=us\nCLOUDFLARE_D1_ID=${ID}`));
  assert.ok("error" in parseAccount("CLOUDFLARE_JURISDICTION=eu\nCLOUDFLARE_D1_ID=abc"));
});
