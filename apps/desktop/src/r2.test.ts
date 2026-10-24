import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { NodeR2 } from "./r2.ts";

function fresh(): NodeR2 {
  return new NodeR2(mkdtempSync(join(tmpdir(), "score3ly-r2-")));
}

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

test("put, head, get and delete an object, with its content type", async () => {
  const r2 = fresh();
  const text = JSON.stringify({ a: 1 });
  await r2.put("content/x", new TextEncoder().encode(text).buffer, { sha256: sha256(text), httpMetadata: { contentType: "application/json" } });
  const head = await r2.head("content/x");
  assert.equal(head?.size, text.length);
  assert.equal(head?.httpMetadata.contentType, "application/json");
  const object = await r2.get("content/x");
  assert.deepEqual(await object?.json(), { a: 1 });
  assert.equal(await new Response(object!.body).text(), text);
  await r2.delete(["content/x"]);
  assert.equal(await r2.get("content/x"), null);
  assert.equal(await r2.head("content/x"), null);
});

test("content that doesn't match its SHA-256 is refused", async () => {
  const r2 = fresh();
  await assert.rejects(r2.put("pdfs/a.pdf", new TextEncoder().encode("abc").buffer, { sha256: sha256("abd") }));
  assert.equal(await r2.head("pdfs/a.pdf"), null);
});

test("keys can't leave the folder", async () => {
  const r2 = fresh();
  await assert.rejects(r2.put("../outside", "x"));
  await assert.rejects(r2.put("content/x.type", "x"));
});

test("listing goes by prefix, in pages", async () => {
  const r2 = fresh();
  for (const key of ["content/b", "content/a", "content/c", "pdfs/z.pdf"]) await r2.put(key, key, { httpMetadata: { contentType: "text/plain" } });
  const first = await r2.list({ prefix: "content/", limit: 2 });
  assert.deepEqual(first.objects.map((o) => o.key), ["content/a", "content/b"]);
  assert.equal(first.truncated, true);
  const second = await r2.list({ prefix: "content/", limit: 2, cursor: first.cursor });
  assert.deepEqual(second.objects.map((o) => o.key), ["content/c"]);
  assert.equal(second.truncated, false);
  assert.ok(second.objects[0].uploaded instanceof Date);
});
