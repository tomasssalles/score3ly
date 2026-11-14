// What the scripts that drive the real app in a browser share (the screenshots, the replay tests and the fixtures they
// run on, docs/overview.md §12): their own Worker and Vite on ports of their own, with a database and storage in a
// folder of their own, so nothing of the usual local data is touched; the Worker's API; and a few steps through the
// app (a new project, a run to the end, an import).

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { chromium, type Browser, type Page } from "playwright";
import { writeLocalDevConfig } from "../apps/worker/scripts/config.ts";

export const ROOT = join(import.meta.dirname, "..");

const children: ChildProcess[] = [];

function start(command: string, args: string[], cwd: string, env: Record<string, string> = {}): void {
  // Its own process group, so that stopping it stops what it started (workerd, esbuild).
  const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, detached: true, stdio: "ignore" });
  children.push(child);
}

export function stopAll() {
  for (const child of children) {
    try {
      process.kill(-child.pid!, "SIGTERM");
    } catch {
      // Gone already.
    }
  }
}

function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer().once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}

async function waitFor(url: string, what: string) {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Not yet.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${what} didn't start (${url})`);
}

function wrangler(args: string[]) {
  const result = spawnSync("npx", ["wrangler", ...args], { cwd: join(ROOT, "apps/worker"), encoding: "utf8" });
  if (result.status !== 0) throw new Error(`wrangler ${args.join(" ")}: ${result.stderr || result.stdout}`);
  return result.stdout;
}

export type Servers = {
  app: string; // the web app's URL, ending in "/"
  api: <T = unknown>(path: string, body?: unknown, method?: string) => Promise<T>;
  // Runs SQL on the servers' database: Wrangler's local D1, or the desktop server's SQLite file.
  sql: (command: string) => void;
};

// Starts the Worker (Wrangler's, or the desktop version's server with `desktop`) and Vite on the ports given, with their
// state in `stateDir`, and waits until both answer. Everything started is stopped by `stopAll`.
export async function startServers(options: { workerPort: number; webPort: number; stateDir: string; desktop?: boolean }): Promise<Servers> {
  const { workerPort, webPort, stateDir, desktop } = options;
  for (const port of [workerPort, webPort]) {
    if (!(await portFree(port))) throw new Error(`port ${port} is taken: is another run going?`);
  }
  mkdirSync(join(ROOT, "apps/web/dist"), { recursive: true });
  if (desktop) {
    start("node", ["dist/server.js", "--data", stateDir, "--port", String(workerPort)], join(ROOT, "apps/desktop"));
  } else {
    writeLocalDevConfig(); // Wrangler's config for local work (apps/worker/scripts/config.ts)
    wrangler(["d1", "migrations", "apply", "score3ly", "--local", "-c", "wrangler.local-dev.jsonc", "--persist-to", stateDir]);
    start("npx", ["wrangler", "dev", "-c", "wrangler.local-dev.jsonc", "--port", String(workerPort), "--persist-to", stateDir], join(ROOT, "apps/worker"));
  }
  start("npx", ["vite", "--host", "127.0.0.1", "--port", String(webPort), "--strictPort"], join(ROOT, "apps/web"), {
    SCORE3LY_API_URL: `http://127.0.0.1:${workerPort}`,
  });
  const apiBase = `http://127.0.0.1:${workerPort}/api`;
  const app = `http://127.0.0.1:${webPort}/`;
  await waitFor(`${apiBase}/health`, "The Worker");
  await waitFor(app, "Vite");

  async function api<T = unknown>(path: string, body?: unknown, method = body === undefined ? "GET" : "POST"): Promise<T> {
    const response = await fetch(`${apiBase}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
    return (response.status === 204 ? null : await response.json()) as T;
  }

  function sql(command: string) {
    if (desktop) {
      // The desktop server's database (apps/desktop/src/server.ts), opened only for this statement.
      const db = new DatabaseSync(join(stateDir, "score3ly.sqlite"));
      try {
        db.exec(command);
      } finally {
        db.close();
      }
    } else {
      wrangler(["d1", "execute", "score3ly", "--local", "-c", "wrangler.local-dev.jsonc", "--persist-to", stateDir, "--command", command]);
    }
  }

  return { app, api, sql };
}

export function launchBrowser(): Promise<Browser> {
  return chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
}

export type ApiStage = { id: string; step: string; status: string; error: string | null; config: Record<string, unknown> | null };

export function pipelineOf(servers: Servers, id: string): Promise<ApiStage[]> {
  return servers.api<{ stages: ApiStage[] }>(`/projects/${id}/pipeline`).then((p) => p.stages);
}

// A new project on `pdf`, or one imported from a project file (`.s3l`), from the header's button ("+ New project" or
// "→ Import as a new project" in the dialog when the PDF is known already). Its id.
export async function newProject(page: Page, servers: Servers, file: string): Promise<string> {
  await page.goto(servers.app);
  await page.setInputFiles('input[type="file"]', file);
  const known = page.locator(".dialog-new");
  await Promise.race([page.waitForURL(/#\/projects\//, { timeout: 120_000 }), known.waitFor({ timeout: 120_000 })]);
  if (await known.isVisible().catch(() => false)) await known.click();
  await page.waitForURL(/#\/projects\//, { timeout: 120_000 });
  return page.url().split("#/projects/")[1].split("/")[0];
}

// The project's page loaded afresh: one left open while the project changed elsewhere (a run, the API) holds an older
// version of it, shows an older pipeline, and its changes would be refused (optimistic locking).
export async function openProject(page: Page, servers: Servers, id: string) {
  await page.goto(`${servers.app}#/projects/${id}`);
  await page.reload();
}

// Runs the project in Auto mode until the last stage is done or one fails. Run is pressed only when nothing runs: in
// Auto mode, finishing a manual stage starts the rest by itself.
export async function runToEnd(page: Page, servers: Servers, id: string, timeoutSeconds = 600) {
  await openProject(page, servers, id);
  for (let i = 0; i < timeoutSeconds; i++) {
    const stages = await pipelineOf(servers, id);
    if (stages.at(-1)!.status === "done" || stages.some((s) => s.status === "failed")) return;
    const run = page.getByRole("button", { name: /^(Run|Retry)$/ }).first();
    if (!stages.some((s) => s.status === "running") && (await run.isEnabled().catch(() => false))) await run.click();
    await page.waitForTimeout(1000);
  }
  const stages = await pipelineOf(servers, id);
  throw new Error(`project ${id} didn't finish: ${stages.map((s) => `${s.step} ${s.status}`).join(", ")}`);
}
