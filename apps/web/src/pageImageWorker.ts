// A Web Worker that turns PDF pages into images (docs/images.md §8.1) and encodes them as PNG (§8.6), so the page
// stays responsive while large scans are decoded. Its requests and answers: workerClient.ts.

import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import {
  asStored,
  crop,
  decodePng,
  deskew,
  drawLayout,
  encodePng,
  findSkew,
  fingerprintOf,
  openPdf,
  pageImage,
  shrinkToFit,
  type DrawOptions,
  type Fingerprint,
  type PdfDocument,
  type SizeLimit,
  type Skew,
} from "@score3ly/imaging";
import type { Box, LayoutSystem } from "@score3ly/core";
import { PDFJS_DATA } from "@score3ly/core/pdf";
import { serve } from "./workerClient.ts";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// An image made from another: straightened by `angle`, then cut to `crop` (a box, fractions of the straightened image),
// then shrunk to `limit`, then with a layout drawn on it (labelled as `drawOptions` say), and stored as gray if `gray`.
export type DeriveOptions = { angle?: number; crop?: Box; limit?: SizeLimit; draw?: LayoutSystem[]; drawOptions?: DrawOptions; gray?: boolean };

// An image as the worker makes it: its PNG and its fingerprint (docs/images.md §8.3).
export type MadeImage = { png: Uint8Array<ArrayBuffer>; fingerprint: Fingerprint };

export type PageImageCalls = {
  open: { request: { sha256: string; pdf: ArrayBuffer }; response: { pageCount: number; pdfjsVersion: string } };
  // A PDF no longer needed: its memory freed.
  close: { request: { sha256: string }; response: null };
  page: { request: { sha256: string; page: number; dpi: number }; response: MadeImage };
  skew: { request: { png: ArrayBuffer; maxAngle: number }; response: Skew };
  // The fingerprint of an image, as decoded from its PNG.
  fingerprint: { request: ArrayBuffer; response: Fingerprint };
  derive: { request: { png: ArrayBuffer } & DeriveOptions; response: MadeImage };
};

// pdf.js takes its canvases from the DOM unless told otherwise. A Web Worker has none: OffscreenCanvas instead.
class OffscreenCanvasFactory {
  create(width: number, height: number) {
    const canvas = new OffscreenCanvas(width, height);
    return { canvas, context: canvas.getContext("2d", { willReadFrequently: true }) };
  }
  reset(pair: { canvas: OffscreenCanvas }, width: number, height: number) {
    pair.canvas.width = width;
    pair.canvas.height = height;
  }
  destroy(pair: { canvas: OffscreenCanvas | null; context: unknown }) {
    if (pair.canvas) pair.canvas.width = pair.canvas.height = 0;
    pair.canvas = null;
    pair.context = null;
  }
}

// pdf.js's SVG filters (transfer functions, high contrast) need the DOM. Without them a page that uses a transfer
// function is drawn without it, as in Node.
class NoFilterFactory {
  addFilter() {
    return "none";
  }
  addHCMFilter() {
    return "none";
  }
  addAlphaFilter() {
    return "none";
  }
  addLuminosityFilter() {
    return "none";
  }
  addHighlightHCMFilter() {
    return "none";
  }
  destroy() {}
}

// What openPdf needs in a worker: the folders pdf.js loads data from (PDFJS_DATA, packages/core), as absolute URLs
// fetched by pdf.js's own worker, and no DOM. Glyphs are drawn as paths rather than with the browser's fonts, as in
// Node: the same everywhere (docs/images.md §8.1).
const options = {
  ...Object.fromEntries(Object.entries(PDFJS_DATA).map(([option, url]) => [option, new URL(url, self.location.origin).href])),
  useWorkerFetch: true,
  disableFontFace: true,
  CanvasFactory: OffscreenCanvasFactory,
  FilterFactory: NoFilterFactory,
};

const docs = new Map<string, Promise<PdfDocument>>();

serve<PageImageCalls>(
  {
    open: async ({ sha256, pdf }) => {
      if (!docs.has(sha256)) docs.set(sha256, openPdf(new Uint8Array(pdf), options));
      try {
        const doc = await docs.get(sha256)!;
        return { pageCount: doc.numPages, pdfjsVersion: pdfjs.version ?? "" };
      } catch (err) {
        docs.delete(sha256);
        throw err;
      }
    },
    close: async ({ sha256 }) => {
      const doc = docs.get(sha256);
      docs.delete(sha256);
      await (await doc?.catch(() => null))?.loadingTask.destroy();
      return null;
    },
    page: async ({ sha256, page, dpi }) => {
      const doc = await docs.get(sha256);
      if (!doc) throw new Error("The PDF isn't open.");
      const { image } = await pageImage(doc, page, { dpi, createCanvas: (width, height) => new OffscreenCanvas(width, height) });
      return { png: await encodePng(image), fingerprint: await fingerprintOf(image) };
    },
    skew: async ({ png, maxAngle }) => findSkew(await decodePng(new Uint8Array(png)), { maxAngle }),
    fingerprint: async (png) => fingerprintOf(await decodePng(new Uint8Array(png))),
    derive: async ({ png, angle, crop: box, limit, draw, drawOptions, gray }) => {
      let image = await decodePng(new Uint8Array(png));
      if (angle !== undefined) image = deskew(image, angle);
      if (box) image = crop(image, box);
      if (limit) image = shrinkToFit(image, limit);
      if (draw) image = drawLayout(image, draw, drawOptions);
      return { png: await encodePng(image, { gray }), fingerprint: await fingerprintOf(asStored(image, gray ?? false)) };
    },
  },
  // The PNGs are moved to the page, not copied.
  (response) => (response && typeof response === "object" && "png" in response ? [response.png.buffer] : []),
);
