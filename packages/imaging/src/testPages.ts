// Made-up pages of music for the tests: staves, notes, and the troubles real scans have.

import { createImage, type RgbaImage, type Rgb } from "./image.ts";

// A small deterministic random generator.
export function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function fillRect(image: RgbaImage, x0: number, y0: number, w: number, h: number, color: Rgb) {
  for (let y = Math.max(0, y0); y < Math.min(image.height, y0 + h); y++) {
    for (let x = Math.max(0, x0); x < Math.min(image.width, x0 + w); x++) {
      const i = (y * image.width + x) * 4;
      image.data[i] = color[0];
      image.data[i + 1] = color[1];
      image.data[i + 2] = color[2];
    }
  }
}

// A straight line `thickness` pixels thick from (x0, y0) to (x1, y1).
export function drawLine(
  image: RgbaImage,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  thickness: number,
  color: Rgb,
) {
  const steps = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
  for (let s = 0; s <= steps; s++) {
    const x = Math.round(x0 + ((x1 - x0) * s) / steps);
    const y = Math.round(y0 + ((y1 - y0) * s) / steps);
    fillRect(image, x, y - (thickness >> 1), 1, thickness, color);
  }
}

export type PageOptions = { paper?: Rgb; ink?: Rgb; noise?: number; seed?: number };

// A page with eight staves of five lines, barlines, stems and noteheads, and a little text.
export function musicPage(width = 1200, height = 1600, options: PageOptions = {}): RgbaImage {
  const paper = options.paper ?? [250, 247, 238];
  const ink = options.ink ?? [20, 20, 20];
  const rand = random(options.seed ?? 1);
  const image = createImage(width, height, paper);
  const left = Math.round(width * 0.1);
  const right = Math.round(width * 0.9);
  const spacing = Math.round(height / 115);
  fillRect(image, Math.round(width * 0.35), Math.round(height * 0.04), Math.round(width * 0.3), spacing * 2, ink);
  for (let staff = 0; staff < 8; staff++) {
    const top = Math.round(height * 0.1 + staff * height * 0.105);
    for (let line = 0; line < 5; line++) fillRect(image, left, top + line * spacing, right - left, 2, ink);
    for (let bar = 0; bar <= 4; bar++) {
      fillRect(image, left + Math.round(((right - left) * bar) / 4), top, 2, 4 * spacing + 2, ink);
    }
    for (let x = left + 40; x < right - 20; x += 25 + Math.round(rand() * 20)) {
      const y = top + Math.round(rand() * 8 - 2) * (spacing / 2);
      fillRect(image, x, Math.round(y - spacing / 2), Math.round(spacing * 1.3), spacing, ink);
      fillRect(image, x + Math.round(spacing * 1.2), Math.round(y - 3.5 * spacing), 2, Math.round(3.5 * spacing), ink);
    }
  }
  if (options.noise) {
    for (let i = 0; i < image.data.length; i += 4) {
      const n = Math.round((rand() * 2 - 1) * options.noise);
      image.data[i] += n;
      image.data[i + 1] += n;
      image.data[i + 2] += n;
    }
  }
  return image;
}
