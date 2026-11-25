// Vite dev-server plugin giving the viewer access to the test set folder:
//   GET /api/files         JSON list of the file names in the test set
//   GET /testset/<name>    the file itself
//   PUT /testset/<name>    replaces a highlighter file <piece>.<source>.marks.jsonl (no other files)

import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import { join } from "node:path";
import { text } from "node:stream/consumers";
import type { Plugin } from "vite";
import { TESTSET_DIR } from "./testset.ts";

export function testsetServer(): Plugin {
  return {
    name: "testset-server",
    configureServer(server) {
      server.middlewares.use("/api/files", (_req, res) =>
        answered(res, async () => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(await readdir(TESTSET_DIR)));
        }),
      );

      server.middlewares.use("/testset", (req, res) =>
        answered(res, async () => {
          let name: string;
          try {
            name = decodeURIComponent((req.url ?? "").slice(1));
          } catch {
            name = ""; // a malformed name: refused below
          }
          // Only plain file names, so requests can't reach outside the test set.
          if (!/^[^/\\]+$/.test(name) || name.startsWith(".")) {
            res.statusCode = 400;
            res.end();
            return;
          }
          if (req.method === "PUT") {
            res.statusCode = await saveMarks(name, await text(req));
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
        }),
      );
    },
  };
}

// Runs a middleware's work, answering 500 where it fails: Connect doesn't catch an async middleware's rejection, which
// would leave the request without an answer (review E21).
async function answered(res: ServerResponse, work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.statusCode = 500;
    res.end();
  }
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
