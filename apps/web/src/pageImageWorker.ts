// A Web Worker that turns PDF pages into images (DESIGN.md §8.1) and encodes them as PNG (§8.6), so the page
// stays responsive while large scans are decoded. Requests carry an id; each gets one answer with the same id.

import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import {
  decodePng,
  deskew,
  drawLayout,
  encodePng,
  findSkew,
  openPdf,
  pageImage,
  shrinkToFit,
  type LayoutSystem,
  type PdfDocument,
  type SizeLimit,
  type Skew,
} from "@score3ly/imaging";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type PageImageRequest =
  | { id: number; type: "open"; sha256: string; pdf: ArrayBuffer }
  | { id: number; type: "page"; sha256: string; page: number; dpi: number }
  | { id: number; type: "skew"; png: ArrayBuffer; maxAngle: number }
  // An image made from another: straightened by `angle`, then shrunk to `limit`, then with a layout drawn on it.
  | { id: number; type: "derive"; png: ArrayBuffer; angle?: number; limit?: SizeLimit; draw?: LayoutSystem[] };

export type PageImageResponse =
  | { id: number; type: "opened"; pageCount: number; pdfjsVersion: string }
  | { id: number; type: "page"; png: Uint8Array<ArrayBuffer>; width: number; height: number; source: string; dpi: number }
  | { id: number; type: "skew"; skew: Skew }
  | { id: number; type: "derived"; png: Uint8Array<ArrayBuffer>; width: number; height: number }
  | { id: number; type: "error"; message: string };

const scope = self as unknown as {
  addEventListener(type: "message", listener: (event: MessageEvent<PageImageRequest>) => void): void;
  postMessage(message: PageImageResponse, transfer?: Transferable[]): void;
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

// What openPdf needs in a worker: the folders pdf.js loads data from (apps/web/pdfjsAssets.ts), as absolute URLs
// fetched by pdf.js's own worker, and no DOM. Glyphs are drawn as paths rather than with the browser's fonts, as in
// Node: the same everywhere (DESIGN.md §8.1).
const options = {
  ...Object.fromEntries(
    Object.entries({ wasmUrl: "wasm", cMapUrl: "cmaps", standardFontDataUrl: "standard_fonts", iccUrl: "iccs" }).map(
      ([option, name]) => [option, new URL(`/pdfjs/${name}/`, self.location.origin).href],
    ),
  ),
  useWorkerFetch: true,
  disableFontFace: true,
  CanvasFactory: OffscreenCanvasFactory,
  FilterFactory: NoFilterFactory,
};

const docs = new Map<string, Promise<PdfDocument>>();

async function handle(request: PageImageRequest): Promise<void> {
  if (request.type === "open") {
    if (!docs.has(request.sha256)) docs.set(request.sha256, openPdf(new Uint8Array(request.pdf), options));
    const doc = await docs.get(request.sha256)!;
    scope.postMessage({ id: request.id, type: "opened", pageCount: doc.numPages, pdfjsVersion: pdfjs.version ?? "" });
    return;
  }
  if (request.type === "skew") {
    const image = await decodePng(new Uint8Array(request.png));
    scope.postMessage({ id: request.id, type: "skew", skew: findSkew(image, { maxAngle: request.maxAngle }) });
    return;
  }
  if (request.type === "derive") {
    let image = await decodePng(new Uint8Array(request.png));
    if (request.angle !== undefined) image = deskew(image, request.angle);
    if (request.limit) image = shrinkToFit(image, request.limit);
    if (request.draw) image = drawLayout(image, request.draw);
    const png = await encodePng(image);
    scope.postMessage({ id: request.id, type: "derived", png, width: image.width, height: image.height }, [png.buffer]);
    return;
  }
  const doc = await docs.get(request.sha256);
  if (!doc) throw new Error("The PDF isn't open.");
  const page = await pageImage(doc, request.page, {
    dpi: request.dpi,
    createCanvas: (width, height) => new OffscreenCanvas(width, height),
  });
  const png = await encodePng(page.image);
  scope.postMessage(
    {
      id: request.id,
      type: "page",
      png,
      width: page.image.width,
      height: page.image.height,
      source: page.source,
      dpi: page.dpi,
    },
    [png.buffer],
  );
}

scope.addEventListener("message", (event) => {
  handle(event.data).catch((err) => {
    if (event.data.type === "open") docs.delete(event.data.sha256);
    scope.postMessage({ id: event.data.id, type: "error", message: err instanceof Error ? err.message : String(err) });
  });
});
