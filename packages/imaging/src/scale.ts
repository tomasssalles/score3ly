// Shrinking an image to fit a model's limits (docs/tasks.md, "Images for the LLMs"): our own code, not the API's
// resizing, so the image a model sees is known, the same on every device, and part of the request's key. Area
// averaging (each output pixel the mean of the input pixels it covers, partly covered ones by their share): it keeps
// thin lines as gray rather than dropping them. Only + and × of floating point numbers, so the result is identical
// in every JavaScript engine (§8.2).

import type { RgbaImage } from "./image.ts";

// The version of the shrinking code: part of the recipe of the images sent to models. Raise it whenever the result
// changes.
export const SCALE_VERSION = 1;

export type SizeLimit = { maxLongEdge: number; maxPixels: number };

// Claude's high-resolution vision (Opus 4.7 and later): at most 2576 pixels on the long edge and about 3.75
// megapixels (4784 patches of 28 × 28); larger images are shrunk by the API, out of our control.
export const CLAUDE_IMAGE_LIMIT: SizeLimit = { maxLongEdge: 2576, maxPixels: 3_750_000 };

// The size an image gets to fit the limit, keeping its proportions; its own size if it fits already.
export function fittedSize(width: number, height: number, limit: SizeLimit): { width: number; height: number } {
  const factor = Math.max(1, Math.max(width, height) / limit.maxLongEdge, Math.sqrt((width * height) / limit.maxPixels));
  if (factor === 1) return { width, height };
  return { width: Math.max(1, Math.floor(width / factor)), height: Math.max(1, Math.floor(height / factor)) };
}

// The image shrunk to fit the limit (unchanged if it fits).
export function shrinkToFit(image: RgbaImage, limit: SizeLimit): RgbaImage {
  const size = fittedSize(image.width, image.height, limit);
  if (size.width === image.width && size.height === image.height) return image;
  return resizeArea(image, size.width, size.height);
}

// For each output position along one axis: the input positions it covers and their weights (summing to 1).
function weights(from: number, to: number): { first: number; w: Float64Array }[] {
  const scale = from / to;
  const result: { first: number; w: Float64Array }[] = [];
  for (let o = 0; o < to; o++) {
    const start = o * scale;
    const end = (o + 1) * scale;
    const first = Math.floor(start);
    const last = Math.min(from - 1, Math.ceil(end) - 1);
    const w = new Float64Array(last - first + 1);
    for (let i = first; i <= last; i++) w[i - first] = (Math.min(end, i + 1) - Math.max(start, i)) / scale;
    result.push({ first, w });
  }
  return result;
}

export function resizeArea(image: RgbaImage, width: number, height: number): RgbaImage {
  const { data } = image;
  const cols = weights(image.width, width);
  const rows = weights(image.height, height);
  // Horizontally first, into floating point rows; then vertically.
  const wide = new Float64Array(width * image.height * 4);
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < width; x++) {
      const { first, w } = cols[x];
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let k = 0; k < w.length; k++) {
        const i = (y * image.width + first + k) * 4;
        r += data[i] * w[k];
        g += data[i + 1] * w[k];
        b += data[i + 2] * w[k];
        a += data[i + 3] * w[k];
      }
      const o = (y * width + x) * 4;
      wide[o] = r;
      wide[o + 1] = g;
      wide[o + 2] = b;
      wide[o + 3] = a;
    }
  }
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const { first, w } = rows[y];
    for (let x = 0; x < width; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let k = 0; k < w.length; k++) {
        const i = ((first + k) * width + x) * 4;
        r += wide[i] * w[k];
        g += wide[i + 1] * w[k];
        b += wide[i + 2] * w[k];
        a += wide[i + 3] * w[k];
      }
      const o = (y * width + x) * 4;
      out[o] = Math.round(r);
      out[o + 1] = Math.round(g);
      out[o + 2] = Math.round(b);
      out[o + 3] = Math.round(a);
    }
  }
  return { width, height, data: out };
}
