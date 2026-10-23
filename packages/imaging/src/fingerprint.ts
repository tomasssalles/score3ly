// Fingerprints (DESIGN.md §8.3): what an image from which a stored result was computed looked like, so that the same
// recipe made again on another device can be checked against it. Three tiers: identical (the same size and raw
// pixels), close (a small grayscale thumbnail differs only a little), or different.

import { luminance, type RgbaImage } from "./image.ts";
import { resizeArea } from "./scale.ts";

// Bump when the fingerprint changes: fingerprints of another version aren't compared.
export const FINGERPRINT_VERSION = 1;

const THUMBNAIL = 64; // the thumbnail's width and height (at most), whatever the image's proportions

export type Fingerprint = {
  version: number;
  width: number;
  height: number;
  pixelsSha256: string; // of the raw RGBA pixels, as decoded (not of the PNG file: encoders differ)
  thumbnail: string; // base64 of the grayscale thumbnail, row by row
  thumbnailWidth: number;
  thumbnailHeight: number;
};

// "Close" (decided in §8.3 as "below about 1 gray level on average, no tile above a few"): each thumbnail pixel is
// the average of a tile of the image.
const CLOSE_MEAN = 1;
const CLOSE_MAX = 4;

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sha256Hex(bytes: Uint8ClampedArray): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as Uint8ClampedArray<ArrayBuffer>));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}

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
    pixelsSha256: await sha256Hex(image.data),
    thumbnail: base64(thumbnail),
    thumbnailWidth,
    thumbnailHeight,
  };
}

// The image as decodePng reads it back after encodePng: with `gray`, each pixel its luminance, opaque.
export function asStored(image: RgbaImage, gray: boolean): RgbaImage {
  if (!gray) return image;
  const lum = luminance(image);
  const data = new Uint8ClampedArray(image.width * image.height * 4);
  for (let p = 0; p < lum.length; p++) data.set([lum[p], lum[p], lum[p], 255], p * 4);
  return { width: image.width, height: image.height, data };
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
