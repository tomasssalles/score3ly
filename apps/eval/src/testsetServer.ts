// Vite dev-server plugin giving the viewer access to the test set folder:
//   GET /api/files         JSON list of the file names in the test set
//   GET /testset/<name>    the file itself
//   PUT /testset/<name>    replaces a highlighter file <piece>.<source>.marks.jsonl (no other files)

import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import type { IncomingMessage } from "node:http";
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
        if (req.method === "PUT") {
          res.statusCode = await saveMarks(name, await readBody(req));
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

// Returns the HTTP status code.
async function saveMarks(name: string, body: string): Promise<number> {
  if (!/^[^.]+\.[^.]+\.marks\.jsonl$/.test(name)) {
    return 403;
  }
  if (!isJsonLines(body)) {
    return 400;
  }
  // Write to a temporary file first, so an interrupted write can't leave a truncated file.
  const path = join(TESTSET_DIR, name);
  await writeFile(`${path}.tmp`, body);
  await rename(`${path}.tmp`, path);
  return 204;
}

// Whether every non-empty line is a JSON object.
function isJsonLines(text: string): boolean {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .every((line) => {
      try {
        const value = JSON.parse(line);
        return typeof value === "object" && value !== null && !Array.isArray(value);
      } catch {
        return false;
      }
    });
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
