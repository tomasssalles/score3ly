// Snapshots of the images and results imaging makes, taken before the code review's batch 22 moved the box geometry
// into @score3ly/core and split skew.ts (review/plan.md, "What guards requests"): the same inputs must give the same
// pixels, PNG bytes, fingerprints and skew results, or recipes, fingerprints and stored lines no longer match. Only a
// change that means to change images (the paid release) may update them.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { crop } from "./crop.ts";
import { drawLayout } from "./draw.ts";
import { asStored, fingerprintOf } from "./fingerprint.ts";
import { decodePng, encodePng } from "./png.ts";
import { rotate } from "./rotate.ts";
import { deskewAngle, findSkew } from "./skew.ts";
import { musicPage } from "./testPages.ts";

const paper = [250, 247, 238] as [number, number, number];
const hash = (bytes: Uint8Array | Uint8ClampedArray | string) => createHash("sha256").update(bytes).digest("hex").slice(0, 16);
const json = (value: unknown) => hash(JSON.stringify(value));

// A page with four systems and their bar lines (one just outside its box, as `layout` accepts within its tolerance).
const SYSTEMS = [
  { box: { left: 0.08, right: 0.92, top: 0.09, bottom: 0.2 }, barLines: [0.3, 0.52, 0.71] },
  { box: { left: 0.08, right: 0.92, top: 0.3, bottom: 0.41 }, barLines: [0.25, 0.5, 0.75] },
  { box: { left: 0.1, right: 0.9, top: 0.51, bottom: 0.62 }, barLines: [0.33333, 0.66667, 0.905] },
  { box: { left: 0.08, right: 0.6, top: 0.72, bottom: 0.83 }, barLines: [0.33] },
];

async function snapshots(): Promise<Record<string, string>> {
  const page = musicPage(1200, 1600, { noise: 6, seed: 3 });
  const skewed = rotate(page, 1.3, paper);
  const steep = rotate(page, 15, paper);
  const once = findSkew(skewed);
  const twice = findSkew(steep, { maxAngle: 20 });
  assert.ok(once.lines.length >= 3 && twice.lines.length >= 3 && once.staves.length > 0 && twice.staves.length > 0);
  const gray = await encodePng(skewed, { gray: true });
  const colour = await encodePng(skewed);
  const decodedGray = await decodePng(gray);
  const drawn = drawLayout(skewed, SYSTEMS, { first: 5, barLineNumbers: true });
  const cut = crop(skewed, { left: 0.07, right: 0.93, top: 0.0735, bottom: 0.2165 });
  return {
    "skew, one pass": json(once),
    "skew, two passes": json(twice),
    "deskew angles": json([deskewAngle(once.lines, skewed.width), deskewAngle(twice.lines, steep.width)]),
    "gray PNG": hash(gray),
    "colour PNG": hash(colour),
    "gray PNG decoded": hash(decodedGray.data),
    "as stored, gray": hash(asStored(skewed, true).data),
    "fingerprint, gray": json(await fingerprintOf(asStored(skewed, true))),
    "fingerprint, colour": json(await fingerprintOf(asStored(skewed, false))),
    "layout drawn": hash(drawn.data),
    crop: json([cut.width, cut.height, hash(cut.data)]),
  };
}

test("imaging's images and results are as they were", async () => {
  assert.deepEqual(await snapshots(), {
    "as stored, gray": "bc7b3789e932523a",
    "colour PNG": "7a98b1971b776008",
    "deskew angles": "2e9e7846fb01464a",
    "fingerprint, colour": "134747270679e51b",
    "fingerprint, gray": "966572510041526b",
    "gray PNG decoded": "bc7b3789e932523a",
    "gray PNG": "47e7cdc1c1411732",
    "layout drawn": "5f5707ee0f7eec32",
    "skew, one pass": "11f1ed3626943a6f",
    "skew, two passes": "4d39fe5d6d1fd65d",
    crop: "3ebcbba6e4e3c590",
  });
});
