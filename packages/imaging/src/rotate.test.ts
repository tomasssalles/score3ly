import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createImage, type RgbaImage } from "./image.ts";
import { deskew, paperColor, rotate } from "./rotate.ts";
import { fillRect, musicPage } from "./testPages.ts";

const white = [255, 255, 255] as const;

function pixel(image: RgbaImage, x: number, y: number): number[] {
  const i = (y * image.width + x) * 4;
  return [...image.data.subarray(i, i + 4)];
}

test("rotating by 0 changes nothing", () => {
  const page = musicPage(300, 400);
  assert.deepEqual(rotate(page, 0, [...white]).data, page.data);
});

test("a positive angle turns the content clockwise as seen on screen", () => {
  const image = createImage(11, 11);
  fillRect(image, 8, 5, 1, 1, [0, 0, 0]); // right of the center
  const turned = rotate(image, 90, [...white]);
  assert.deepEqual(pixel(turned, 5, 8), [0, 0, 0, 255]); // now below it
  assert.deepEqual(pixel(turned, 8, 5), [255, 255, 255, 255]);
});

test("the size stays, and areas rotated in get the background", () => {
  const image = createImage(40, 20, [0, 0, 0]);
  const turned = rotate(image, 30, [200, 100, 50]);
  assert.equal(turned.width, 40);
  assert.equal(turned.height, 20);
  assert.deepEqual(pixel(turned, 0, 0), [200, 100, 50, 255]);
  assert.deepEqual(pixel(turned, 20, 10), [0, 0, 0, 255]);
});

test("deskewing undoes a skew: the same ink where it was, up to the interpolation's blur", () => {
  const page = musicPage(600, 800);
  const back = deskew(rotate(page, 1.7, [250, 247, 238]), 1.7);
  let same = 0;
  let count = 0;
  for (let y = 100; y < 700; y++) {
    for (let x = 100; x < 500; x++) {
      const i = (y * 600 + x) * 4;
      if (back.data[i] < 128 === page.data[i] < 128) same++;
      count++;
    }
  }
  assert.ok(same / count > 0.99, `${same / count} of the pixels agree`);
});

test("the paper's color is the median color, ink ignored", () => {
  assert.deepEqual(paperColor(musicPage(600, 800, { paper: [240, 225, 190] })), [240, 225, 190]);
});

// Same input, same pixels, on every device (DESIGN.md §8.2). If this hash changes, rotation changed: that is a
// new step version, since stored work refers to rotated pixels.
test("rotation gives exactly the same pixels as before", () => {
  const turned = rotate(musicPage(400, 500, { noise: 10 }), -1.234, [250, 247, 238]);
  const hash = createHash("sha256").update(turned.data).digest("hex");
  assert.equal(hash, ROTATED_HASH);
});

const ROTATED_HASH = "8a5f35038e1adb12a2601a025f921c3acbd6281df1dfc4ef1a18981bdf8670e8";
