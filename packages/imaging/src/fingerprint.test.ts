import { test } from "node:test";
import assert from "node:assert/strict";
import { asStored, compareFingerprints, fingerprintOf } from "./fingerprint.ts";
import { createImage } from "./image.ts";
import { decodePng, encodePng } from "./png.ts";
import { createHash } from "node:crypto";

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

// A snapshot taken before the code review's batch 7 moved the SHA-256 and the base64 into @score3ly/core: fingerprints
// already stored must still compare as they did.
test("a fingerprint is as it was", async () => {
  const image = page();
  for (let i = 0; i < image.data.length; i += 4093) image.data[i] = (i * 31) & 255;
  const { thumbnail, ...rest } = await fingerprintOf(image);
  assert.deepEqual(rest, { version: 1, width: 1200, height: 1600, pixelsSha256: "45d727558f9139eaf8a8ef898ef7b886e003d00a9ffd5179df43323da6f06e0c", thumbnailWidth: 64, thumbnailHeight: 64 });
  assert.equal(createHash("sha256").update(thumbnail).digest("hex"), "448b412f74a0379b3f8a58b105dd1dc1ba2c98f397e50c7e9ebbbc96b33e1196");
});
