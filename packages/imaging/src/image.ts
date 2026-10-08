// Images as plain pixel arrays, so every operation is our own code and gives the same pixels on every device
// (DESIGN.md §8.2): no canvas transforms, no browser decoders.

// RGBA, 8 bits per channel, rows top to bottom. The same layout as the canvas' ImageData, without needing a DOM.
export type RgbaImage = {
  width: number;
  height: number;
  data: Uint8ClampedArray; // width * height * 4 bytes
};

export type Rgb = [number, number, number];

export function createImage(width: number, height: number, fill: Rgb = [255, 255, 255]): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill[0];
    data[i + 1] = fill[1];
    data[i + 2] = fill[2];
    data[i + 3] = 255;
  }
  return { width, height, data };
}

// Luminance (BT.601) per pixel, 0 (black) to 255 (white), in integer arithmetic so it is exact everywhere.
export function luminance(image: RgbaImage): Uint8Array {
  const { data } = image;
  const out = new Uint8Array(image.width * image.height);
  for (let p = 0, i = 0; p < out.length; p++, i += 4) {
    out[p] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114 + 500) / 1000;
  }
  return out;
}

// Math.sin, Math.cos and Math.tan aren't guaranteed to give identical results in every JS engine. Rounded to 12
// decimals, they do (but for values on a rounding boundary, which practically never happen).
function stable(x: number): number {
  return Math.round(x * 1e12) / 1e12;
}

export function sinDeg(degrees: number): number {
  return stable(Math.sin((degrees * Math.PI) / 180));
}

export function cosDeg(degrees: number): number {
  return stable(Math.cos((degrees * Math.PI) / 180));
}

export function tanDeg(degrees: number): number {
  return stable(Math.tan((degrees * Math.PI) / 180));
}
