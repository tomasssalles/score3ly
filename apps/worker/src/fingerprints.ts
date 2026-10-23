// Fingerprints of the images from which stored results were computed (DESIGN.md §8.3): stored once per recipe key,
// by the first device that computed a result from the image, and read by any device that makes the image again.

import type { Hono } from "hono";

export type Fingerprint = {
  recipeKey: string;
  pdfSha256: string;
  version: number;
  width: number;
  height: number;
  pixelsSha256: string;
  thumbnail: string; // base64, grayscale, row by row
  thumbnailWidth: number;
  thumbnailHeight: number;
};

type Row = {
  recipe_key: string;
  pdf_sha256: string;
  version: number;
  width: number;
  height: number;
  pixels_sha256: string;
  thumbnail: string;
  thumbnail_width: number;
  thumbnail_height: number;
};

const HEX64 = /^[0-9a-f]{64}$/;
const positive = (n: unknown) => Number.isInteger(n) && (n as number) > 0;

function problem(f: Fingerprint): string | null {
  if (!HEX64.test(f?.recipeKey ?? "") || !HEX64.test(f?.pdfSha256 ?? "") || !HEX64.test(f?.pixelsSha256 ?? "")) {
    return "'recipeKey', 'pdfSha256' and 'pixelsSha256' must be SHA-256 hashes";
  }
  if (![f.version, f.width, f.height, f.thumbnailWidth, f.thumbnailHeight].every(positive)) return "sizes and version must be whole numbers above 0";
  if (typeof f.thumbnail !== "string" || !/^[A-Za-z0-9+/]*=*$/.test(f.thumbnail) || f.thumbnail.length > 8 * 1024) {
    return "'thumbnail' must be base64, at most 8 KB";
  }
  return null;
}

export function fingerprintRoutes(app: Hono<{ Bindings: Env }>) {
  // The fingerprint stored for an image's recipe, or null.
  app.get("/api/fingerprints/:recipeKey", async (c) => {
    const row = await c.env.DB.prepare("SELECT * FROM image_fingerprints WHERE recipe_key = ?").bind(c.req.param("recipeKey")).first<Row>();
    if (!row) return c.json({ fingerprint: null });
    const fingerprint: Fingerprint = {
      recipeKey: row.recipe_key,
      pdfSha256: row.pdf_sha256,
      version: row.version,
      width: row.width,
      height: row.height,
      pixelsSha256: row.pixels_sha256,
      thumbnail: row.thumbnail,
      thumbnailWidth: row.thumbnail_width,
      thumbnailHeight: row.thumbnail_height,
    };
    return c.json({ fingerprint });
  });

  // Stores fingerprints; one already stored for a recipe key stays as it is (the first result computed from it).
  app.post("/api/fingerprints", async (c) => {
    const body = await c.req.json().catch(() => null);
    const list = body?.fingerprints as Fingerprint[] | undefined;
    if (!Array.isArray(list) || list.length === 0 || list.length > 100) return c.json({ error: "expected 1 to 100 'fingerprints'" }, 400);
    const bad = list.map(problem).find((p) => p);
    if (bad) return c.json({ error: bad }, 400);
    const db = c.env.DB;
    const now = new Date().toISOString();
    await db.batch(
      list.map((f) =>
        db
          .prepare(
            "INSERT OR IGNORE INTO image_fingerprints (recipe_key, pdf_sha256, version, width, height, pixels_sha256, thumbnail, thumbnail_width, thumbnail_height, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .bind(f.recipeKey, f.pdfSha256, f.version, f.width, f.height, f.pixelsSha256, f.thumbnail, f.thumbnailWidth, f.thumbnailHeight, now),
      ),
    );
    return c.body(null, 204);
  });
}
