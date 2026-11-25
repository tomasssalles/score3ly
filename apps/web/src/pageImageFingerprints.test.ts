// B7 (code review): the fingerprint check (docs/images.md §8.3) on a page image made fresh. Before the page images'
// code had a version in their recipe, a change of that code (imaging's pdfPages.ts) made images under the same key
// as before: the fingerprint stored for what the old code made was checked against the new image, and the page was
// marked as differing on the very device that had made both. Here a page image is made through pageImages.ts as the
// app makes it, with the page image worker and the Worker's fingerprint route stood in for.

import { test } from "node:test";
import assert from "node:assert/strict";
import { keyOf } from "@score3ly/core";
import { fingerprintOf, type Fingerprint, type RgbaImage } from "@score3ly/imaging";

// The device's OPFS: files kept in maps.
class Folder {
  files = new Map<string, Blob>();
  folders = new Map<string, Folder>();
  async getDirectoryHandle(name: string) {
    if (!this.folders.has(name)) this.folders.set(name, new Folder());
    return this.folders.get(name)!;
  }
  async getFileHandle(name: string, options?: { create?: boolean }) {
    if (!this.files.has(name) && !options?.create) throw new DOMException(`${name} not found`, "NotFoundError");
    return {
      kind: "file",
      getFile: async () => new File([this.files.get(name)!], name),
      createWritable: async () => {
        let written: Blob = new Blob([]);
        return {
          write: async (blob: Blob | string) => {
            written = typeof blob === "string" ? new Blob([blob]) : blob;
          },
          close: async () => {
            this.files.set(name, written);
          },
        };
      },
    };
  }
  async removeEntry(name: string) {
    if (!this.files.delete(name) && !this.folders.delete(name)) throw new DOMException(`${name} not found`, "NotFoundError");
  }
  async *entries() {}
}
Object.defineProperty(globalThis.navigator, "storage", { value: { getDirectory: async () => new Folder() }, configurable: true });

// Two versions of a page: what the old code made of it, and what today's makes (a darker ink, as a fix of the
// stencil masks' colour would give).
function pageOf(ink: number): RgbaImage {
  const width = 80;
  const height = 100;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 20; y < 80; y += 8) for (let x = 10; x < 70; x++) data.fill(ink, (y * width + x) * 4, (y * width + x) * 4 + 3);
  return { width, height, data };
}
const oldImage = pageOf(160);
const todaysImage = pageOf(0);

// The page image worker, with today's code: it answers "open" and "page" (workerClient.ts's protocol).
class FakeWorker extends EventTarget {
  constructor() {
    super();
    queueMicrotask(() => this.answer({ listening: true }));
  }
  answer(data: unknown) {
    this.dispatchEvent(Object.assign(new Event("message"), { data }));
  }
  async postMessage({ id, type }: { id: number; type: string }) {
    if (type === "open") return this.answer({ id, response: { pageCount: 3, pdfjsVersion: "6.4.299" } });
    if (type === "page") return this.answer({ id, response: { png: new Uint8Array([1, 2, 3]), fingerprint: await fingerprintOf(todaysImage) } });
    this.answer({ id, error: `not here: ${type}`, fatal: false });
  }
  terminate() {}
}
Object.defineProperty(globalThis, "Worker", { value: FakeWorker, configurable: true });

// The Worker's fingerprints, by recipe key: what stored results were computed from.
const stored = new Map<string, Fingerprint>();
Object.defineProperty(globalThis, "fetch", {
  configurable: true,
  value: async (url: string) => {
    const key = /^\/api\/fingerprints\/([0-9a-f]+)$/.exec(url)?.[1];
    if (!key) return new Response(JSON.stringify({ error: "not here" }), { status: 404 });
    return Response.json({ fingerprint: stored.get(key) ?? null });
  },
});

const { openPdfForImages, pageDiffers, pageImage } = await import("./pageImages.ts");
const { pageRecipe } = await import("./recipes.ts");

const pdf = "ab".repeat(32);
await openPdfForImages(pdf, async () => new ArrayBuffer(8));

test("a page image made by today's code isn't checked against what the old code made of it", async () => {
  const recipe = pageRecipe(pdf, 1, 300, "6.4.299");
  // A stored result was computed from the old code's image, under the recipe as it was then (without the version).
  const { pageImage: _, ...before } = recipe;
  stored.set(await keyOf(before), await fingerprintOf(oldImage));
  await pageImage(recipe);
  assert.equal(pageDiffers(await keyOf(recipe)), false);
});

test("the check itself still warns: an image that differs from the fingerprint under its own key", async () => {
  // The same page, made where a stored result's image looked otherwise under today's recipe: marked.
  const recipe = pageRecipe(pdf, 2, 300, "6.4.299");
  stored.set(await keyOf(recipe), await fingerprintOf(oldImage));
  await pageImage(recipe);
  assert.equal(pageDiffers(await keyOf(recipe)), true);
});

test("an image made fresh by today's code matches the fingerprint stored for it", async () => {
  const recipe = pageRecipe(pdf, 3, 300, "6.4.299");
  stored.set(await keyOf(recipe), await fingerprintOf(todaysImage));
  await pageImage(recipe);
  assert.equal(pageDiffers(await keyOf(recipe)), false);
});
