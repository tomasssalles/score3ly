// Drawing a page's layout over its image (DESIGN.md §6, `layout`): the system boxes, each in its own colour, its bar
// lines in the same colour, and its number in a small label at its top left corner. The model checks its answer on
// this drawing, and the user sees the same colours in the artifact. Our own pixels (§8.2): no canvas, no fonts.

import type { Box } from "./crop.ts";
import type { Rgb, RgbaImage } from "./image.ts";

// The 7 colours boxes cycle through: Okabe–Ito without its black, which colour-blind people can tell apart.
export const LAYOUT_COLORS: Rgb[] = [
  [230, 159, 0], // orange
  [86, 180, 233], // sky blue
  [0, 158, 115], // bluish green
  [240, 228, 66], // yellow
  [0, 114, 178], // blue
  [213, 94, 0], // vermillion
  [204, 121, 167], // reddish purple
];

export const LAYOUT_COLOR_HEX = LAYOUT_COLORS.map((c) => `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`);

// A system: its box (our boxes, crop.ts) and its bar lines' x positions, in fractions of the page.
export type LayoutSystem = { box: Box; barLines: number[] };

export function drawLayout(image: RgbaImage, systems: LayoutSystem[]): RgbaImage {
  const out: RgbaImage = { width: image.width, height: image.height, data: new Uint8ClampedArray(image.data) };
  const thickness = Math.max(2, Math.round(Math.max(image.width, image.height) / 700));
  systems.forEach((system, i) => {
    const color = LAYOUT_COLORS[i % LAYOUT_COLORS.length];
    const x0 = Math.round(system.box.left * image.width);
    const x1 = Math.round(system.box.right * image.width);
    const y0 = Math.round(system.box.top * image.height);
    const y1 = Math.round(system.box.bottom * image.height);
    fill(out, x0, y0, x1 - x0, thickness, color);
    fill(out, x0, y1 - thickness, x1 - x0, thickness, color);
    fill(out, x0, y0, thickness, y1 - y0, color);
    fill(out, x1 - thickness, y0, thickness, y1 - y0, color);
    for (const x of system.barLines) {
      const bx = Math.round(x * image.width - thickness / 2);
      dashed(out, bx, y0, thickness, y1 - y0, color, thickness * 4);
    }
    label(out, String(i + 1), x0, y0, color, thickness);
  });
  return out;
}

function fill(image: RgbaImage, x0: number, y0: number, w: number, h: number, color: Rgb) {
  for (let y = Math.max(0, y0); y < Math.min(image.height, y0 + h); y++) {
    for (let x = Math.max(0, x0); x < Math.min(image.width, x0 + w); x++) {
      const i = (y * image.width + x) * 4;
      image.data[i] = color[0];
      image.data[i + 1] = color[1];
      image.data[i + 2] = color[2];
      image.data[i + 3] = 255;
    }
  }
}

// A vertical dashed line: bar lines stay visible under it.
function dashed(image: RgbaImage, x: number, y0: number, w: number, h: number, color: Rgb, dash: number) {
  for (let y = y0; y < y0 + h; y += 2 * dash) fill(image, x, y, w, Math.min(dash, y0 + h - y), color);
}

// Digits 3 wide and 5 high, row by row, a bit per pixel from the left.
const DIGITS: Record<string, number[]> = {
  "0": [0b111, 0b101, 0b101, 0b101, 0b111],
  "1": [0b010, 0b110, 0b010, 0b010, 0b111],
  "2": [0b111, 0b001, 0b111, 0b100, 0b111],
  "3": [0b111, 0b001, 0b111, 0b001, 0b111],
  "4": [0b101, 0b101, 0b111, 0b001, 0b001],
  "5": [0b111, 0b100, 0b111, 0b001, 0b111],
  "6": [0b111, 0b100, 0b111, 0b101, 0b111],
  "7": [0b111, 0b001, 0b010, 0b010, 0b010],
  "8": [0b111, 0b101, 0b111, 0b101, 0b111],
  "9": [0b111, 0b101, 0b111, 0b001, 0b111],
};

// A number in black on a filled label of the box's colour, at the box's top left corner, inside it.
function label(image: RgbaImage, text: string, x0: number, y0: number, color: Rgb, thickness: number) {
  const scale = thickness * 2;
  const pad = scale;
  const width = text.length * 4 * scale - scale + 2 * pad;
  const height = 5 * scale + 2 * pad;
  fill(image, x0, y0, width, height, color);
  [...text].forEach((ch, n) => {
    const rows = DIGITS[ch];
    if (!rows) return;
    rows.forEach((bits, r) => {
      for (let c = 0; c < 3; c++) {
        if (bits & (0b100 >> c)) fill(image, x0 + pad + (n * 4 + c) * scale, y0 + pad + r * scale, scale, scale, [0, 0, 0]);
      }
    });
  });
}
