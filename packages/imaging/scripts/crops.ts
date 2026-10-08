// Cuts named regions out of a PDF's pages and writes each as <name>.png:
//
//   npm run crops -w packages/imaging -- score.pdf regions.json /tmp/crops [--deskew]
//
// regions.json maps names to regions, e.g.
//   { "system_1": { "page": 1, "bbox": { "left": 0.05, "right": 0.95, "top": 0.1, "bottom": 0.28 } } }
// with pages counted from 1 and boxes as fractions of the page image (DESIGN.md §6). With --deskew, each page is
// straightened first (findSkew), for boxes that were found on straightened pages.

import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { crop, deskew, findSkew, pageImage, parseRegions, type RgbaImage } from "../src/index.ts";
import { nodeCanvas, openPdfFile, userPath, writePng } from "./common.ts";

const args = process.argv.slice(2);
const straighten = args.includes("--deskew");
const [pdfArg, regionsArg, outArg] = args.filter((a) => a !== "--deskew");
if (!pdfArg || !regionsArg || !outArg) {
  console.error("Usage: crops.ts <file.pdf> <regions.json> <output folder> [--deskew]");
  process.exit(1);
}

let regions;
try {
  regions = parseRegions(JSON.parse(readFileSync(userPath(regionsArg), "utf8")));
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
const doc = await openPdfFile(userPath(pdfArg));
const missing = regions.filter((r) => r.page > doc.numPages);
if (missing.length > 0) {
  console.error(
    `The PDF has ${doc.numPages} pages; these regions are beyond: ${missing.map((r) => r.name).join(", ")}`,
  );
  process.exit(1);
}
const outDir = userPath(outArg);
mkdirSync(outDir, { recursive: true });

// Page by page, so only one page image is held at a time.
const pages = [...new Set(regions.map((r) => r.page))].sort((a, b) => a - b);
for (const pageNumber of pages) {
  let image: RgbaImage = (await pageImage(doc, pageNumber, { createCanvas: nodeCanvas })).image;
  if (straighten) {
    const skew = findSkew(image);
    image = deskew(image, skew.angle);
    console.log(`page ${pageNumber}: straightened by ${skew.angle}°`);
  }
  for (const region of regions.filter((r) => r.page === pageNumber)) {
    const part = crop(image, region.box);
    writePng(part, join(outDir, `${region.name}.png`));
    console.log(`${region.name}.png: page ${pageNumber}, ${part.width}×${part.height} px`);
  }
}
