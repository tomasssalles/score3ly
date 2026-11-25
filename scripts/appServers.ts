// What the scripts that drive the real app in a browser share (the screenshots, the replay tests and the fixtures they
// run on, docs/overview.md §12): their own Worker and Vite on ports of their own, with a database and storage in a
// folder of their own, so nothing of the usual local data is touched; the Worker's API; and a few steps through the
// app (a new project, a run to the end, an import).
//
// POSIX only (Linux, macOS): stopping what was started signals its process group (`process.kill(-pid)`), which Windows
// doesn't have.

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { chromium, type Browser, type Locator, type Page } from "playwright";
import { DATABASE, localDevConfigPath, wrangler as runWrangler, writeLocalDevConfig } from "../apps/worker/scripts/config.ts";

export const ROOT = join(import.meta.dirname, "..");
// The replay tests' fixtures (`<name>.s3l`, with their snapshots in `<name>/`).
export const FIXTURES = join(ROOT, "fixtures/replay");
// The PDF the scripts run projects on: one scanned page of the test set.
export const TEST_PDF = join(ROOT, "testset/bendel_la_cascade_p4.orig.pdf");

// Asks `check` every `every` ms until it answers something other than undefined or false, and returns that; throws
// once `timeout` ms have passed, saying `what` (called then, so it can tell how things stand). `check` is given how many
// times it was asked before.
export async function until<T>(
  check: (attempt: number) => Promise<T | undefined | false> | T | undefined | false,
  options: { every: number; timeout: number; what: () => string | Promise<string> },
): Promise<T> {
  const deadline = Date.now() + options.timeout;
  for (let attempt = 0; ; attempt++) {
    const answer = await check(attempt);
    if (answer !== undefined && answer !== false) return answer;
    if (Date.now() >= deadline) throw new Error(await options.what());
    await new Promise((r) => setTimeout(r, options.every));
  }
}

const children: ChildProcess[] = [];

export function start(command: string, args: string[], cwd: string, env: Record<string, string> = {}): void {
  // Its own process group, so that stopping it stops what it started (workerd, esbuild).
  const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, detached: true, stdio: "ignore" });
  children.push(child);
}

// Stops everything started, and returns once it is gone, with its ports free: the next fixture's servers take the same
// ports right away (review E5). A process that ignores SIGTERM for 10 s is killed. Without `await` (in an "exit"
// handler) the signals are still sent at once.
export async function stopAll(): Promise<void> {
  const stopping = children.splice(0);
  for (const child of stopping) signal(child, "SIGTERM");
  await Promise.all(
    stopping.map(async (child) => {
      if (!(await gone(child, 10_000))) {
        signal(child, "SIGKILL");
        await gone(child, 5_000);
      }
    }),
  );
}

function signal(child: ChildProcess, name: NodeJS.Signals) {
  try {
    process.kill(-child.pid!, name); // the whole process group
  } catch {
    // Gone already.
  }
}

// Whether the child's whole process group has ended within `ms`: the child itself (awaited through its exit) and what
// it started (npx → wrangler → workerd), which may outlive it for a moment and hold the ports.
async function gone(child: ChildProcess, ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  if (child.exitCode === null && child.signalCode === null) {
    const exited = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), ms);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve(true);
      });
    });
    if (!exited) return false;
  }
  while (Date.now() < deadline) {
    try {
      process.kill(-child.pid!, 0);
    } catch {
      return true; // no process left in the group
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

export function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer().once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}

function waitFor(url: string, what: string): Promise<true> {
  return until(() => fetch(url).then((r) => r.ok, () => false), { every: 500, timeout: 60_000, what: () => `${what} didn't start (${url})` });
}

// Wrangler on the local config, throwing where it fails.
function wrangler(args: string[]) {
  const result = runWrangler(args, { config: localDevConfigPath });
  if (!result.ok) throw new Error(`wrangler ${args.join(" ")}: ${result.out}`);
  return result.out;
}

export type Servers = {
  app: string; // the web app's URL, ending in "/"
  apiBase: string; // the Worker's API, without a "/" at the end
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
    // Built now, from the code as it is: whatever dist/ holds may be an older Worker with older migrations (review E11).
    const build = spawnSync("npm", ["run", "build", "-w", "apps/desktop"], { cwd: ROOT, encoding: "utf8" });
    if (build.status !== 0) throw new Error(`the desktop version's build failed: ${build.stderr || build.stdout}`);
    start("node", ["dist/server.js", "--data", stateDir, "--port", String(workerPort)], join(ROOT, "apps/desktop"));
  } else {
    writeLocalDevConfig(); // Wrangler's config for local work (apps/worker/scripts/config.ts)
    wrangler(["d1", "migrations", "apply", DATABASE, "--local", "--persist-to", stateDir]);
    start("npx", ["wrangler", "dev", "-c", localDevConfigPath, "--port", String(workerPort), "--persist-to", stateDir], join(ROOT, "apps/worker"));
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
      wrangler(["d1", "execute", DATABASE, "--local", "--persist-to", stateDir, "--command", command]);
    }
  }

  return { app, apiBase, api, sql };
}

export function launchBrowser(): Promise<Browser> {
  return chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
}

export type ApiStage = { id: string; step: string; status: string; error: string | null; config: Record<string, unknown> | null; carried: boolean };

export function pipelineOf(servers: Servers, id: string): Promise<ApiStage[]> {
  return servers.api<{ stages: ApiStage[] }>(`/projects/${id}/pipeline`).then((p) => p.stages);
}

// Each entry's turn among the entries of its step, from 1, in the order given (a pipeline's): the second
// `apply_review` is 2. Where the replay finds a recorded stage again.
export function turns<T>(entries: T[], stepOf: (entry: T) => string): number[] {
  const seen = new Map<string, number>();
  return entries.map((entry) => {
    const step = stepOf(entry);
    seen.set(step, (seen.get(step) ?? 0) + 1);
    return seen.get(step)!;
  });
}

// The "⋮" of the stage card titled `title` ("Layout", "Apply review").
export function stageActions(page: Page, title: string): Locator {
  return page.locator(".stage-card", { has: page.locator(".stage-title", { hasText: new RegExp(`^${title}$`) }) }).getByRole("button", { name: /actions/ });
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

// Runs the project in Auto mode until the last stage is done or one fails. Run is pressed once, unless a run is going
// already (in Auto mode, finishing a manual stage starts the rest by itself); never again in between, when a stage has
// ended and the next not yet started, which would start a second run.
export async function runToEnd(page: Page, servers: Servers, id: string, timeoutSeconds = 600) {
  const ended = (stages: ApiStage[]) => stages.at(-1)!.status === "done" || stages.some((s) => s.status === "failed");
  const described = async () => (await pipelineOf(servers, id)).map((s) => `${s.step} ${s.status}`).join(", ");
  await openProject(page, servers, id);
  const run = page.getByRole("button", { name: /^(Run|Retry)$/ }).first();
  await run.waitFor({ timeout: 30_000 }).catch(() => {});
  const atStart = await pipelineOf(servers, id);
  if (!atStart.some((s) => s.status === "running")) {
    if (await run.isEnabled().catch(() => false)) await run.click();
    else if (ended(atStart)) return;
    // Nothing would ever start it: said now, not after the timeout.
    else throw new Error(`project ${id} has no Run button to press and nothing running: ${await described()}`);
  }
  await until(async () => ended(await pipelineOf(servers, id)), {
    every: 1000,
    timeout: timeoutSeconds * 1000,
    what: async () => `project ${id} didn't finish: ${await described()}`,
  });
}
