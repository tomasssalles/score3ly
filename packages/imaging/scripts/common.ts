// Shared by the scripts: opening a PDF in Node, writing PNGs, and paths relative to where the command was typed.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas } from "@napi-rs/canvas";
import { openPdf, type CreateCanvas, type PdfDocument, type RgbaImage } from "../src/index.ts";

// npm runs the scripts in this package's folder; paths given on the command line are relative to where it was
// typed.
export function userPath(path: string): string {
  return resolve(process.env.INIT_CWD ?? process.cwd(), path);
}

export async function openPdfFile(path: string): Promise<PdfDocument> {
  const pdfjsRoot = dirname(fileURLToPath(import.meta.resolve("pdfjs-dist/package.json")));
  return openPdf(new Uint8Array(readFileSync(path)), {
    wasmUrl: join(pdfjsRoot, "wasm") + "/",
    standardFontDataUrl: join(pdfjsRoot, "standard_fonts") + "/",
    cMapUrl: join(pdfjsRoot, "cmaps") + "/",
  });
}

export const nodeCanvas: CreateCanvas = (width, height) => createCanvas(width, height);

export function writePng(image: RgbaImage, path: string) {
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  const data = context.createImageData(image.width, image.height);
  data.data.set(image.data);
  context.putImageData(data, 0, 0);
  writeFileSync(path, canvas.toBuffer("image/png"));
}
