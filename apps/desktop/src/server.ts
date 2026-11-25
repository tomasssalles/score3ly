// The desktop version's server (docs/desktop.md): the Worker's Hono app on Node, listening on
// 127.0.0.1 only, with D1 as a SQLite file, R2 as a folder of files and the secrets from a file, all in one data
// folder; it also serves the built web app, as Cloudflare serves its assets. Electron's main process starts it
// (main.ts); it also runs alone, as a plain local server for development (`node dist/server.js`).

import { serve, type ServerType } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { mkdirSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { parseArgs } from "node:util";
import worker from "../../worker/src/index.ts";
import { migrate, NodeD1 } from "../../worker/src/node/d1.ts";
import { nodeEnv } from "../../worker/src/node/env.ts";
import { NodeR2 } from "../../worker/src/node/r2.ts";
import { SecretsFile } from "./secrets.ts";
import { type Host as CoreHost, type Info, isWindowTheme, type WindowTheme } from "@score3ly/core";

// This server's hosts (`Host`, core: the web app asks which, `GET /api/info`).
export type Host = Exclude<CoreHost, "cloudflare">;

export type { WindowTheme };

export type ServerOptions = {
  dataDir: string; // the database, the stored files and the secrets file
  webDir: string; // the built web app (apps/web/dist)
  migrationsDir: string; // the Worker's migration files, applied at startup
  host: Host;
  port?: number; // 0 (the default) picks a free one
  openSecretsFile?: (path: string) => void; // Electron: opens the file in the system's editor
  setWindowTheme?: (theme: WindowTheme) => void; // Electron: the window's frame in the app's theme, or the system's
  devProviders?: boolean; // the providers for development offered too (the Worker's DEV_PROVIDERS, docs/llm.md)
};

export type RunningServer = { url: string; secretsPath: string; close: () => Promise<void> };

// The built web app, by `serve-static` (its content types, and its refusal of paths with "..", "%" or "\\", which
// fall through to the Worker, as a missing file does). Vite's hashed assets never change; the rest (index.html, the
// manifest) is looked at again each time.
function webApp(webDir: string): Hono {
  const web = new Hono();
  web.use(
    "*",
    serveStatic({
      root: webDir,
      onFound: (_path, c) => c.header("Cache-Control", c.req.path.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache"),
    }),
  );
  return web;
}

export async function startServer(options: ServerOptions): Promise<RunningServer> {
  mkdirSync(options.dataDir, { recursive: true });
  const db = new NodeD1(join(options.dataDir, "score3ly.sqlite"));
  migrate(db, options.migrationsDir);
  const files = new NodeR2(join(options.dataDir, "files"));
  const secrets = new SecretsFile(join(options.dataDir, "secrets.env"));
  const web = webApp(options.webDir);
  const ctx = { waitUntil: (promise: Promise<unknown>) => void promise.catch((err) => console.error(err)), passThroughOnException() {}, props: {} };

  const fetch = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (url.pathname === "/api/info") return Response.json({ host: options.host } satisfies Info);
    if (url.pathname === "/api/secrets-file/open" && request.method === "POST") {
      if (!options.openSecretsFile) return Response.json({ error: "this host can't open files" }, { status: 404 });
      options.openSecretsFile(secrets.path);
      return Response.json({ path: secrets.path });
    }
    if (url.pathname === "/api/window/theme" && request.method === "POST") {
      const body = (await request.json().catch(() => null)) as { theme?: unknown } | null;
      const theme = body?.theme;
      if (!isWindowTheme(theme)) return Response.json({ error: "expected 'theme'" }, { status: 400 });
      if (!options.setWindowTheme) return Response.json({ error: "this host has no window" }, { status: 404 });
      options.setWindowTheme(theme);
      return Response.json({ theme });
    }
    if (!url.pathname.startsWith("/api/") && (request.method === "GET" || request.method === "HEAD")) {
      const found = await web.fetch(request);
      if (found.status !== 404) return found;
    }
    // The secrets are the environment's other values, as a Worker's are, read again at each request.
    const env = nodeEnv({ db, files, secrets: secrets.read(), devProviders: options.devProviders });
    return worker.fetch(request, env, ctx as unknown as ExecutionContext);
  };

  // A port in use (another server running) is a refusal the caller reports, not an uncaught exception.
  const server: ServerType = await new Promise((resolve, reject) => {
    const failed = (err: Error) => {
      db.close();
      reject(err);
    };
    const s = serve({ fetch, hostname: "127.0.0.1", port: options.port ?? 0 }, () => {
      s.off("error", failed); // only the start's errors: once it listens, the server is the caller's
      resolve(s);
    });
    s.once("error", failed);
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

// Run alone, for development: `node dist/server.js [--data <folder>] [--port <port>] [--dev-providers]`, as a plain
// local server.
if (process.argv[1] && /server\.(js|ts)$/.test(process.argv[1]) && !process.versions.electron) {
  const here = import.meta.dirname;
  let args;
  try {
    args = parseArgs({ options: { data: { type: "string" }, port: { type: "string", default: "8790" }, "dev-providers": { type: "boolean", default: false } } }).values;
    if (!/^\d+$/.test(args.port) || Number(args.port) > 65535) throw new Error(`--port takes a port number, not ${args.port}`);
  } catch (err) {
    console.error(`${(err as Error).message}\nUsage: node dist/server.js [--data <folder>] [--port <port>] [--dev-providers]`);
    process.exit(1);
  }
  const dataDir = args.data ?? join(process.env.HOME ?? process.env.USERPROFILE ?? ".", ".score3ly");
  startServer({
    dataDir,
    webDir: join(here, "web"),
    migrationsDir: join(here, "migrations"),
    host: "local",
    port: Number(args.port),
    devProviders: args["dev-providers"],
  }).then(
    ({ url, secretsPath }) => console.log(`score3ly at ${url}\ndata in ${dataDir}\nsecrets in ${secretsPath}`),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}
