// Cuts named regions out of page images and writes each as <name>.png:
//
//   npm run crops -w packages/imaging -- "/tmp/pages/page-{n}.straight.png" regions.json /tmp/crops
//
// The first argument is the page images' path, with {n} standing for the page number (from 1): in the pipeline,
// the pages as extracted from the PDF and deskewed (`npm run pages` writes them so). regions.json maps names to
// regions, with boxes as fractions of the page image (DESIGN.md §6), e.g.
//   { "system_1": { "page": 1, "bbox": { "left": 0.05, "right": 0.95, "top": 0.1, "bottom": 0.28 } } }

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { crop, parseRegions } from "../src/index.ts";
import { readPng, userPath, writePng } from "./common.ts";

const [pagesArg, regionsArg, outArg] = process.argv.slice(2);
if (!pagesArg || !regionsArg || !outArg || !pagesArg.includes("{n}")) {
  console.error('Usage: crops.ts "<page images, with {n} for the page number>" <regions.json> <output folder>');
  process.exit(1);
}

let regions;
try {
  regions = parseRegions(JSON.parse(readFileSync(userPath(regionsArg), "utf8")));
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
const pagePath = (page: number) => userPath(pagesArg.replaceAll("{n}", String(page)));
const pages = [...new Set(regions.map((r) => r.page))].sort((a, b) => a - b);
const missing = pages.filter((page) => !existsSync(pagePath(page)));
if (missing.length > 0) {
  console.error(`Missing page images: ${missing.map(pagePath).join(", ")}`);
  process.exit(1);
}
const outDir = userPath(outArg);
mkdirSync(outDir, { recursive: true });

// Page by page, so only one page image is held at a time.
for (const page of pages) {
  const image = await readPng(pagePath(page));
  for (const region of regions.filter((r) => r.page === page)) {
    const part = crop(image, region.box);
    writePng(part, join(outDir, `${region.name}.png`));
    console.log(`${region.name}.png: page ${page}, ${part.width}×${part.height} px`);
  }
}
