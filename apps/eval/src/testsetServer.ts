// Vite dev-server plugin giving the viewer access to the test set folder:
//   GET /api/files         JSON list of the file names in the test set
//   GET /testset/<name>    the file itself

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Plugin } from "vite";
import { TESTSET_DIR } from "./testset.ts";

export function testsetServer(): Plugin {
  return {
    name: "testset-server",
    configureServer(server) {
      server.middlewares.use("/api/files", async (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(await readdir(TESTSET_DIR)));
      });

      server.middlewares.use("/testset", async (req, res) => {
        const name = decodeURIComponent((req.url ?? "").slice(1));
        // Only plain file names, so requests can't reach outside the test set.
        if (!/^[^/\\]+$/.test(name) || name.startsWith(".")) {
          res.statusCode = 400;
          res.end();
          return;
        }
        try {
          const content = await readFile(join(TESTSET_DIR, name));
          if (name.endsWith(".pdf")) {
            res.setHeader("Content-Type", "application/pdf");
          }
          res.end(content);
        } catch {
          res.statusCode = 404;
          res.end();
        }
      });
    },
  };
}
