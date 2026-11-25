// The Worker's object storage (docs/overview.md §2): R2 on Cloudflare, a folder of files on the desktop, behind the
// binding `STORE`. Every object is stored under the SHA-256 of its bytes, so objects never change: the original PDFs
// under `pdfs/<sha256>.pdf`, everything else (stage outputs' content, LLM calls' requests and responses) under
// `content/<sha256>`. The keys are made here only. Objects no row refers to any more are collected (`collectOrphans`).

import type { Hono } from "hono";
import { canonicalJson, isSha256Hex, MISSING_CONTENT_BATCH, sha256Hex } from "@score3ly/core";
import { badRequest, refuse } from "./refusals.ts";

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

// Whether a row refers to the content whose hash is in `column`: a stored output's, or the request or response of a call
// that isn't marked deleted (or that an output names). The same rule as `collectOrphans`'s, as a condition, for the
// import's content check (`content/missing`); each part can use its index (migration 0008).
const callKeeps = "(c.deleted_at IS NULL OR EXISTS (SELECT 1 FROM outputs n WHERE n.call_id = c.id))";
export const contentNamed = (column: string) => `(
  EXISTS (SELECT 1 FROM outputs o WHERE o.content_sha256 = ${column})
  OR EXISTS (SELECT 1 FROM llm_calls c WHERE c.request_sha256 = ${column} AND ${callKeeps})
  OR EXISTS (SELECT 1 FROM llm_calls c WHERE c.response_sha256 = ${column} AND ${callKeeps}))`;

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

// Objects never change, so a browser may keep them for good.
const FOREVER = "private, max-age=31536000, immutable";

export function storageRoutes(app: Hono<{ Bindings: Env }>) {
  // The PDF itself.
  app.get("/api/pdfs/:sha256/file", async (c) => {
    const sha256 = c.req.param("sha256");
    if (!isSha256Hex(sha256)) return badRequest(c, "expected a SHA-256 in lowercase hex");
    const object = await c.env.STORE.get(pdfKey(sha256));
    if (!object) return refuse(c, 404, "The server doesn't have this PDF.");
    return new Response(object.body, {
      headers: { "Content-Type": "application/pdf", "Content-Length": String(object.size), "Cache-Control": FOREVER },
    });
  });

  // Stores a PDF under its hash (R2 checks the bytes), before a project is made on it (a create, an import).
  app.put("/api/pdfs/:sha256", async (c) => {
    const sha256 = c.req.param("sha256");
    if (!isSha256Hex(sha256)) return badRequest(c, "expected a SHA-256 in lowercase hex");
    if ((await storePdf(c.env.STORE, sha256, await c.req.arrayBuffer())) === "mismatch") {
      return refuse(c, 400, "The PDF arrived damaged. Try again. Details: it doesn't match its SHA-256.");
    }
    return c.body(null, 204);
  });

  // Stored outputs' content (docs/overview.md §2): any file, under the SHA-256 of its bytes, which the store checks.
  // Storing the same content again is harmless.
  app.put("/api/content/:sha256", async (c) => {
    const sha256 = c.req.param("sha256");
    if (!isSha256Hex(sha256)) return badRequest(c, "expected a SHA-256 in lowercase hex");
    const body = await c.req.arrayBuffer();
    const stored = await storeContent(c.env.STORE, sha256, body, c.req.header("Content-Type") ?? "application/octet-stream");
    if (stored === "mismatch") return refuse(c, 400, "The content arrived damaged. Try again. Details: it doesn't match its SHA-256.");
    return c.body(null, 204);
  });

  app.get("/api/content/:sha256", async (c) => {
    const sha256 = c.req.param("sha256");
    if (!isSha256Hex(sha256)) return badRequest(c, "expected a SHA-256 in lowercase hex");
    const object = await getContent(c.env.STORE, sha256);
    if (!object) return refuse(c, 404, "The server doesn't have this stored content.");
    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
        "Content-Length": String(object.size),
        "Cache-Control": FOREVER,
      },
    });
  });

  // Which of these content objects an import must upload: those not stored, and those no row names (the code review's
  // E9: an orphan, which a deletion elsewhere may collect before the import's rows name it; uploaded again, it is young,
  // and so safe from collection for an hour). Each stored one is one look into R2, about 0.3 ms of a Worker's CPU, made
  // at once: at most MISSING_CONTENT_BATCH (20) per request (the owner, 2026-11-24, E1).
  app.post("/api/content/missing", async (c) => {
    const body = (await c.req.json().catch(() => null)) as { sha256s?: unknown } | null;
    if (!Array.isArray(body?.sha256s) || !body.sha256s.every(isSha256Hex) || body.sha256s.length > MISSING_CONTENT_BATCH) {
      return badRequest(c, `expected 'sha256s', at most ${MISSING_CONTENT_BATCH} SHA-256s in lowercase hex`);
    }
    const asked = body.sha256s as string[];
    const { results } = await c.env.DB.prepare(`SELECT DISTINCT j.value AS sha FROM json_each(?) j WHERE ${contentNamed("j.value")}`)
      .bind(JSON.stringify(asked))
      .all<{ sha: string }>();
    const named = new Set(results.map((r) => r.sha));
    const stored = await Promise.all(asked.map(async (sha) => named.has(sha) && (await c.env.STORE.head(contentKey(sha))) !== null));
    return c.json({ missing: asked.filter((_, i) => !stored[i]) });
  });
}
