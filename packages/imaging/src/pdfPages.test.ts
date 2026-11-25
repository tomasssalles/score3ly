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

// A one-page PDF whose only content is a 1-bit stencil mask covering the page (8 × 8 pixels: ink where a bit is 0,
// here the left half), painted in the fill that `fill` sets (content stream operators), with a shading pattern P0.
function stencilPdf(fill: string): Uint8Array {
  const mask = Buffer.from(Array(8).fill(0x0f));
  const content = `${fill}\nq 72 0 0 72 0 0 cm /Im0 Do Q\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 72 72] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> /Pattern << /P0 6 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
    `<< /Type /XObject /Subtype /Image /Width 8 /Height 8 /ImageMask true /BitsPerComponent 1 /Length ${mask.length} >>\nstream\n${mask.toString("latin1")}\nendstream`,
    "<< /PatternType 2 /Shading << /ShadingType 2 /ColorSpace /DeviceRGB /Coords [0 0 72 0] /Function << /FunctionType 2 /Domain [0 1] /C0 [1 0 0] /C1 [0 0 1] /N 1 >> >> >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf, "latin1"));
}

async function stencilPage(fill: string) {
  return pageImage(await openPdf(stencilPdf(fill), assets), 1, { createCanvas: canvas, dpi: 72 });
}

test("a stencil mask is painted in its fill colour, whatever colour space set it", async () => {
  // pdf.js gives every plain colour as #rrggbb (gray, RGB, CMYK alike).
  for (const [fill, ink] of [["", [0, 0, 0]], ["0.5 g", [128, 128, 128]], ["1 0 0 rg", [255, 0, 0]]] as const) {
    const { image, source } = await stencilPage(fill);
    assert.equal(source, "embedded", fill);
    assert.deepEqual([...image.data.subarray(0, 3)], ink, fill);
    assert.deepEqual([...image.data.subarray(28, 31)], [255, 255, 255], fill);
  }
});

// The code review's level 1 (pdfPages' parseColor): a fill that isn't a plain colour left the colour set before it, so
// a mask painted with a pattern came out in that colour (here black) as if it were a scan. Such a page is drawn instead.
test("a stencil mask painted with a pattern isn't taken as a scan: the page is drawn", async () => {
  const { image, source } = await stencilPage("/Pattern cs /P0 scn");
  assert.equal(source, "rendered");
  // The shading shows where the ink is: red at the left edge, not black.
  const [r, g, b] = image.data.subarray(0, 3);
  assert.ok(r > 128 && g < 64 && b < 128, `left edge ${[r, g, b]}`);
});
