// Screenshots of the app, to compare versions and themes at a glance without clicking through it (DESIGN.md §5.7,
// "Screenshots"): `npm run screenshots` (optionally `-- --out <folder>`, default `screenshots/`, which git ignores).
//
// It starts its own Worker and Vite on the test ports (8887 and 5273), with a database and storage of their own in a
// temporary folder, so nothing of the usual local data is touched; seeds them through the app with the fake model
// (a finished project, one with a manual stage in progress, one whose stage failed, and one whose page images differ
// from their stored fingerprints); then, for every theme in apps/web/src/themes.ts and three layouts (wide with the
// pipeline panel expanded, wide with it collapsed, narrow), takes a fixed list of shots: pages by their URLs, plus a
// few scripted steps for dialogs and open menus. It writes `<theme>/<layout>/<shot>.png` and `index.html`, a contact
// sheet of all of them. Everything it started is stopped and deleted at the end.
//
// Needs Playwright's Chromium: `npx playwright install chromium` once (the cloud sessions have it already).

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { THEMES } from "../apps/web/src/themes.ts";

const ROOT = join(import.meta.dirname, "..");
const WORKER_PORT = 8887;
const WEB_PORT = 5273;
const API = `http://127.0.0.1:${WORKER_PORT}/api`;
const APP = `http://127.0.0.1:${WEB_PORT}/`;
const PDF = join(ROOT, "testset/bendel_la_cascade_p4.orig.pdf"); // one page, scanned
const VECTOR_PDF = join(ROOT, "testset/debussy_clair_de_lune_mutopia.orig.pdf"); // four vector pages

const outArg = process.argv.indexOf("--out");
const OUT = outArg > 0 ? process.argv[outArg + 1] : join(ROOT, "screenshots");

const LAYOUTS = [
  { id: "wide", viewport: { width: 1440, height: 900 }, collapsed: false },
  { id: "wide-collapsed", viewport: { width: 1440, height: 900 }, collapsed: true },
  { id: "narrow", viewport: { width: 390, height: 844 }, collapsed: false },
] as const;
type Layout = (typeof LAYOUTS)[number];

// --- The servers --------------------------------------------------------------------------------------------------

const children: ChildProcess[] = [];

function start(command: string, args: string[], cwd: string, env: Record<string, string> = {}): void {
  // Its own process group, so that stopping it stops what it started (workerd, esbuild).
  const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, detached: true, stdio: "ignore" });
  children.push(child);
}

function stopAll() {
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

async function api<T = unknown>(path: string, body?: unknown, method = body === undefined ? "GET" : "POST"): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
  return (response.status === 204 ? null : await response.json()) as T;
}

type ApiStage = { id: string; step: string; status: string; error: string | null };
const pipelineOf = (id: string) => api<{ stages: ApiStage[] }>(`/projects/${id}/pipeline`).then((p) => p.stages);

// --- Seeding, through the app ---------------------------------------------------------------------------------------

// A new project on `pdf`, from the header's button ("+ New project" in the dialog when the PDF is known already).
async function newProject(page: Page, pdf: string): Promise<string> {
  await page.goto(APP);
  await page.setInputFiles('input[type="file"]', pdf);
  const known = page.locator(".dialog-new");
  await Promise.race([page.waitForURL(/#\/projects\//, { timeout: 60_000 }), known.waitFor({ timeout: 60_000 })]);
  if (await known.isVisible().catch(() => false)) await known.click();
  await page.waitForURL(/#\/projects\//, { timeout: 60_000 });
  return page.url().split("#/projects/")[1].split("/")[0];
}

// Runs the project in Auto mode until the last stage is done or one fails.
async function runToEnd(page: Page, id: string) {
  await page.goto(`${APP}#/projects/${id}`);
  await page.getByRole("button", { name: /^(Run|Retry)$/ }).first().click({ timeout: 30_000 });
  for (let i = 0; i < 600; i++) {
    const stages = await pipelineOf(id);
    if (stages.at(-1)!.status === "done" || stages.some((s) => s.status === "failed")) return;
    await page.waitForTimeout(1000);
  }
  throw new Error(`project ${id} didn't finish`);
}

type Seed = { done: string; wip: string; wipEditor: string; failed: string; differs: string; differsLayout: string; artifacts: { title: string; hash: string }[]; stageIds: { title: string; id: string }[] };

async function seed(browser: Browser, stateDir: string): Promise<Seed> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // A finished project, and its artifacts' URLs (by clicking each tile).
  const done = await newProject(page, PDF);
  await runToEnd(page, done);
  await api(`/projects/${done}`, { name: "Bendel, La Cascade" }, "PATCH");
  await page.goto(`${APP}#/projects/${done}`);
  await page.locator(".output-tile").first().waitFor();
  const artifacts: Seed["artifacts"] = [];
  for (let i = 0; i < (await page.locator(".output-tile").count()); i++) {
    const tile = page.locator(".output-tile").nth(i);
    const title = (await tile.locator(".output-title").textContent())!.trim();
    await tile.click();
    await page.waitForURL(/\/artifacts\//);
    artifacts.push({ title, hash: new URL(page.url()).hash });
  }
  const stageIds = (await pipelineOf(done)).map((s) => ({ title: s.step, id: s.id }));

  // A manual stage in progress: the layout being fixed (on the same PDF: everything else is reused).
  const wip = await newProject(page, PDF);
  await runToEnd(page, wip);
  await page.goto(`${APP}#/projects/${wip}`);
  const layoutCard = page.locator(".stage-card", { has: page.locator(".stage-title", { hasText: /^Layout$/ }) });
  await layoutCard.getByRole("button", { name: /actions/ }).click();
  await page.getByRole("menuitem", { name: "Fix layout manually" }).click();
  const confirm = page.locator(".app-dialog .button-primary");
  if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) await confirm.click();
  await page.locator(".editor-viewport").waitFor({ timeout: 60_000 });
  const wipEditor = new URL(page.url()).hash;

  // A stage that failed: the layout with a model config that fails on purpose.
  const failing = await api<{ id: string }>("/model-configs", { name: "Failing model", provider: "fake", model: "fake-error" });
  const failed = await newProject(page, PDF);
  const layout = (await pipelineOf(failed)).find((s) => s.step === "layout")!;
  await api(`/projects/${failed}/stages/${layout.id}/config`, { config: { modelConfigId: failing.id } }, "PUT");
  await runToEnd(page, failed);

  // Page images that differ from the ones stored results were made from: their fingerprints altered.
  const differs = await newProject(page, VECTOR_PDF);
  await runToEnd(page, differs);
  await page.goto(`${APP}#/projects/${differs}`);
  await page.locator(".output-tile", { hasText: "Layout" }).first().click();
  await page.waitForURL(/\/artifacts\//);
  const differsLayout = new URL(page.url()).hash;
  const sha = (await api<{ id: string; pdfSha256: string }[]>("/projects")).find((p) => p.id === differs)!.pdfSha256;
  wrangler(["d1", "execute", "score3ly", "--local", "--persist-to", stateDir, "--command", `UPDATE image_fingerprints SET height = height + 1 WHERE pdf_sha256 = '${sha}'`]);

  await context.close();
  return { done, wip, wipEditor, failed, differs, differsLayout, artifacts, stageIds };
}

function wrangler(args: string[]) {
  const result = spawnSync("npx", ["wrangler", ...args], { cwd: join(ROOT, "apps/worker"), encoding: "utf8" });
  if (result.status !== 0) throw new Error(`wrangler ${args.slice(0, 3).join(" ")} failed:\n${result.stderr}`);
}

// --- The shots ----------------------------------------------------------------------------------------------------

type Shot = { name: string; layouts?: Layout["id"][]; take: (page: Page) => Promise<void> };

// Waits for what loads after the page: images, renderings, the engraving, the MEI file.
async function settled(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page
    .waitForFunction(
      () =>
        ![...document.querySelectorAll(".page-placeholder, .mei-score-note, .pdf-status")].some((e) => /…/.test(e.textContent ?? "")),
      null,
      { timeout: 30_000 },
    )
    .catch(() => {});
  await page.waitForTimeout(400);
}

async function open(page: Page, hash: string) {
  await page.goto(`${APP}${hash}`);
  await settled(page);
}

// The narrow screen shows the panel only when no artifact is open: closing one goes back to it.
async function projectActions(page: Page, id: string) {
  await open(page, `#/projects/${id}`);
  await page.getByRole("button", { name: "Project actions" }).click();
}

function shots(seed: Seed): Shot[] {
  const project = (id: string) => `#/projects/${id}`;
  const all: Shot[] = [
    { name: "00-no-project", layouts: ["wide", "narrow"], take: (p) => open(p, "#/") },
    { name: "01-project", take: (p) => open(p, project(seed.done)) },
    ...seed.artifacts.map((a, i) => ({ name: `02-artifact-${String(i + 1).padStart(2, "0")}-${a.title.toLowerCase().replace(/\W+/g, "-")}`, take: (p: Page) => open(p, a.hash) })),
    { name: "03-stage-details", take: (p) => open(p, `${project(seed.done)}/stages/${seed.stageIds.find((s) => s.title === "layout")!.id}`) },
    { name: "04-fix-layout-editor", take: (p) => open(p, seed.wipEditor) },
    { name: "05-failed-stage", take: (p) => open(p, project(seed.failed)) },
    { name: "06-images-differ", take: (p) => open(p, seed.differsLayout) },
    { name: "07-settings", layouts: ["wide", "narrow"], take: (p) => open(p, "#/settings") },
    { name: "08-about", layouts: ["wide", "narrow"], take: (p) => open(p, "#/about") },
    { name: "09-statistics", layouts: ["wide", "narrow"], take: (p) => open(p, "#/stats") },
    // Open menus.
    { name: "10-menu-project-picker", layouts: ["wide", "narrow"], take: (p) => open(p, project(seed.done)).then(() => p.locator(".picker-field").click()).then(() => p.waitForTimeout(300)) },
    { name: "11-menu-header", layouts: ["wide", "narrow"], take: (p) => open(p, project(seed.done)).then(() => p.getByRole("button", { name: "Menu" }).click()).then(() => p.waitForTimeout(300)) },
    { name: "12-menu-project-actions", layouts: ["wide", "narrow"], take: (p) => projectActions(p, seed.done).then(() => p.waitForTimeout(300)) },
    {
      name: "13-menu-stage",
      layouts: ["wide", "narrow"],
      take: async (p) => {
        await open(p, project(seed.done));
        await p.locator(".stage-card", { has: p.locator(".stage-title", { hasText: /^Layout$/ }) }).getByRole("button", { name: /actions/ }).click();
        await p.waitForTimeout(300);
      },
    },
    // Dialogs, cancelled afterwards (each shot starts from a fresh page anyway).
    { name: "14-dialog-rename", layouts: ["wide", "narrow"], take: (p) => projectActions(p, seed.done).then(() => p.getByRole("menuitem", { name: "Rename" }).click()).then(() => p.waitForTimeout(300)) },
    {
      name: "15-dialog-delete",
      layouts: ["wide", "narrow"],
      take: async (p) => {
        await projectActions(p, seed.done);
        await p.getByRole("menuitem", { name: "Delete project" }).click();
        await p.locator(".delete-dialog input").type("Bendel");
        await p.waitForTimeout(300);
      },
    },
    {
      name: "16-dialog-config",
      layouts: ["wide", "narrow"],
      take: async (p) => {
        await open(p, project(seed.done));
        await p.locator(".stage-card", { has: p.locator(".stage-title", { hasText: /^Rasterize$/ }) }).getByRole("button", { name: /actions/ }).click();
        await p.getByRole("menuitem", { name: "Change config" }).click();
        await p.waitForTimeout(300);
      },
    },
    {
      name: "17-dialog-confirm",
      layouts: ["wide", "narrow"],
      take: async (p) => {
        await open(p, project(seed.done));
        await p.locator(".stage-card", { has: p.locator(".stage-title", { hasText: /^Rasterize$/ }) }).getByRole("button", { name: /actions/ }).click();
        await p.getByRole("menuitem", { name: "Change config" }).click();
        const dpi = p.locator(".app-dialog input").last();
        await dpi.fill("250");
        await p.locator(".app-dialog .button-primary").click();
        await p.getByText("Are you sure?").waitFor();
        await p.waitForTimeout(300);
      },
    },
    {
      name: "18-dialog-known-pdf",
      layouts: ["wide", "narrow"],
      take: async (p) => {
        await open(p, "#/");
        await p.setInputFiles('input[type="file"]', PDF);
        await p.locator(".dialog-new").waitFor();
        await p.waitForTimeout(300);
      },
    },
  ];
  return all;
}

async function contextFor(browser: Browser, theme: (typeof THEMES)[number], layout: Layout): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: layout.viewport, colorScheme: theme.dark ? "dark" : "light", deviceScaleFactor: 1 });
  await context.addInitScript(
    ({ theme, collapsed }) => {
      localStorage.setItem("score3ly.theme", theme);
      localStorage.setItem("pipelinePanelCollapsed", collapsed ? "1" : "0");
    },
    { theme: theme.id, collapsed: layout.collapsed },
  );
  return context;
}

function contactSheet(names: string[], columns: { theme: string; layout: string }[], taken: Set<string>): string {
  const cell = (path: string) => (taken.has(path) ? `<a href="${path}"><img loading="lazy" src="${path}"></a>` : "");
  return `<!doctype html><html><head><meta charset="utf-8"><title>score3ly screenshots</title><style>
body{font:13px system-ui,sans-serif;margin:16px;background:#888;color:#000}
table{border-collapse:collapse}td,th{padding:6px;vertical-align:top;text-align:left}
img{max-width:360px;max-height:300px;border:1px solid #444;display:block}
</style></head><body><h1>score3ly screenshots</h1><p>${new Date().toISOString()}</p><table>
<tr><th></th>${columns.map((c) => `<th>${c.theme} · ${c.layout}</th>`).join("")}</tr>
${names.map((n) => `<tr><th>${n}</th>${columns.map((c) => `<td>${cell(`${c.theme}/${c.layout}/${n}.png`)}</td>`).join("")}</tr>`).join("\n")}
</table></body></html>
`;
}

// --- Main ---------------------------------------------------------------------------------------------------------

async function main() {
  for (const port of [WORKER_PORT, WEB_PORT]) {
    if (!(await portFree(port))) throw new Error(`port ${port} is taken: is another screenshot run going?`);
  }
  const stateDir = mkdtempSync(join(tmpdir(), "score3ly-screenshots-"));
  process.on("exit", () => {
    stopAll();
    rmSync(stateDir, { recursive: true, force: true });
  });
  process.on("SIGINT", () => process.exit(130));

  console.log("Starting the Worker and Vite…");
  mkdirSync(join(ROOT, "apps/web/dist"), { recursive: true });
  wrangler(["d1", "migrations", "apply", "score3ly", "--local", "--persist-to", stateDir]);
  start("npx", ["wrangler", "dev", "--port", String(WORKER_PORT), "--persist-to", stateDir], join(ROOT, "apps/worker"));
  start("npx", ["vite", "--host", "127.0.0.1", "--port", String(WEB_PORT), "--strictPort"], join(ROOT, "apps/web"), {
    SCORE3LY_API_URL: `http://127.0.0.1:${WORKER_PORT}`,
  });
  await waitFor(`${API}/health`, "The Worker");
  await waitFor(APP, "Vite");

  const browser = await chromium.launch();
  try {
    console.log("Seeding the projects (the fake model runs them)…");
    const seeded = await seed(browser, stateDir);
    const list = shots(seeded);
    rmSync(OUT, { recursive: true, force: true });
    const taken = new Set<string>();
    const columns: { theme: string; layout: string }[] = [];
    for (const theme of THEMES) {
      for (const layout of LAYOUTS) {
        columns.push({ theme: theme.id, layout: layout.id });
        mkdirSync(join(OUT, theme.id, layout.id), { recursive: true });
        for (const shot of list.filter((s) => !s.layouts || s.layouts.includes(layout.id))) {
          // A fresh context for every shot: nothing cached, nothing left open by the shot before.
          const context = await contextFor(browser, theme, layout);
          const page = await context.newPage();
          const path = `${theme.id}/${layout.id}/${shot.name}.png`;
          try {
            await shot.take(page);
            await page.screenshot({ path: join(OUT, path) });
            taken.add(path);
          } catch (err) {
            console.warn(`  ${path}: ${err instanceof Error ? err.message.split("\n")[0] : err}`);
          } finally {
            await context.close();
          }
        }
        console.log(`  ${theme.id} · ${layout.id}`);
      }
    }
    writeFileSync(join(OUT, "index.html"), contactSheet([...new Set(list.map((s) => s.name))], columns, taken));
    console.log(`${taken.size} screenshots in ${relative(process.cwd(), OUT) || "."}; open index.html for all of them.`);
  } finally {
    await browser.close();
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
