// Vite plugin for the data files pdf.js loads at runtime, under /pdfjs/<folder>/<name>:
// served by the dev server, and copied into the build. Without the wasm decoders, for example,
// pages with JBIG2 or JPEG 2000 scans render blank. (apps/eval has a dev-only copy of this.)

import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { Plugin } from "vite";

const FOLDERS = ["wasm", "cmaps", "standard_fonts", "iccs"];

const PDFJS_DIR = dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json"));

export function pdfjsAssets(): Plugin {
  return {
    name: "pdfjs-assets",
    configureServer(server) {
      server.middlewares.use("/pdfjs", async (req, res) => {
        const match = /^\/([^/]+)\/([^/]+)$/.exec(req.url ?? "");
        if (match === null || !FOLDERS.includes(match[1]) || match[2].startsWith(".")) {
          res.statusCode = 404;
          res.end();
          return;
        }
        try {
          const content = await readFile(join(PDFJS_DIR, match[1], match[2]));
          if (match[2].endsWith(".wasm")) {
            res.setHeader("Content-Type", "application/wasm");
          }
          res.end(content);
        } catch {
          res.statusCode = 404;
          res.end();
        }
      });
    },
    async generateBundle() {
      for (const folder of FOLDERS) {
        for (const name of await readdir(join(PDFJS_DIR, folder))) {
          this.emitFile({
            type: "asset",
            fileName: `pdfjs/${folder}/${name}`,
            source: await readFile(join(PDFJS_DIR, folder, name)),
          });
        }
      }
    },
  };
}
