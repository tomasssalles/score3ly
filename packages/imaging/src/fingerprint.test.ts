import { test } from "node:test";
import assert from "node:assert/strict";
import { asStored, compareFingerprints, fingerprintOf } from "./fingerprint.ts";
import { createImage } from "./image.ts";
import { decodePng, encodePng } from "./png.ts";

function page() {
  const image = createImage(1200, 1600, [250, 245, 230]);
  for (let y = 200; y < 1400; y += 20) for (let x = 80; x < 1120; x++) image.data.set([20, 20, 20], (y * 1200 + x) * 4);
  return image;
}

test("the same pixels are identical; a few changed pixels are close; a moved staff is different", async () => {
  const stored = await fingerprintOf(page());
  assert.equal(compareFingerprints(stored, await fingerprintOf(page())), "identical");

  // Anti-aliasing differences on a vector page: 0.5% of the pixels, by up to 70 gray levels, along the lines.
  const aliased = page();
  for (let y = 201; y < 1400; y += 20) for (let x = 80; x < 1120; x += 6) aliased.data.set([180, 175, 160], (y * 1200 + x) * 4);
  assert.equal(compareFingerprints(stored, await fingerprintOf(aliased)), "close");

  // The music a line lower: different.
  const moved = createImage(1200, 1600, [250, 245, 230]);
  for (let y = 210; y < 1410; y += 20) for (let x = 80; x < 1120; x++) moved.data.set([20, 20, 20], (y * 1200 + x) * 4);
  assert.equal(compareFingerprints(stored, await fingerprintOf(moved)), "different");

  // Another size: different.
  assert.equal(compareFingerprints(stored, await fingerprintOf(createImage(1200, 1601))), "different");
});

test("an image stored as gray is fingerprinted as it reads back", async () => {
  const image = page();
  const decoded = await decodePng(await encodePng(image, { gray: true }));
  assert.deepEqual(await fingerprintOf(asStored(image, true)), await fingerprintOf(decoded));
  assert.deepEqual(await fingerprintOf(asStored(image, false)), await fingerprintOf(await decodePng(await encodePng(image))));
});
