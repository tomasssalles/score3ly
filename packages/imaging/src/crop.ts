import { boxProblem, type Box } from "@score3ly/core";
import type { RgbaImage } from "./image.ts";

// Raise whenever cropping changes what pixels a box gives (docs/images.md §8.6: the crop code's version is in the key).
export const CROP_VERSION = 1;

export type PixelRect = { x: number; y: number; width: number; height: number };

// The pixels a box (core's: fractions of the image) covers on an image of the given size: every pixel it touches, even partly, so nothing at the
// edge of a system or measure is cut off.
export function pixelRect(box: Box, width: number, height: number): PixelRect {
  const x0 = Math.max(0, Math.floor(box.left * width));
  const x1 = Math.min(width, Math.ceil(box.right * width));
  const y0 = Math.max(0, Math.floor(box.top * height));
  const y1 = Math.min(height, Math.ceil(box.bottom * height));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

export function crop(image: RgbaImage, box: Box): RgbaImage {
  const problem = boxProblem(box);
  if (problem) throw new Error(`Invalid box: ${problem.text}`);
  const rect = pixelRect(box, image.width, image.height);
  const data = new Uint8ClampedArray(rect.width * rect.height * 4);
  for (let y = 0; y < rect.height; y++) {
    const from = ((rect.y + y) * image.width + rect.x) * 4;
    data.set(image.data.subarray(from, from + rect.width * 4), y * rect.width * 4);
  }
  return { width: rect.width, height: rect.height, data };
}
