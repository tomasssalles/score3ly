// Page images from a PDF (DESIGN.md §8.1). A scanned page is its embedded image, taken as it is (not drawn
// again at some resolution): the scan's own pixels, decoded by pdf.js's JavaScript decoders, so identical on every
// device. Any other page (vector music, or a scan split into several images) is drawn by pdf.js at a fixed
// resolution. Colour is kept.

import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import type { Rgb, RgbaImage } from "./image.ts";

export type PdfDocument = pdfjs.PDFDocumentProxy;

// Opens a PDF for page images. `assets` are the folders (or URLs) pdf.js needs to draw vector pages: fonts,
// character maps, ... (apps/web/pdfjsAssets.ts provides them in the browser).
export async function openPdf(
  data: Uint8Array,
  assets: { standardFontDataUrl?: string; cMapUrl?: string; wasmUrl?: string; iccUrl?: string } = {},
): Promise<PdfDocument> {
  return pdfjs.getDocument({
    data,
    ...assets,
    // pdf.js's own decoders, not the browser's: JPEG decoders differ between browsers (DESIGN.md §3).
    isImageDecoderSupported: false,
    // Images as pixel arrays, not as bitmaps the browser holds (which can't be read back exactly).
    isOffscreenCanvasSupported: false,
    verbosity: 0,
  }).promise;
}

// A canvas to draw vector pages on: an OffscreenCanvas in the browser, @napi-rs/canvas in Node.
export type CanvasLike = {
  width: number;
  height: number;
  getContext(type: "2d"): unknown;
};
export type CreateCanvas = (width: number, height: number) => CanvasLike;

export type PageImage = {
  image: RgbaImage;
  source: "embedded" | "rendered";
  dpi: number; // the scan's resolution, or the one the page was drawn at (rounded)
};

export const DEFAULT_DPI = 300;

// A page's image (pages count from 1). `createCanvas` is only needed for pages that aren't plain scans.
export async function pageImage(
  doc: PdfDocument,
  pageNumber: number,
  options: { dpi?: number; createCanvas?: CreateCanvas } = {},
): Promise<PageImage> {
  const page = await doc.getPage(pageNumber);
  const embedded = await embeddedScan(page);
  if (embedded) return embedded;
  if (!options.createCanvas)
    throw new Error(`Page ${pageNumber} isn't a plain scan and no canvas was given to draw it.`);
  return renderPage(page, options.dpi ?? DEFAULT_DPI, options.createCanvas);
}

// Draws the page at `dpi`. The pixel size is computed explicitly, round(points × dpi / 72), so it is the same
// everywhere (DESIGN.md §8.1).
export async function renderPage(
  page: pdfjs.PDFPageProxy,
  dpi: number,
  createCanvas: CreateCanvas,
): Promise<PageImage> {
  const base = page.getViewport({ scale: 1 });
  const width = Math.round((base.width * dpi) / 72);
  const height = Math.round((base.height * dpi) / 72);
  const viewport = page.getViewport({ scale: dpi / 72 });
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d") as CanvasRenderingContext2D;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  await page.render({ canvas: canvas as unknown as HTMLCanvasElement, canvasContext: context, viewport }).promise;
  const pixels = context.getImageData(0, 0, width, height);
  return { image: { width, height, data: new Uint8ClampedArray(pixels.data) }, source: "rendered", dpi };
}

// A page's matrix: x' = a·x + c·y + e, y' = b·x + d·y + f (pdf.js's order).
type Matrix = [number, number, number, number, number, number];

function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

const COVERAGE = 0.85; // a scan covers at least this much of the page

// An image on the page. 1-bit scans are often stored as a stencil mask: ink where a bit is 0, painted in the
// fill color, and the page showing through elsewhere.
type Placed = { objId: string; matrix: Matrix; mask: Rgb | null };

// The page's scan, if the page is one: a single image (or stencil mask) covering (nearly) the whole page. Other
// content, such as an invisible text layer from OCR, is ignored. Null for any other page.
async function embeddedScan(page: pdfjs.PDFPageProxy): Promise<PageImage | null> {
  const viewport = page.getViewport({ scale: 1 });
  const ops = await page.getOperatorList();
  const images: Placed[] = [];
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  let fill: Rgb = [0, 0, 0];
  const stack: { ctm: Matrix; fill: Rgb }[] = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];
    switch (fn) {
      case pdfjs.OPS.save:
        stack.push({ ctm, fill });
        break;
      case pdfjs.OPS.restore:
        ({ ctm, fill } = stack.pop() ?? { ctm, fill });
        break;
      case pdfjs.OPS.setFillRGBColor:
        fill = parseColor(args[0]) ?? fill;
        break;
      case pdfjs.OPS.transform:
        ctm = multiply(ctm, args as Matrix);
        break;
      case pdfjs.OPS.paintFormXObjectBegin:
        stack.push({ ctm, fill });
        if (Array.isArray(args[0]) && args[0].length === 6) ctm = multiply(ctm, args[0] as Matrix);
        break;
      case pdfjs.OPS.paintFormXObjectEnd:
        ({ ctm, fill } = stack.pop() ?? { ctm, fill });
        break;
      case pdfjs.OPS.paintImageXObject:
        images.push({ objId: args[0] as string, matrix: ctm, mask: null });
        break;
      case pdfjs.OPS.paintImageMaskXObject: {
        const mask = args[0] as { data?: unknown; count?: number };
        if (typeof mask?.data !== "string" || (mask.count ?? 1) !== 1) return null;
        images.push({ objId: mask.data, matrix: ctm, mask: fill });
        break;
      }
      case pdfjs.OPS.paintInlineImageXObject:
      case pdfjs.OPS.paintImageXObjectRepeat:
      case pdfjs.OPS.paintImageMaskXObjectGroup:
      case pdfjs.OPS.paintImageMaskXObjectRepeat:
      case pdfjs.OPS.paintSolidColorImageMask:
        return null; // not a plain scan: draw the page
    }
  }
  if (images.length !== 1) return null;
  const [placed] = images;
  const device = multiply(viewport.transform as Matrix, placed.matrix);
  const box = deviceBox(device);
  const visible =
    Math.max(0, Math.min(box.x1, viewport.width) - Math.max(box.x0, 0)) *
    Math.max(0, Math.min(box.y1, viewport.height) - Math.max(box.y0, 0));
  if (visible < COVERAGE * viewport.width * viewport.height) return null;
  const data = await objectData(page, placed.objId);
  if (!data) return null;
  const pixels = placed.mask ? maskToRgba(data, placed.mask) : toRgba(data);
  if (!pixels) return null;
  return orient(pixels, device, box, viewport.width, viewport.height);
}

type Box = { x0: number; y0: number; x1: number; y1: number };

// Where the image's unit square lands on the page (viewport coordinates, y down).
function deviceBox(m: Matrix): Box {
  const xs = [m[4], m[0] + m[4], m[2] + m[4], m[0] + m[2] + m[4]];
  const ys = [m[5], m[1] + m[5], m[3] + m[5], m[1] + m[3] + m[5]];
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

type ImageObject = { width: number; height: number; kind?: number; data: Uint8Array | Uint8ClampedArray };

function objectData(page: pdfjs.PDFPageProxy, objId: string): Promise<ImageObject | null> {
  const objs = objId.startsWith("g_") ? page.commonObjs : page.objs;
  return new Promise((resolve) => {
    objs.get(objId, (data: unknown) => {
      const image = data as Partial<ImageObject> | null;
      resolve(image?.data && image.width && image.height ? (image as ImageObject) : null);
    });
  });
}

// pdf.js's decoded image (1-bit, RGB or RGBA) as opaque RGBA. In 1-bit images, a set bit is white.
function toRgba({ width, height, kind, data }: ImageObject): RgbaImage | null {
  const out = new Uint8ClampedArray(width * height * 4);
  if (kind === pdfjs.ImageKind.GRAYSCALE_1BPP) {
    const rowBytes = (width + 7) >> 3;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const bit = (data[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
        const v = bit ? 255 : 0;
        const o = (y * width + x) * 4;
        out[o] = out[o + 1] = out[o + 2] = v;
        out[o + 3] = 255;
      }
    }
  } else if (kind === pdfjs.ImageKind.RGB_24BPP) {
    for (let p = 0, i = 0; p < width * height; p++, i += 3) {
      out[p * 4] = data[i];
      out[p * 4 + 1] = data[i + 1];
      out[p * 4 + 2] = data[i + 2];
      out[p * 4 + 3] = 255;
    }
  } else if (kind === pdfjs.ImageKind.RGBA_32BPP) {
    // An image with transparency (a soft mask), e.g. black ink whose mask says where the ink is: laid on white.
    for (let i = 0; i < out.length; i += 4) {
      const alpha = data[i + 3];
      out[i] = (data[i] * alpha + 255 * (255 - alpha) + 127) / 255;
      out[i + 1] = (data[i + 1] * alpha + 255 * (255 - alpha) + 127) / 255;
      out[i + 2] = (data[i + 2] * alpha + 255 * (255 - alpha) + 127) / 255;
      out[i + 3] = 255;
    }
  } else {
    return null;
  }
  return { width, height, data: out };
}

// A stencil mask on white paper: ink (`color`) where a bit is 0. pdf.js has already applied the mask's Decode.
function maskToRgba({ width, height, data }: ImageObject, color: Rgb): RgbaImage {
  const out = new Uint8ClampedArray(width * height * 4);
  const rowBytes = (width + 7) >> 3;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const bit = (data[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
      const o = (y * width + x) * 4;
      out[o] = bit ? 255 : color[0];
      out[o + 1] = bit ? 255 : color[1];
      out[o + 2] = bit ? 255 : color[2];
      out[o + 3] = 255;
    }
  }
  return { width, height, data: out };
}

function parseColor(value: unknown): Rgb | null {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) return null;
  return [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16)) as Rgb;
}

// Turns the image the way it appears on the page (a scan may be stored rotated or mirrored) and keeps the part
// that lies on the page. Only right angles: anything else is left to drawing the page.
//
// Some scans are stored with non-square pixels (e.g. 300 dpi across, 150 down) and stretched back into shape by
// the PDF. The page as the PDF shows it is the truth, so such an image is resampled to square pixels at the
// higher of its two resolutions (nearest neighbour: exact copies for a factor of 2, and 1-bit scans stay sharp).
function orient(image: RgbaImage, m: Matrix, box: Box, pageWidth: number, pageHeight: number): PageImage | null {
  const scale = Math.max(Math.abs(m[0]), Math.abs(m[1]), Math.abs(m[2]), Math.abs(m[3]));
  const tiny = scale * 1e-6;
  const upright = Math.abs(m[1]) < tiny && Math.abs(m[2]) < tiny;
  const turned = Math.abs(m[0]) < tiny && Math.abs(m[3]) < tiny;
  if (!upright && !turned) return null;
  // Pixels along the page's x and y.
  const alongX = upright ? image.width : image.height;
  const alongY = upright ? image.height : image.width;
  const dpiX = (alongX * 72) / (box.x1 - box.x0);
  const dpiY = (alongY * 72) / (box.y1 - box.y0);
  const dpi = Math.max(dpiX, dpiY);
  const square = Math.abs(dpiX - dpiY) <= 0.01 * dpi;
  const outWidth = square ? alongX : Math.round(((box.x1 - box.x0) * dpi) / 72);
  const outHeight = square ? alongY : Math.round(((box.y1 - box.y0) * dpi) / 72);
  const pixelWidth = (box.x1 - box.x0) / outWidth;
  const pixelHeight = (box.y1 - box.y0) / outHeight;
  // Only the pixels whose centers are on the page.
  const firstX = Math.max(0, Math.ceil(-box.x0 / pixelWidth - 0.5));
  const lastX = Math.min(outWidth - 1, Math.floor((pageWidth - box.x0) / pixelWidth - 0.5));
  const firstY = Math.max(0, Math.ceil(-box.y0 / pixelHeight - 0.5));
  const lastY = Math.min(outHeight - 1, Math.floor((pageHeight - box.y0) / pixelHeight - 0.5));
  const width = lastX - firstX + 1;
  const height = lastY - firstY + 1;
  if (width <= 0 || height <= 0) return null;

  // Inverse of the matrix: page point -> the image's unit square (u to the right, v up).
  const det = m[0] * m[3] - m[1] * m[2];
  const out = new Uint8ClampedArray(width * height * 4);
  const src = image.data;
  for (let Y = 0; Y < height; Y++) {
    const py = box.y0 + (firstY + Y + 0.5) * pixelHeight - m[5];
    for (let X = 0; X < width; X++) {
      const px = box.x0 + (firstX + X + 0.5) * pixelWidth - m[4];
      const u = (m[3] * px - m[2] * py) / det;
      const v = (m[0] * py - m[1] * px) / det;
      // The image's rows run from its top (v = 1) down.
      const i = Math.min(image.width - 1, Math.max(0, Math.floor(u * image.width)));
      const j = Math.min(image.height - 1, Math.max(0, Math.floor((1 - v) * image.height)));
      const s = (j * image.width + i) * 4;
      const o = (Y * width + X) * 4;
      out[o] = src[s];
      out[o + 1] = src[s + 1];
      out[o + 2] = src[s + 2];
      out[o + 3] = src[s + 3];
    }
  }
  return { image: { width, height, data: out }, source: "embedded", dpi: Math.round(dpi) };
}
