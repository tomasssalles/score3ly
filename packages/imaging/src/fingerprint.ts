// Fingerprints (docs/images.md §8.3): what an image from which a stored result was computed looked like, so that the same
// recipe made again on another device can be checked against it. Three tiers: identical (the same size and raw
// pixels), close (a small grayscale thumbnail differs only a little), or different.

import { type Fingerprint, fromBase64, sha256Hex, toBase64 } from "@score3ly/core";
import { grayToRgba, luminance, type RgbaImage } from "./image.ts";
import { resizeArea } from "./scale.ts";

// Bump when the fingerprint changes: fingerprints of another version aren't compared.
export const FINGERPRINT_VERSION = 1;

const THUMBNAIL = 64; // the thumbnail's width and height (at most), whatever the image's proportions

// What a fingerprint holds (`Fingerprint`, core: the Worker stores it).
export type { Fingerprint };

// "Close" (decided in §8.3 as "below about 1 gray level on average, no tile above a few"): each thumbnail pixel is
// the average of a tile of the image.
const CLOSE_MEAN = 1;
const CLOSE_MAX = 4;

// The fingerprint of an image as it is stored and read back: an image stored as gray is fingerprinted as decodePng
// gives it back (`asStored`).
export async function fingerprintOf(image: RgbaImage): Promise<Fingerprint> {
  const thumbnailWidth = Math.min(THUMBNAIL, image.width);
  const thumbnailHeight = Math.min(THUMBNAIL, image.height);
  const thumbnail = luminance(resizeArea(image, thumbnailWidth, thumbnailHeight));
  return {
    version: FINGERPRINT_VERSION,
    width: image.width,
    height: image.height,
    pixelsSha256: await sha256Hex(image.data as Uint8ClampedArray<ArrayBuffer>),
    thumbnail: toBase64(thumbnail),
    thumbnailWidth,
    thumbnailHeight,
  };
}

// The image as decodePng reads it back after encodePng: with `gray`, each pixel its luminance, opaque.
export function asStored(image: RgbaImage, gray: boolean): RgbaImage {
  if (!gray) return image;
  return { width: image.width, height: image.height, data: grayToRgba(luminance(image), image.width, image.height) };
}

export type FingerprintMatch = "identical" | "close" | "different";

// How an image made now compares with the fingerprint stored for its recipe.
export function compareFingerprints(stored: Fingerprint, made: Fingerprint): FingerprintMatch {
  if (stored.width !== made.width || stored.height !== made.height) return "different";
  if (stored.pixelsSha256 === made.pixelsSha256) return "identical";
  if (stored.thumbnailWidth !== made.thumbnailWidth || stored.thumbnailHeight !== made.thumbnailHeight) return "different";
  const a = fromBase64(stored.thumbnail);
  const b = fromBase64(made.thumbnail);
  if (a.length !== b.length) return "different";
  let sum = 0;
  let max = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    sum += d;
    if (d > max) max = d;
  }
  return sum / a.length < CLOSE_MEAN && max <= CLOSE_MAX ? "close" : "different";
}
