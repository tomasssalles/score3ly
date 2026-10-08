// Turns a PDF into page images, measures each page's skew and straightens it, writing PNGs to look at:
//
//   npm run pages -w packages/imaging -- ../../testset/bendel_la_cascade_p4.orig.pdf /tmp/pages
//
// For each page: page-<n>.png (as extracted) and page-<n>.straight.png (deskewed).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas } from "@napi-rs/canvas";
import { deskew, findSkew, openPdf, pageImage, type RgbaImage } from "../src/index.ts";

// Paths are relative to where the command was typed (npm runs the script in this package's folder).
const here = process.env.INIT_CWD ?? process.cwd();
const [pdfArg, outArg] = process.argv.slice(2);
if (!pdfArg || !outArg) {
  console.error("Usage: pages.ts <file.pdf> <output folder>");
  process.exit(1);
}
const pdfPath = resolve(here, pdfArg);
const outDir = resolve(here, outArg);
const pdfjsRoot = dirname(fileURLToPath(import.meta.resolve("pdfjs-dist/package.json")));
const doc = await openPdf(new Uint8Array(readFileSync(pdfPath)), {
  wasmUrl: join(pdfjsRoot, "wasm") + "/",
  standardFontDataUrl: join(pdfjsRoot, "standard_fonts") + "/",
  cMapUrl: join(pdfjsRoot, "cmaps") + "/",
});
mkdirSync(outDir, { recursive: true });

function writePng(image: RgbaImage, path: string) {
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  const data = context.createImageData(image.width, image.height);
  data.data.set(image.data);
  context.putImageData(data, 0, 0);
  writeFileSync(path, canvas.toBuffer("image/png"));
}

for (let n = 1; n <= doc.numPages; n++) {
  const page = await pageImage(doc, n, { createCanvas: (w, h) => createCanvas(w, h) });
  const skew = findSkew(page.image);
  writePng(page.image, join(outDir, `page-${n}.png`));
  writePng(deskew(page.image, skew.angle), join(outDir, `page-${n}.straight.png`));
  console.log(
    `page ${n}: ${page.source}, ${page.image.width}×${page.image.height} px, ${page.dpi} dpi, ` +
      `skew ${skew.angle}° (confidence ${skew.confidence})`,
  );
}
