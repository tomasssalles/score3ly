// The Worker's object storage (docs/overview.md §2): R2 on Cloudflare, a folder of files on the desktop, behind the
// binding `STORE`. Every object is stored under the SHA-256 of its bytes, so objects never change: the original PDFs
// under `pdfs/<sha256>.pdf`, everything else (stage outputs' content, LLM calls' requests and responses) under
// `content/<sha256>`. The keys are made here only. Objects no row refers to any more are collected (`collectOrphans`).

import { canonicalJson, sha256Hex } from "@score3ly/core";

export const PDF_PREFIX = "pdfs/";
export const CONTENT_PREFIX = "content/";

export function pdfKey(sha256: string): string {
  return `${PDF_PREFIX}${sha256}.pdf`;
}

export function contentKey(sha256: string): string {
  return `${CONTENT_PREFIX}${sha256}`;
}

// Stores bytes under a key with their SHA-256, which the store checks (R2, and the desktop's folder). "mismatch" when
// the bytes don't match the hash, which the caller refuses (400); any other failure (a full disk, R2 unavailable) is
// thrown, and answered as the server's failure (500), not as a mismatch (the code review's E8). The hash is computed
// here only after a failure, so a stored object costs no CPU time for it.
export async function putChecked(bucket: R2Bucket, key: string, bytes: ArrayBuffer, sha256: string, options: R2PutOptions = {}): Promise<"mismatch" | null> {
  try {
    await bucket.put(key, bytes, { ...options, sha256 });
    return null;
  } catch (err) {
    if ((await sha256Hex(bytes)) !== sha256) return "mismatch";
    throw err;
  }
}

// A PDF, under its hash (a project's create, an import).
export function storePdf(bucket: R2Bucket, sha256: string, bytes: ArrayBuffer): Promise<"mismatch" | null> {
  return putChecked(bucket, pdfKey(sha256), bytes, sha256);
}

// Content, under its hash, with its type (`PUT /api/content/<sha256>`).
export function storeContent(bucket: R2Bucket, sha256: string, bytes: ArrayBuffer, contentType: string): Promise<"mismatch" | null> {
  return putChecked(bucket, contentKey(sha256), bytes, sha256, { httpMetadata: { contentType } });
}

// A value as JSON content, in its canonical form (the same value is the same object); returns its hash.
export async function putJson(bucket: R2Bucket, value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const sha256 = await sha256Hex(bytes);
  await bucket.put(contentKey(sha256), bytes, { sha256, httpMetadata: { contentType: "application/json" } });
  return sha256;
}

export function getContent(bucket: R2Bucket, sha256: string): Promise<R2ObjectBody | null> {
  return bucket.get(contentKey(sha256));
}

// R2 objects younger than this are never collected: their rows may be on their way (content is uploaded before the
// row that refers to it is written, e.g. by a stage running on another device, or by an import's later chunks).
export const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

// What a collection removed: how many objects, and their size in bytes.
export type Collected = { objects: number; bytes: number };

// Which rows refer to content: a stored output's, and the request or response of a call that isn't marked deleted (or
// that an output names). As a condition on the hash in `column`, for the import's content check (`content/missing`),
// which must agree with `collectOrphans` on what is kept.
export const CONTENT_NAMED = (column: string) => `(
  EXISTS (SELECT 1 FROM outputs o WHERE o.content_sha256 = ${column})
  OR EXISTS (SELECT 1 FROM llm_calls c WHERE (c.request_sha256 = ${column} OR c.response_sha256 = ${column})
    AND (c.deleted_at IS NULL OR c.id IN (SELECT call_id FROM outputs WHERE call_id IS NOT NULL))))`;

// Deletes every object, uploaded before `before`, that no row refers to: a stored output's content, the request or
// response of a call that isn't marked (or that an output names), or the PDF of a project that isn't deleted. Lists the
// whole store (docs/database.md, "Deleting a project": run when a project is deleted, and by "Free up storage").
export async function collectOrphans(env: Env, before: Date): Promise<Collected> {
  const db = env.DB;
  const [contents, calls, pdfs] = await db.batch<Record<string, string | null>>([
    db.prepare("SELECT DISTINCT content_sha256 AS k FROM outputs WHERE content_sha256 IS NOT NULL"),
    db.prepare(
      "SELECT request_sha256 AS r, response_sha256 AS s FROM llm_calls WHERE deleted_at IS NULL OR id IN (SELECT call_id FROM outputs WHERE call_id IS NOT NULL)",
    ),
    db.prepare("SELECT DISTINCT pdf_sha256 AS k FROM projects WHERE deleted_at IS NULL"),
  ]);
  const used = new Set<string>();
  for (const row of contents.results) used.add(contentKey(row.k!));
  for (const row of calls.results) {
    if (row.r) used.add(contentKey(row.r));
    if (row.s) used.add(contentKey(row.s));
  }
  for (const row of pdfs.results) used.add(pdfKey(row.k!));
  const collected: Collected = { objects: 0, bytes: 0 };
  for (const prefix of [CONTENT_PREFIX, PDF_PREFIX]) {
    let cursor: string | undefined;
    do {
      const page = await env.STORE.list({ prefix, cursor, limit: 1000 });
      const orphans = page.objects.filter((o) => !used.has(o.key) && o.uploaded < before);
      if (orphans.length > 0) await env.STORE.delete(orphans.map((o) => o.key));
      collected.objects += orphans.length;
      for (const o of orphans) collected.bytes += o.size;
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  }
  return collected;
}
