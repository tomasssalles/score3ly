import type { RgbaImage } from "./image.ts";

// A rectangle on an image, as fractions of its width and height from 0 to 1 (DESIGN.md §6): independent of the
// image's resolution, so it stays valid when the image is made again at another one.
export type Box = { left: number; right: number; top: number; bottom: number };

export type PixelRect = { x: number; y: number; width: number; height: number };

// Why a box isn't valid, or null if it is.
export function boxProblem(box: unknown): string | null {
  if (typeof box !== "object" || box === null) return "not an object";
  const { left, right, top, bottom } = box as Record<string, unknown>;
  for (const [name, value] of Object.entries({ left, right, top, bottom })) {
    if (typeof value !== "number" || !Number.isFinite(value)) return `"${name}" isn't a number`;
    if (value < 0 || value > 1) return `"${name}" is outside 0 to 1`;
  }
  if ((left as number) >= (right as number)) return '"left" isn\'t less than "right"';
  if ((top as number) >= (bottom as number)) return '"top" isn\'t less than "bottom"';
  return null;
}

// The pixels a box covers on an image of the given size: every pixel it touches, even partly, so nothing at the
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
  if (problem) throw new Error(`Invalid box: ${problem}`);
  const rect = pixelRect(box, image.width, image.height);
  const data = new Uint8ClampedArray(rect.width * rect.height * 4);
  for (let y = 0; y < rect.height; y++) {
    const from = ((rect.y + y) * image.width + rect.x) * 4;
    data.set(image.data.subarray(from, from + rect.width * 4), y * rect.width * 4);
  }
  return { width: rect.width, height: rect.height, data };
}
