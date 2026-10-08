import { cosDeg, type RgbaImage, type Rgb, sinDeg } from "./image.ts";

// Rotates the image's content by `degrees` about its center, clockwise as seen on screen (negative: counter-
// clockwise). The output has the same size as the input: corners that rotate out are cut off, and areas that
// rotate in are filled with `background`. Keeping the size keeps normalized coordinates simple (DESIGN.md §8.2);
// deskewing angles are small, so little is lost. Bilinear interpolation.
export function rotate(image: RgbaImage, degrees: number, background: Rgb): RgbaImage {
  const { width, height, data } = image;
  const out = new Uint8ClampedArray(width * height * 4);
  const cos = cosDeg(degrees);
  const sin = sinDeg(degrees);
  // Pixel centers: the image's center lies between pixels when a side is even.
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const [br, bg, bb] = background;

  // The value of channel `c` at pixel (x, y) of the input, or the background outside it.
  const at = (x: number, y: number, c: number) =>
    x < 0 || y < 0 || x >= width || y >= height ? background[c] : data[(y * width + x) * 4 + c];

  for (let y = 0; y < height; y++) {
    const dy = y - cy;
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      // Where the output pixel comes from: the inverse rotation.
      const sx = cx + cos * dx + sin * dy;
      const sy = cy - sin * dx + cos * dy;
      const o = (y * width + x) * 4;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      if (x0 < -1 || y0 < -1 || x0 >= width || y0 >= height) {
        out[o] = br;
        out[o + 1] = bg;
        out[o + 2] = bb;
        out[o + 3] = 255;
        continue;
      }
      const fx = sx - x0;
      const fy = sy - y0;
      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;
      for (let c = 0; c < 3; c++) {
        out[o + c] = Math.round(
          at(x0, y0, c) * w00 + at(x0 + 1, y0, c) * w10 + at(x0, y0 + 1, c) * w01 + at(x0 + 1, y0 + 1, c) * w11,
        );
      }
      out[o + 3] = 255;
    }
  }
  return { width, height, data: out };
}

// Straightens a page whose content is skewed by `skew` degrees (as measured by findSkew): rotates it back.
export function deskew(image: RgbaImage, skew: number, background: Rgb = paperColor(image)): RgbaImage {
  return rotate(image, -skew, background);
}

// The paper's color, to fill the corners that a rotation uncovers: the median of each channel over a grid of
// samples. Most of a page of music is paper, so the median ignores the ink, and it follows yellowed paper.
export function paperColor(image: RgbaImage): Rgb {
  const { width, height, data } = image;
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 40_000)));
  const channels: number[][] = [[], [], []];
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) channels[c].push(data[i + c]);
    }
  }
  return channels.map((values) => {
    values.sort((a, b) => a - b);
    return values[values.length >> 1];
  }) as Rgb;
}
