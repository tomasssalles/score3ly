// The desktop version's server (docs/desktop.md): the Worker's Hono app on Node, listening on
// 127.0.0.1 only, with D1 as a SQLite file, R2 as a folder of files and the secrets from a file, all in one data
// folder; it also serves the built web app, as Cloudflare serves its assets. Electron's main process starts it
// (main.ts); it also runs alone, as a plain local server for development (`node dist/server.js`).

import { serve, type ServerType } from "@hono/node-server";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { extname, join, normalize, relative } from "node:path";
import worker from "../../worker/src/index.ts";
import { migrate, NodeD1 } from "./d1.ts";
import { NodeR2 } from "./r2.ts";
import { SecretsFile } from "./secrets.ts";

export type Host = "desktop" | "local";

export type WindowTheme = "system" | "dark" | "light";

export type ServerOptions = {
  dataDir: string; // the database, the stored files and the secrets file
  webDir: string; // the built web app (apps/web/dist)
  migrationsDir: string; // the Worker's migration files, applied at startup
  host: Host;
  port?: number; // 0 (the default) picks a free one
  openSecretsFile?: (path: string) => void; // Electron: opens the file in the system's editor
  setWindowTheme?: (theme: WindowTheme) => void; // Electron: the window's frame in the app's theme, or the system's
};

export type RunningServer = { url: string; secretsPath: string; close: () => Promise<void> };

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".map": "application/json",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".pdf": "application/pdf",
  ".bcmap": "application/octet-stream",
};

// A file of the web app for a path, if there is one ("/" is index.html).
function webFile(webDir: string, pathname: string): string | null {
  const path = normalize(join(webDir, decodeURIComponent(pathname === "/" ? "/index.html" : pathname)));
  if (relative(webDir, path).startsWith("..")) return null;
  return existsSync(path) && statSync(path).isFile() ? path : null;
}

export async function startServer(options: ServerOptions): Promise<RunningServer> {
  mkdirSync(options.dataDir, { recursive: true });
  const db = new NodeD1(join(options.dataDir, "score3ly.sqlite"));
  migrate(db, options.migrationsDir);
  const files = new NodeR2(join(options.dataDir, "files"));
  const secrets = new SecretsFile(join(options.dataDir, "secrets.env"));
  const ctx = { waitUntil: (promise: Promise<unknown>) => void promise.catch((err) => console.error(err)), passThroughOnException() {}, props: {} };

  const fetch = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (url.pathname === "/api/info") return Response.json({ host: options.host });
    if (url.pathname === "/api/secrets-file/open" && request.method === "POST") {
      if (!options.openSecretsFile) return Response.json({ error: "this host can't open files" }, { status: 404 });
      options.openSecretsFile(secrets.path);
      return Response.json({ path: secrets.path });
    }
    if (url.pathname === "/api/window/theme" && request.method === "POST") {
      const body = (await request.json().catch(() => null)) as { theme?: unknown } | null;
      const theme = body?.theme;
      if (theme !== "system" && theme !== "dark" && theme !== "light") return Response.json({ error: "expected 'theme'" }, { status: 400 });
      if (!options.setWindowTheme) return Response.json({ error: "this host has no window" }, { status: 404 });
      options.setWindowTheme(theme);
      return Response.json({ theme });
    }
    if (!url.pathname.startsWith("/api/") && (request.method === "GET" || request.method === "HEAD")) {
      const file = webFile(options.webDir, url.pathname);
      if (file) {
        const type = TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
        // Vite's hashed assets never change; the rest (index.html, the manifest) is looked at again each time.
        const cache = url.pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache";
        return new Response(request.method === "HEAD" ? null : readFileSync(file), { headers: { "Content-Type": type, "Cache-Control": cache } });
      }
    }
    // The secrets are the environment's other values, as a Worker's are.
    const env = { ...secrets.read(), DB: db, PDFS: files } as unknown as Env;
    return worker.fetch(request, env, ctx as unknown as ExecutionContext);
  };

  const server: ServerType = await new Promise((resolve) => {
    const s = serve({ fetch, hostname: "127.0.0.1", port: options.port ?? 0 }, () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/`,
    secretsPath: secrets.path,
    close: () =>
      new Promise((resolve) =>
        server.close(() => {
          db.close();
          resolve();
        }),
      ),
  };
}

// Run alone, for development: `node dist/server.js [--data <folder>] [--port <port>]`, as a plain local server.
function argument(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

if (process.argv[1] && /server\.(js|ts)$/.test(process.argv[1]) && !process.versions.electron) {
  const here = import.meta.dirname;
  const dataDir = argument("--data") ?? join(process.env.HOME ?? process.env.USERPROFILE ?? ".", ".score3ly");
  startServer({
    dataDir,
    webDir: join(here, "web"),
    migrationsDir: join(here, "migrations"),
    host: "local",
    port: Number(argument("--port") ?? 8790),
  }).then(
    ({ url, secretsPath }) => console.log(`score3ly at ${url}\ndata in ${dataDir}\nsecrets in ${secretsPath}`),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}
