// Turns a PDF into page images, measures each page's skew and straightens it, writing PNGs to look at:
//
//   npm run pages -w packages/imaging -- testset/bendel_la_cascade_p4.orig.pdf /tmp/pages
//
// For each page: page-<n>.png (as extracted) and page-<n>.straight.png, deskewed if the rule of DESIGN.md §8.4 says
// so (staves found, a trustworthy angle large enough to matter), else the same as extracted.

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { deskew, findSkew, pageImage, shouldDeskew } from "../src/index.ts";
import { nodeCanvas, openPdfFile, userPath, writePng } from "./common.ts";

const [pdfArg, outArg] = process.argv.slice(2);
if (!pdfArg || !outArg) {
  console.error("Usage: pages.ts <file.pdf> <output folder>");
  process.exit(1);
}
const doc = await openPdfFile(userPath(pdfArg));
const outDir = userPath(outArg);
mkdirSync(outDir, { recursive: true });

for (let n = 1; n <= doc.numPages; n++) {
  const page = await pageImage(doc, n, { createCanvas: nodeCanvas });
  const skew = findSkew(page.image);
  const decision = shouldDeskew(skew, page.image.width);
  writePng(page.image, join(outDir, `page-${n}.png`));
  writePng(decision.deskew ? deskew(page.image, skew.angle) : page.image, join(outDir, `page-${n}.straight.png`));
  console.log(
    `page ${n}: ${page.source}, ${page.image.width}×${page.image.height} px, ${page.dpi} dpi, ` +
      `skew ${skew.angle}° (confidence ${skew.confidence}), ${skew.staves.length} staves: ` +
      (decision.deskew ? "deskewed" : `not deskewed, ${decision.reason}`),
  );
}
