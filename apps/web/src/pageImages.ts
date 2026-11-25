// Page images for the pipeline and the artifact view (docs/stages/pages.md): taken from the device's cache, or
// computed from their recipe by a Web Worker (pageImageWorker.ts) and cached. A page is computed only when
// something needs it (§5.3).
//
// Fingerprints (§8.3): every image made here is fingerprinted, and the fingerprint kept next to it in the cache. An
// image made because the cache didn't have it is checked against the fingerprint stored for its recipe, if any; one
// that differs marks its page (the page image it was made from) as differing on this device, which the views and the
// running stage's card show. Stages and editors store the fingerprints of the images their results are computed from
// (`keepFingerprints`).

import { compareFingerprints, pngSize as pngHeaderSize, type Fingerprint } from "@score3ly/imaging";
import { fetchFingerprint, fetchPdf, storeFingerprints } from "./api.ts";
import { cachedImage, cacheImage, cachedJson, cacheJson } from "./imageCache.ts";
import { noteImage } from "./itemTiming.ts";
import { errorText, keyOf } from "@score3ly/core";
import type { DeriveOptions, MadeImage, PageImageCalls } from "./pageImageWorker";
import { oneAtATime, workerClient } from "./workerClient.ts";
import type { CropRecipe, DrawnPageRecipe, LayoutPageRecipe, MarkedCropRecipe, ModelPageRecipe, PageRecipe, StraightRecipe } from "./recipes";
import type { Skew } from "@score3ly/imaging";

// The PDFs opened in the worker: what pdf.js says about them, the most recently used last. Gone with the worker, when
// it is replaced.
const opened = new Map<string, Promise<{ pageCount: number; pdfjsVersion: string }>>();

// How many PDFs the worker keeps open (each holds the whole file and what pdf.js parsed of it): the project open now,
// and the one before, the least recently used closed.
const OPEN_PDFS = 2;

const images = workerClient<PageImageCalls>(() => new Worker(new URL("./pageImageWorker.ts", import.meta.url), { type: "module" }), {
  failure: (detail) => detail || "The page image worker failed.",
  onReset: () => opened.clear(),
});

// Opens the project's PDF in the worker (once per page load), and says how many pages it has.
// `bytes` gives the file where the page has it (a PDF just picked), instead of fetching it from the Worker.
export function openPdfForImages(sha256: string, bytes?: () => Promise<ArrayBuffer>): Promise<{ pageCount: number; pdfjsVersion: string }> {
  let result = opened.get(sha256);
  if (result) {
    opened.delete(sha256);
    opened.set(sha256, result);
  } else {
    result = (async () => {
      const pdf = await (bytes ? bytes() : fetchPdf(sha256).then((pdf) => pdf.buffer)).catch((err) => {
        throw new Error(`Loading the PDF failed: ${errorText(err)}`);
      });
      return images.ask("open", { sha256, pdf }, [pdf]);
    })();
    const made = result;
    opened.set(sha256, made);
    made.catch(() => opened.get(sha256) === made && opened.delete(sha256));
    for (const [oldest] of opened) {
      if (opened.size <= OPEN_PDFS) break;
      closePdfForImages(oldest);
    }
  }
  return result;
}

// Closes a PDF in the worker (one not used for a while, or a deleted project's), freeing its memory.
export function closePdfForImages(sha256: string): void {
  if (!opened.delete(sha256)) return;
  images.ask("close", { sha256 }).catch(() => {}); // a worker that failed has closed it already
}

// A page image as a PNG: from the cache, or computed now and cached.
export function pageImage(recipe: PageRecipe): Promise<Blob> {
  return cachedOr(recipe, async () => {
    await openPdfForImages(recipe.pdf);
    return images.ask("page", { sha256: recipe.pdf, page: recipe.page, dpi: recipe.dpi });
  });
}

// The skew of a page image (docs/stages/pages.md, "Finding the skew"), measured in the worker.
export async function measureSkew(png: Blob, maxAngle: number): Promise<Skew> {
  const bytes = await png.arrayBuffer();
  return images.ask("skew", { png: bytes, maxAngle }, [bytes]);
}

async function derive(png: Blob, options: DeriveOptions): Promise<MadeImage> {
  const bytes = await png.arrayBuffer();
  return images.ask("derive", { png: bytes, ...options }, [bytes]);
}

// The images being made: one making per recipe at a time (a view and the running stage, or two images made from the
// same straightened page, asking at once).
const making = oneAtATime<Blob>();

// An image from the cache, or made now (`make`), cached, and its fingerprint kept and checked.
async function cachedOr(recipe: unknown, make: () => Promise<MadeImage>): Promise<Blob> {
  const key = await keyOf(recipe);
  let lookedUp = false;
  const image = await making(key, async () => {
    lookedUp = true;
    const pdf = pdfOf(recipe);
    const cached = await cachedImage(key, pdf);
    noteImage(cached !== null);
    if (cached) return cached;
    const { png, fingerprint } = await make();
    await cacheImage(key, png, pdf);
    await made(key, recipe, fingerprint);
    return new Blob([png], { type: "image/png" });
  });
  if (!lookedUp) noteImage(true); // made by another request: not made for this one
  return image;
}

// Fingerprints.

const fingerprintName = (key: string) => `${key}.fingerprint`;

// The page image a recipe is made from: the recipe itself, or the one inside it (every recipe leads back to one).
function pageRecipeOf(recipe: unknown): PageRecipe | null {
  if (!recipe || typeof recipe !== "object") return null;
  const r = recipe as Record<string, unknown>;
  if (typeof r.pdf === "string" && typeof r.page === "number" && typeof r.dpi === "number") return recipe as PageRecipe;
  for (const value of Object.values(r)) {
    const found = pageRecipeOf(value);
    if (found) return found;
  }
  return null;
}

// The PDF an image is made from.
function pdfOf(recipe: unknown): string {
  const page = pageRecipeOf(recipe);
  if (!page) throw new Error("An image recipe without its page.");
  return page.pdf;
}

// The pages (by their page image's recipe key) with an image that differs on this device from the one a stored
// result was computed from, and who wants to know.
const differing = new Set<string>();
const listeners = new Set<() => void>();

export function pageDiffers(pageKey: string): boolean {
  return differing.has(pageKey);
}

export function onImagesDiffer(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// An image was made from its recipe: its fingerprint is kept, and checked against the stored one. A check that can't
// be made (offline) is skipped: it is a warning, never a stop.
async function made(key: string, recipe: unknown, fingerprint: Fingerprint): Promise<void> {
  await cacheJson(fingerprintName(key), fingerprint, pdfOf(recipe));
  try {
    const stored = await fetchFingerprint(key);
    if (!stored || stored.version !== fingerprint.version || compareFingerprints(stored, fingerprint) !== "different") return;
  } catch {
    return;
  }
  const page = pageRecipeOf(recipe);
  if (!page) return;
  differing.add(await keyOf(page));
  for (const listener of listeners) listener();
}

// The fingerprint of an image as this device has it: kept from when it was made, or computed from the PNG.
async function fingerprintOf(key: string, pdf: string, png: Blob): Promise<Fingerprint> {
  const kept = (await cachedJson(fingerprintName(key), pdf)) as Fingerprint | null;
  if (kept) return kept;
  const bytes = await png.arrayBuffer();
  const fingerprint = await images.ask("fingerprint", bytes, [bytes]);
  await cacheJson(fingerprintName(key), fingerprint, pdf);
  return fingerprint;
}

// Stores the fingerprints of images a stored result was computed from (one already stored for a recipe stays).
// Best effort: a fingerprint that can't be stored only means one check less later.
export async function keepFingerprints(images: { recipe: unknown; png: Blob }[]): Promise<boolean> {
  try {
    const fingerprints = await Promise.all(
      images.map(async ({ recipe, png }) => {
        const recipeKey = await keyOf(recipe);
        const pdfSha256 = pdfOf(recipe);
        return { ...(await fingerprintOf(recipeKey, pdfSha256, png)), recipeKey, pdfSha256 };
      }),
    );
    for (let i = 0; i < fingerprints.length; i += 100) await storeFingerprints(fingerprints.slice(i, i + 100));
    return true;
  } catch (err) {
    console.warn("Storing fingerprints failed:", err);
    return false;
  }
}

// The recipes whose fingerprint this session stored: an editor's saves keep their page's once, not at every drag.
const fingerprinted = new Set<string>();

// An editor's page (§8.3): its fingerprint kept once per session, after the save and apart from it: making the image or
// storing its fingerprint failing doesn't make the save fail.
export async function keepFingerprintOnce(recipe: unknown, png: () => Promise<Blob>): Promise<void> {
  const key = await keyOf(recipe);
  if (fingerprinted.has(key)) return;
  fingerprinted.add(key);
  try {
    if (await keepFingerprints([{ recipe, png: await png() }])) return;
  } catch (err) {
    console.warn("Storing fingerprints failed:", err);
  }
  fingerprinted.delete(key);
}

// The images of the recipes in recipes.ts (docs/images.md §8.6). A straightened page with no angle is the page image.
export async function straightPage(recipe: StraightRecipe): Promise<Blob> {
  if (recipe.angle === null) return pageImage(recipe.page);
  return cachedOr(recipe, async () => derive(await pageImage(recipe.page), { angle: recipe.angle! }));
}

export async function modelPage(recipe: ModelPageRecipe): Promise<Blob> {
  return cachedOr(recipe, async () => derive(await straightPage(recipe.straight), { limit: recipe.limit }));
}

export async function cropImage(recipe: CropRecipe): Promise<Blob> {
  return cachedOr(recipe, async () => derive(await straightPage(recipe.straight), { crop: recipe.box, limit: recipe.limit }));
}

// The images with drawings on them are cached under their recipes like the others: the drawing is ours and
// deterministic.
export async function drawnPage(recipe: DrawnPageRecipe): Promise<Blob> {
  return cachedOr(recipe, async () => derive(await modelPage(recipe.page), { draw: recipe.systems }));
}

export async function markedCrop(recipe: MarkedCropRecipe): Promise<Blob> {
  if (recipe.boxes.length === 0) return cropImage(recipe.crop);
  return cachedOr(recipe, async () =>
    derive(await cropImage(recipe.crop), { draw: recipe.boxes.map((box) => ({ box, barLines: [] })), drawOptions: { labels: recipe.labels } }),
  );
}

export async function layoutPage(recipe: LayoutPageRecipe): Promise<Blob> {
  return cachedOr(recipe, async () =>
    derive(await modelPage(recipe.page), {
      draw: recipe.systems,
      drawOptions: { first: recipe.first, barLineNumbers: recipe.barLineNumbers },
      gray: recipe.gray,
    }),
  );
}

// A PNG's size, from its header.
export async function pngSize(png: Blob): Promise<{ width: number; height: number }> {
  return pngHeaderSize(new Uint8Array(await png.slice(0, 24).arrayBuffer()));
}
