import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { templatePath, withAccount } from "./config.ts";

const template = readFileSync(templatePath, "utf8");
const ID = "0123abcd-4567-89ef-0123-456789abcdef";

test("the template has the placeholder id and a bucket without a jurisdiction", () => {
  assert.match(template, /"database_id": "00000000-0000-0000-0000-000000000000"/);
  assert.match(template, /\{ "binding": "PDFS", "bucket_name": "score3ly-pdfs" \}/);
});

test("withAccount writes the id and the bucket's jurisdiction, and changes nothing else", () => {
  const eu = withAccount(template, "score3ly-pdfs", ID, "eu");
  assert.equal(typeof eu, "string");
  assert.equal(
    eu,
    template
      .replace("00000000-0000-0000-0000-000000000000", ID)
      .replace('"bucket_name": "score3ly-pdfs" }', '"bucket_name": "score3ly-pdfs", "jurisdiction": "eu" }'),
  );
});

test("withAccount run again replaces the jurisdiction, or removes it for none", () => {
  const eu = withAccount(template, "score3ly-pdfs", ID, "eu") as string;
  assert.equal(withAccount(eu, "score3ly-pdfs", ID, "eu"), eu);
  const fedramp = withAccount(eu, "score3ly-pdfs", ID, "fedramp") as string;
  assert.match(fedramp, /"bucket_name": "score3ly-pdfs", "jurisdiction": "fedramp" \}/);
  assert.doesNotMatch(fedramp, /"eu"/);
  assert.equal(withAccount(fedramp, "score3ly-pdfs", ID, "none"), template.replace("00000000-0000-0000-0000-000000000000", ID));
});

test("withAccount says what it couldn't find", () => {
  assert.deepEqual(withAccount("{}", "score3ly-pdfs", ID, "eu"), { error: `Couldn't find "database_id"` });
  assert.deepEqual(withAccount(template, "other", ID, "eu"), { error: "Couldn't find the bucket other" });
});
