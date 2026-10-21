// Renderings of the music for people (DESIGN.md §6, "The Transcription"; §9): MEI rendered by Verovio in a Web Worker
// (renderWorker.ts), cached on the device under the hash of the MEI, the options and Verovio's version. A rendering is
// a view: made when it is needed, never stored.

import { cachedSvg, cachedSvgs, cacheSvg, cacheSvgs } from "./imageCache.ts";
import { keyOf } from "./keys.ts";
import type { RenderRequest, RenderResponse } from "./renderWorker.ts";

// Verovio's version, in the cache key: a new version renders anew. A test keeps it equal to the installed one.
export const VEROVIO_VERSION = "6.3.0";

// One system on one line, whatever its width (`breaks: "none"`), without a title or a footer, sized by its view box.
export const SYSTEM_OPTIONS = {
  breaks: "none",
  header: "none",
  footer: "none",
  adjustPageHeight: true,
  adjustPageWidth: true,
  svgViewBox: true,
  scale: 40,
  pageMarginTop: 20,
  pageMarginBottom: 20,
  pageMarginLeft: 20,
  pageMarginRight: 20,
};

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (svgs: string[]) => void; reject: (error: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./renderWorker.ts", import.meta.url), { type: "module" });
  worker.addEventListener("message", (event: MessageEvent<RenderResponse>) => {
    const waiting = pending.get(event.data.id);
    if (!waiting) return;
    pending.delete(event.data.id);
    if ("error" in event.data) waiting.reject(new Error(event.data.error));
    else waiting.resolve(event.data.svgs);
  });
  worker.addEventListener("error", (event) => {
    for (const waiting of pending.values()) waiting.reject(new Error(event.message || "The rendering worker failed."));
    pending.clear();
    worker = null;
  });
  return worker;
}

function ask(mei: string, options: Record<string, unknown>, allPages: boolean): Promise<string[]> {
  const id = nextId++;
  return new Promise<string[]>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, mei, options, allPages } satisfies RenderRequest);
  });
}

// One system on one line (the Transcription).
export async function renderMei(mei: string, options: Record<string, unknown> = SYSTEM_OPTIONS): Promise<string> {
  const key = await keyOf({ mei, options, verovio: VEROVIO_VERSION });
  const cached = await cachedSvg(key);
  if (cached) return cached;
  const [svg] = await ask(mei, options, false);
  await cacheSvg(key, svg);
  return svg;
}

// Every page of an engraving (`engrave`).
export async function renderPages(mei: string, options: Record<string, unknown>): Promise<string[]> {
  const key = await keyOf({ mei, options, verovio: VEROVIO_VERSION, pages: true });
  const cached = await cachedSvgs(key);
  if (cached) return cached;
  const svgs = await ask(mei, options, true);
  await cacheSvgs(key, svgs);
  return svgs;
}
