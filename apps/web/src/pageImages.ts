// Page images for the pipeline and the artifact view (DESIGN.md §6, `rasterize`): taken from the device's cache, or
// computed from their recipe by a Web Worker (pageImageWorker.ts) and cached. A page is computed only when
// something needs it (§5.3).

import { cachedImage, cacheImage } from "./imageCache";
import { keyOf } from "./keys";
import { pdfUrl } from "./pdf";
import type { PageImageRequest, PageImageResponse } from "./pageImageWorker";
import type { PageRecipe } from "./rasterize";

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
  const cached = await cachedImage(key);
  if (cached) return { png: cached, computed: false };
  await openPdfForImages(recipe.pdf);
  const answer = await ask({ type: "page", sha256: recipe.pdf, page: recipe.page, dpi: recipe.dpi });
  if (answer.type !== "page") throw new Error("Unexpected answer from the page image worker.");
  await cacheImage(key, answer.png);
  return { png: new Blob([answer.png], { type: "image/png" }), computed: true };
}
