// Page images for the pipeline and the artifact view (docs/stages/pages.md): taken from the device's cache, or
// computed from their recipe by a Web Worker (pageImageWorker.ts) and cached. A page is computed only when
// something needs it (§5.3).
//
// Fingerprints (§8.3): every image made here is fingerprinted, and the fingerprint kept next to it in the cache. An
// image made because the cache didn't have it is checked against the fingerprint stored for its recipe, if any; one
// that differs marks its page (the page image it was made from) as differing on this device, which the views and the
// running stage's card show. Stages and editors store the fingerprints of the images their results are computed from
// (`keepFingerprints`).

import { compareFingerprints, type Fingerprint } from "@score3ly/imaging";
import { fetchFingerprint, storeFingerprints } from "./api";
import { cachedImage, cacheImage, cachedJson, cacheJson } from "./imageCache";
import { keyOf } from "@score3ly/core";
import { pdfUrl } from "./pdf";
import type { PageImageRequest, PageImageResponse } from "./pageImageWorker";
import type { PageRecipe } from "./rasterize";
import type { Box, DrawOptions, LayoutSystem, SizeLimit, Skew } from "@score3ly/imaging";

// A request without its id (Omit on each member of the union, not on the union).
type Unsent = PageImageRequest extends infer R ? (R extends PageImageRequest ? Omit<R, "id"> : never) : never;

type Pending = { resolve: (response: PageImageResponse) => void; reject: (error: Error) => void };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();
// The PDFs opened in the worker: what pdf.js says about them.
const opened = new Map<string, Promise<{ pageCount: number; pdfjsVersion: string }>>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./pageImageWorker.ts", import.meta.url), { type: "module" });
  worker.addEventListener("message", (event: MessageEvent<PageImageResponse>) => {
    const waiting = pending.get(event.data.id);
    if (!waiting) return;
    pending.delete(event.data.id);
    if (event.data.type === "error") waiting.reject(new Error(event.data.message));
    else waiting.resolve(event.data);
  });
  worker.addEventListener("error", (event) => {
    // The worker itself failed (e.g. it couldn't load): every request waiting for it fails.
    for (const waiting of pending.values()) waiting.reject(new Error(event.message || "The page image worker failed."));
    pending.clear();
    opened.clear();
    worker = null;
  });
  return worker;
}

function ask(request: Unsent, transfer: Transferable[] = []): Promise<PageImageResponse> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ ...request, id }, transfer);
  });
}

// Opens the project's PDF in the worker (once per page load), and says how many pages it has.
export function openPdfForImages(sha256: string): Promise<{ pageCount: number; pdfjsVersion: string }> {
  let result = opened.get(sha256);
  if (!result) {
    result = (async () => {
      const response = await fetch(pdfUrl(sha256));
      if (!response.ok) throw new Error(`Loading the PDF failed (HTTP ${response.status}).`);
      const pdf = await response.arrayBuffer();
      const answer = await ask({ type: "open", sha256, pdf }, [pdf]);
      if (answer.type !== "opened") throw new Error("Unexpected answer from the page image worker.");
      return { pageCount: answer.pageCount, pdfjsVersion: answer.pdfjsVersion };
    })();
    opened.set(sha256, result);
    result.catch(() => opened.delete(sha256));
  }
  return result;
}

// A page image as a PNG: from the cache, or computed now and cached. `computed` says which.
export async function pageImage(recipe: PageRecipe): Promise<{ png: Blob; computed: boolean }> {
  const key = await keyOf(recipe);
  const cached = await cachedImage(key, recipe.pdf);
  if (cached) return { png: cached, computed: false };
  await openPdfForImages(recipe.pdf);
  const answer = await ask({ type: "page", sha256: recipe.pdf, page: recipe.page, dpi: recipe.dpi });
  if (answer.type !== "page") throw new Error("Unexpected answer from the page image worker.");
  await cacheImage(key, answer.png, recipe.pdf);
  await made(key, recipe, answer.fingerprint);
  return { png: new Blob([answer.png], { type: "image/png" }), computed: true };
}

// The skew of a page image (docs/stages/pages.md, "Finding the skew"), measured in the worker.
export async function measureSkew(png: Blob, maxAngle: number): Promise<Skew> {
  const bytes = await png.arrayBuffer();
  const answer = await ask({ type: "skew", png: bytes, maxAngle }, [bytes]);
  if (answer.type !== "skew") throw new Error("Unexpected answer from the page image worker.");
  return answer.skew;
}

// A page straightened by an angle (docs/images.md §8.6): what `layout` and later stages see, and what the layout's
// artifact shows. Null angle: the page as it is.
export type StraightRecipe = { page: PageRecipe; angle: number | null; deskew: number; rotate: number };

// A straightened page shrunk to a model's limits: the image sent in requests.
export type ModelPageRecipe = { straight: StraightRecipe; limit: SizeLimit; scale: number };

type DeriveOptions = { angle?: number; crop?: Box; limit?: SizeLimit; draw?: LayoutSystem[]; drawOptions?: DrawOptions; gray?: boolean };

type Derived = { png: Uint8Array<ArrayBuffer>; fingerprint: Fingerprint };

async function derive(png: Blob, options: DeriveOptions): Promise<Derived> {
  const bytes = await png.arrayBuffer();
  const answer = await ask({ type: "derive", png: bytes, ...options }, [bytes]);
  if (answer.type !== "derived") throw new Error("Unexpected answer from the page image worker.");
  return answer;
}

async function cachedOr(recipe: unknown, make: () => Promise<Derived>): Promise<Blob> {
  const key = await keyOf(recipe);
  const pdf = pdfOf(recipe);
  const cached = await cachedImage(key, pdf);
  if (cached) return cached;
  const { png, fingerprint } = await make();
  await cacheImage(key, png, pdf);
  await made(key, recipe, fingerprint);
  return new Blob([png], { type: "image/png" });
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
  const answer = await ask({ type: "fingerprint", png: bytes }, [bytes]);
  if (answer.type !== "fingerprint") throw new Error("Unexpected answer from the page image worker.");
  await cacheJson(fingerprintName(key), answer.fingerprint, pdf);
  return answer.fingerprint;
}

// Stores the fingerprints of images a stored result was computed from (one already stored for a recipe stays).
// Best effort: a fingerprint that can't be stored only means one check less later.
export async function keepFingerprints(images: { recipe: unknown; png: Blob }[]): Promise<void> {
  try {
    const fingerprints = await Promise.all(
      images.map(async ({ recipe, png }) => {
        const recipeKey = await keyOf(recipe);
        const pdfSha256 = pdfOf(recipe);
        return { ...(await fingerprintOf(recipeKey, pdfSha256, png)), recipeKey, pdfSha256 };
      }),
    );
    for (let i = 0; i < fingerprints.length; i += 100) await storeFingerprints(fingerprints.slice(i, i + 100));
  } catch (err) {
    console.warn("Storing fingerprints failed:", err);
  }
}

export async function straightPage(recipe: StraightRecipe): Promise<Blob> {
  if (recipe.angle === null) return (await pageImage(recipe.page)).png;
  return cachedOr(recipe, async () => derive((await pageImage(recipe.page)).png, { angle: recipe.angle! }));
}

export async function modelPage(recipe: ModelPageRecipe): Promise<Blob> {
  return cachedOr(recipe, async () => derive(await straightPage(recipe.straight), { limit: recipe.limit }));
}

// A part of a straightened page shrunk to a model's limits (docs/images.md §8.6): the system and stretch crops `extract`
// sends, and its artifact shows. The box is a fraction of the straightened page, margins included; `crop` is the crop
// code's version (CROP_VERSION).
export type CropRecipe = { straight: StraightRecipe; box: Box; crop: number; limit: SizeLimit; scale: number };

export async function cropImage(recipe: CropRecipe): Promise<Blob> {
  return cachedOr(recipe, async () => derive(await straightPage(recipe.straight), { crop: recipe.box, limit: recipe.limit }));
}

// The image sent to a model with its layout drawn on it, for it to check (`layout`'s rounds). Cached under its recipe
// like the others: the drawing is ours and deterministic. `draw` is the drawing code's version (DRAW_VERSION).
export type DrawnPageRecipe = { page: ModelPageRecipe; systems: LayoutSystem[]; draw: number };

export async function drawnPage(recipe: DrawnPageRecipe): Promise<Blob> {
  return cachedOr(recipe, async () => derive(await modelPage(recipe.page), { draw: recipe.systems }));
}

// A page sent to a model with its layout drawn on it, labelled for `analyze` (systems numbered in the whole score from
// `first`, bar lines numbered), in colour or gray (docs/stages/analyze.md). Cached under its recipe: the drawing is ours and
// deterministic. `draw` is the drawing code's version (DRAW_VERSION).
export type LayoutPageRecipe = {
  page: ModelPageRecipe;
  systems: LayoutSystem[];
  first: number;
  barLineNumbers: boolean;
  gray: boolean;
  draw: number;
};

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
  const view = new DataView(await png.slice(16, 24).arrayBuffer());
  return { width: view.getUint32(0), height: view.getUint32(4) };
}
