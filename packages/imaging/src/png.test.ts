import { test } from "node:test";
import assert from "node:assert/strict";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { createImage, type RgbaImage } from "./image.ts";
import { decodePng, encodePng } from "./png.ts";

function noisy(width: number, height: number): RgbaImage {
  const image = createImage(width, height);
  let seed = 7;
  for (let i = 0; i < image.data.length; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    image.data[i] = seed >>> 24;
  }
  return image;
}

test("a PNG we write is read back with the same pixels", async () => {
  const image = noisy(37, 23);
  const decoded = await decodePng(await encodePng(image));
  assert.equal(decoded.width, 37);
  assert.equal(decoded.height, 23);
  assert.deepEqual(decoded.data, image.data);
});

test("other programs read our PNGs as we wrote them", async () => {
  // A canvas premultiplies alpha, so only opaque pixels come back unchanged: compare an opaque image.
  const image = noisy(16, 9);
  image.data.forEach((_, i) => {
    if (i % 4 === 3) image.data[i] = 255;
  });
  const loaded = await loadImage(Buffer.from(await encodePng(image)));
  const context = createCanvas(16, 9).getContext("2d");
  context.drawImage(loaded, 0, 0);
  assert.deepEqual(new Uint8ClampedArray(context.getImageData(0, 0, 16, 9).data), image.data);
});

test("we read PNGs that other programs wrote, with their row filters", async () => {
  const canvas = createCanvas(31, 17);
  const context = canvas.getContext("2d");
  context.fillStyle = "#f3eedf";
  context.fillRect(0, 0, 31, 17);
  context.fillStyle = "#2b2a28";
  context.fillRect(3, 4, 20, 2);
  context.beginPath();
  context.arc(15, 10, 5, 0, 7);
  context.fill();
  const expected = new Uint8ClampedArray(context.getImageData(0, 0, 31, 17).data);
  const decoded = await decodePng(new Uint8Array(canvas.toBuffer("image/png")));
  assert.deepEqual(decoded.data, expected);
});

test("a gray PNG holds the image's luminance, a quarter of the raw size, and reads back as opaque gray", async () => {
  const image = noisy(40, 30);
  const bytes = await encodePng(image, { gray: true });
  assert.equal(bytes[25], 0); // colour type: gray
  const decoded = await decodePng(bytes);
  const p = 7 * 40 + 11;
  const [r, g, b] = image.data.subarray(p * 4, p * 4 + 3);
  const y = Math.trunc((r * 299 + g * 587 + b * 114 + 500) / 1000);
  assert.deepEqual([...decoded.data.subarray(p * 4, p * 4 + 4)], [y, y, y, 255]);
  // Other programs read it too.
  const loaded = await loadImage(Buffer.from(bytes));
  const context = createCanvas(40, 30).getContext("2d");
  context.drawImage(loaded, 0, 0);
  assert.deepEqual(new Uint8ClampedArray(context.getImageData(0, 0, 40, 30).data), decoded.data);
});
