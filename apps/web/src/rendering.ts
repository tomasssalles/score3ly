// Renderings of the music for people (docs/stages/music.md, "The Transcription"; §9): MEI rendered by Verovio in a Web Worker
// (renderWorker.ts), cached on the device under the hash of the MEI, the options and Verovio's version. A rendering is
// a view: made when it is needed, never stored.

import { cachedSvg, cachedSvgs, cacheSvg, cacheSvgs } from "./imageCache.ts";
import { keyOf } from "@score3ly/core";
import type { RenderCalls } from "./renderWorker.ts";
import { oneAtATime, workerClient } from "./workerClient.ts";
import type { Box } from "@score3ly/core";

// Verovio's version, in the cache key: a new version renders anew. A test keeps it equal to the installed one.
export const VEROVIO_VERSION = "6.3.0";

// Our rendering code's version, in the cache key too: 2 since each rendering starts from Verovio's default options
// (verovioRender.ts); before, an engraving made after a system kept the system's options, and was cached so.
export const RENDERING_VERSION = 2;

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

// The page a system of the original is assumed to be on, in Verovio's units: its default page width, an A4 page at its
// default staff size. A system is rendered on its crop's share of it, with the crop's margins, and shown as wide as
// the crop, so that the two have about the same scale and their left and right edges about meet (docs/stages/music.md,
// "The Transcription").
export const REFERENCE_PAGE_WIDTH = 2100;

// The page width and margins of a system's rendering, from its box and its crop (fractions of the page's width).
export function fittedOptions(box: Box, crop: Box): { options: typeof SYSTEM_OPTIONS; pageWidth: number } {
  const units = (fraction: number) => Math.max(0, Math.round(fraction * REFERENCE_PAGE_WIDTH));
  return {
    options: { ...SYSTEM_OPTIONS, pageMarginLeft: units(box.left - crop.left), pageMarginRight: units(crop.right - box.right) },
    pageWidth: units(crop.right - crop.left),
  };
}

// The rendering worker: one that fails, or whose Verovio broke (an abort), is replaced at the next rendering.
const renderer = workerClient<RenderCalls>(() => new Worker(new URL("./renderWorker.ts", import.meta.url), { type: "module" }), {
  failure: (detail) => detail || "The rendering worker failed.",
});

// What is being rendered: one rendering per key at a time (a view shown twice, or asked again while it renders).
const renderingSystem = oneAtATime<string>();
const renderingPages = oneAtATime<string[]>();

// One system on one line (the Transcription), as wide as `pageWidth` where it is given (fittedOptions).
export async function renderMei(mei: string, options: Record<string, unknown> = SYSTEM_OPTIONS, pageWidth?: number): Promise<string> {
  const key = await keyOf({ mei, options, pageWidth: pageWidth ?? null, verovio: VEROVIO_VERSION, rendering: RENDERING_VERSION });
  return renderingSystem(key, async () => {
    const cached = await cachedSvg(key);
    if (cached) return cached;
    const [svg] = await renderer.ask("render", { mei, options, allPages: false, ...(pageWidth !== undefined ? { pageWidth } : {}) });
    await cacheSvg(key, svg);
    return svg;
  });
}

// Every page of an engraving (`engrave`).
export async function renderPages(mei: string, options: Record<string, unknown>): Promise<string[]> {
  const key = await keyOf({ mei, options, verovio: VEROVIO_VERSION, rendering: RENDERING_VERSION, pages: true });
  return renderingPages(key, async () => {
    const cached = await cachedSvgs(key);
    if (cached) return cached;
    const svgs = await renderer.ask("render", { mei, options, allPages: true });
    await cacheSvgs(key, svgs);
    return svgs;
  });
}
