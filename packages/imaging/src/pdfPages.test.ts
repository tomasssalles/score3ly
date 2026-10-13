import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas } from "@napi-rs/canvas";
import { luminance, type RgbaImage } from "./image.ts";
import { openPdf, pageImage, type CreateCanvas } from "./pdfPages.ts";
import { deskewAngle, findSkew } from "./skew.ts";
import { deskew, paperColor, rotate } from "./rotate.ts";
import { crop } from "./crop.ts";

const testset = join(dirname(fileURLToPath(import.meta.url)), "../../../testset");
const pdfjsRoot = dirname(fileURLToPath(import.meta.resolve("pdfjs-dist/package.json")));
const assets = {
  wasmUrl: join(pdfjsRoot, "wasm") + "/",
  standardFontDataUrl: join(pdfjsRoot, "standard_fonts") + "/",
};
const canvas: CreateCanvas = (width, height) => createCanvas(width, height);

async function page(name: string, pageNumber: number) {
  const doc = await openPdf(new Uint8Array(readFileSync(join(testset, `${name}.orig.pdf`))), assets);
  return pageImage(doc, pageNumber, { createCanvas: canvas });
}

function hash(image: RgbaImage): string {
  return createHash("sha256").update(image.data).digest("hex");
}

function darkShare(image: RgbaImage): number {
  return luminance(image).filter((v) => v < 128).length / (image.width * image.height);
}

test("a colour JPEG scan is its embedded image, colour kept", async () => {
  const { image, source, dpi } = await page("schumann_kinderscenen_first_edition_p3", 1);
  assert.equal(source, "embedded");
  assert.deepEqual([image.width, image.height, dpi], [2000, 2578, 72]);
  // The paper is yellowed: red above blue.
  const i = (300 * image.width + 300) * 4;
  assert.ok(image.data[i] > image.data[i + 2] + 10);
  // Decoded by pdf.js's own JPEG decoder: the same pixels everywhere. A new pdf.js version may change them.
  assert.equal(hash(image), KINDERSCENEN_P3_HASH);
});

test("a 1-bit scan stored as a stencil mask: black ink on white", async () => {
  const { image, source, dpi } = await page("liszt_consolations_first_edition", 2);
  assert.equal(source, "embedded");
  assert.deepEqual([image.width, image.height, dpi], [2999, 4228, 363]);
  assert.deepEqual([...image.data.subarray(0, 4)], [255, 255, 255, 255]);
  const share = darkShare(image);
  assert.ok(share > 0.02 && share < 0.3, `ink covers ${share}`);
});

test("a scan with transparency (a soft mask) is laid on white paper", async () => {
  const { image, source } = await page("bendel_la_cascade_p4", 1);
  assert.equal(source, "embedded");
  assert.deepEqual([...image.data.subarray(0, 4)], [255, 255, 255, 255]);
  const share = darkShare(image);
  assert.ok(share > 0.02 && share < 0.3, `ink covers ${share}`);
});

test("a JBIG2 scan", async () => {
  const { image, source, dpi } = await page("beethoven_fuer_elise_leipzig", 2);
  assert.equal(source, "embedded");
  assert.deepEqual([image.width, image.height, dpi], [5400, 7200, 600]);
});

test("a scan stored with non-square pixels gets square ones, as the PDF shows it", async () => {
  // Stored as 2480 × 1754 pixels, shown on an A4 page: 300 dpi across, 150 down.
  const { image, dpi } = await page("villa-lobos_bachianas_brasileiras_4_prelude", 1);
  assert.deepEqual([image.width, image.height, dpi], [2480, 3508, 300]);
});

test("only the part of a scan that lies on the page is kept", async () => {
  const { image, source } = await page("bach_cello_suite_I_prelude_leipzig", 1);
  assert.equal(source, "embedded");
  assert.deepEqual([image.width, image.height], [2849, 3753]);
});

test("a vector page is drawn at 300 dpi, its size computed from its points", async () => {
  const { image, source, dpi } = await page("debussy_clair_de_lune_mutopia", 1);
  assert.equal(source, "rendered");
  assert.deepEqual([image.width, image.height, dpi], [2550, 3300, 300]); // 612 × 792 points
  const share = darkShare(image);
  assert.ok(share > 0.01 && share < 0.3, `ink covers ${share}`);
});

test("without a canvas, a vector page can't be drawn", async () => {
  const doc = await openPdf(
    new Uint8Array(readFileSync(join(testset, "debussy_clair_de_lune_mutopia.orig.pdf"))),
    assets,
  );
  await assert.rejects(pageImage(doc, 1), /isn't a plain scan/);
});

test("a real page's skew is found again after turning it by a known angle", async () => {
  const { image } = await page("villa-lobos_bachianas_brasileiras_4_prelude", 1);
  const base = findSkew(image).angle;
  const turned = findSkew(rotate(image, 1.5, [255, 255, 255])).angle;
  assert.ok(Math.abs(turned - (base + 1.5)) <= 0.05, `${base}° turned by 1.5° measured ${turned}°`);
  assert.ok(Math.abs(findSkew(deskew(image, base)).angle) <= 0.03);
});

test("on real pages turned by a known angle, the lines and the deskew angle from them follow", async () => {
  for (const [name, pageNumber] of [
    ["villa-lobos_bachianas_brasileiras_4_prelude", 1],
    ["beethoven_fuer_elise_leipzig", 1],
    ["debussy_clair_de_lune_mutopia", 2],
  ] as const) {
    const { image } = await page(name, pageNumber);
    const base = deskewAngle(findSkew(image).lines, image.width) ?? 0;
    const turned = rotate(image, 1.5, [255, 255, 255]);
    const skew = findSkew(turned);
    assert.ok(skew.lines.length >= 3, `${name}: ${skew.lines.length} lines`);
    // A scanned page isn't perfectly flat: its lines differ by up to about 0.2° (a vector page's agree to 0.005°).
    for (const line of skew.lines) {
      assert.ok(Math.abs(line.angle - (base + 1.5)) <= 0.25, `${name}: a line at ${line.angle}°, page at ${base + 1.5}°`);
    }
    const angle = deskewAngle(skew.lines, turned.width) ?? 0;
    assert.ok(Math.abs(angle - (base + 1.5)) <= 0.05, `${name}: ${base}° turned by 1.5° gives ${angle}°`);
  }
});

test("a real page turned far beyond the default maximum is found with a larger one", async () => {
  // Kinderscenen p3, without the scanner's black borders, turned by 20°.
  const scan = (await page("schumann_kinderscenen_first_edition", 3)).image;
  const paper = crop(scan, { left: 0.05, right: 0.92, top: 0.05, bottom: 0.94 });
  const base = deskewAngle(findSkew(paper).lines, paper.width) ?? 0;
  const turned = rotate(paper, 20, paperColor(paper));
  assert.deepEqual(findSkew(turned).lines, [], "the default maximum");
  const skew = findSkew(turned, { maxAngle: 25 });
  assert.ok(skew.lines.length >= 3, `${skew.lines.length} lines`);
  const angle = deskewAngle(skew.lines, turned.width) ?? 0;
  assert.ok(Math.abs(angle - (base + 20)) <= 0.05, `${base}° turned by 20° gives ${angle}°`);
});

test("covers have no lines", async () => {
  for (const name of ["bendel_la_cascade", "liszt_consolations_first_edition", "schumann_kinderscenen_first_edition"]) {
    assert.deepEqual(findSkew((await page(name, 1)).image).lines, [], name);
  }
});

test("staves are found on music pages and not on covers", async () => {
  for (const [name, pageNumber, music] of [
    ["bendel_la_cascade", 1, false],
    ["liszt_consolations_first_edition", 1, false],
    ["schumann_kinderscenen_first_edition", 1, false],
    ["bendel_la_cascade_p4", 1, true],
    ["liszt_consolations_first_edition", 3, true],
    ["debussy_clair_de_lune_mutopia", 1, true],
  ] as const) {
    const { staves } = findSkew((await page(name, pageNumber)).image);
    assert.equal(staves.length > 0, music, `${name} page ${pageNumber}: ${staves.length} staves`);
  }
});

const KINDERSCENEN_P3_HASH = "d27a2e83523a0935bca67297605324c2ba6326758b06d1b0ad3e3c6c7187b8fe";
