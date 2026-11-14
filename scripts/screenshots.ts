// Screenshots of the app, to compare versions and themes at a glance without clicking through it (docs/overview.md §5.7,
// "Screenshots"): `npm run screenshots` (optionally `-- --out <folder>`, default `screenshots/`, which git ignores, and
// `--only <text>` for the shots whose names contain it, `--desktop` for the desktop version's server).
//
// It starts its own Worker and Vite on the test ports (8887 and 5273), with a database and storage of their own in a
// temporary folder, so nothing of the usual local data is touched; seeds them through the app with the fake model
// (a finished project, one with the card of a dropped stage, one with a manual stage in progress, one with a human review in
// progress, one whose stage failed, and one whose page images differ
// from their stored fingerprints); then, for every theme in apps/web/src/themes.ts and three layouts (wide with the
// pipeline panel expanded, wide with it collapsed, narrow), takes a fixed list of shots: pages by their URLs, plus a
// few scripted steps for dialogs and open menus. It writes `<theme>/<layout>/<shot>.png` and `index.html`, a contact
// sheet of all of them. Everything it started is stopped and deleted at the end.
//
// Needs Playwright's Chromium: `npx playwright install chromium` once; or another Chromium, by its path in `CHROMIUM_PATH`
// (the cloud sessions have one at /opt/pw-browsers/chromium).

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import type { Browser, BrowserContext, Locator, Page } from "playwright";
import { THEMES } from "../apps/web/src/themes.ts";
import { type ApiStage, launchBrowser, newProject as newProjectIn, pipelineOf as pipelineIn, ROOT, runToEnd as runToEndIn, type Servers, startServers, stopAll } from "./appServers.ts";

const WORKER_PORT = 8887;
const WEB_PORT = 5273;
let APP = "";
let servers: Servers;
const api = <T = unknown>(path: string, body?: unknown, method?: string) => servers.api<T>(path, body, method);
const PDF = join(ROOT, "testset/bendel_la_cascade_p4.orig.pdf"); // one page, scanned
const VECTOR_PDF = join(ROOT, "testset/debussy_clair_de_lune_mutopia.orig.pdf"); // four vector pages
const outArg = process.argv.indexOf("--out");
const OUT = outArg > 0 ? process.argv[outArg + 1] : join(ROOT, "screenshots");
// `--only <text>`: only the shots whose names contain it, or one of its parts separated by "|" (the seeding still
// takes its time).
const onlyArg = process.argv.indexOf("--only");
const ONLY = onlyArg > 0 ? process.argv[onlyArg + 1] : null;
// `--desktop`: the desktop version's server (apps/desktop, built first) instead of Wrangler: the same app on Node,
// with SQLite and a folder of files; so the seeding also tests it end to end.
const DESKTOP = process.argv.includes("--desktop");

const LAYOUTS = [
  { id: "wide", viewport: { width: 1440, height: 900 }, collapsed: false },
  { id: "wide-collapsed", viewport: { width: 1440, height: 900 }, collapsed: true },
  { id: "narrow", viewport: { width: 390, height: 844 }, collapsed: false },
] as const;
type Layout = (typeof LAYOUTS)[number];

// --- The servers --------------------------------------------------------------------------------------------------

const pipelineOf = (id: string): Promise<ApiStage[]> => pipelineIn(servers, id);
const newProject = (page: Page, pdf: string) => newProjectIn(page, servers, pdf);
const runToEnd = (page: Page, id: string) => runToEndIn(page, servers, id);

// --- Seeding, through the app ---------------------------------------------------------------------------------------

type Seed = {
  done: string;
  dropped: string;
  wip: string;
  wipEditor: string;
  humanReview: string; // the screen of a human review in progress
  failed: string;
  failedStage: string; // its failed stage, the layout
  differs: string;
  differsLayout: string;
  artifacts: { title: string; hash: string }[];
  stageIds: { title: string; id: string }[];
};

async function seed(browser: Browser): Promise<Seed> {
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

  // The card of a manual stage dropped because its inputs changed: written straight into the database (a fix_layout
  // after the layout), as a re-run would leave it.
  const dropped = await newProject(page, PDF);
  await runToEnd(page, dropped);
  const droppedAfter = (await pipelineOf(dropped)).find((s) => s.step === "layout")!.id;
  servers.sql(
    `INSERT INTO dropped_stages (project_id, after_stage_id, stage_id, step, dropped_at) VALUES ('${dropped}', '${droppedAfter}', '${droppedAfter}', 'fix_layout', '2026-10-24T00:00:00.000Z')`,
  );

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

  // A human review in progress (on the same PDF: everything before it is reused): an answer chosen on the first issue, and
  // a clarification without its text yet, so its panel shows what keeps the stage from being finished.
  const human = await newProject(page, PDF);
  await runToEnd(page, human);
  await page.goto(`${APP}#/projects/${human}`);
  await page.locator(".stage-card", { has: page.locator(".stage-title", { hasText: /^Apply review$/ }) }).getByRole("button", { name: /actions/ }).click();
  await page.getByRole("menuitem", { name: "Add Human review" }).click();
  if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) await confirm.click();
  await page.locator(".human-review .editor-content img").waitFor({ timeout: 60_000 });
  const humanReview = new URL(page.url()).hash;
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Next annotation" }).click();
  await page.locator(".answer-list .answer-option").nth(1).click();
  await page.getByRole("button", { name: "Hide the issue" }).click();
  await page.getByRole("radio", { name: "Add clarification" }).click();
  await page.getByText("to add a clarification about it").waitFor();
  await page.getByRole("button", { name: "Fit width" }).click();
  await page.waitForTimeout(500);
  const viewport = (await page.locator(".human-review .editor-viewport").boundingBox())!;
  await page.mouse.click(viewport.x + viewport.width * 0.55, viewport.y + viewport.height * 0.3);
  await page.waitForTimeout(300);
  await page.mouse.click(viewport.x + viewport.width * 0.62, viewport.y + viewport.height * 0.36);
  await page.locator(".issue-panel", { hasText: "[clarification]" }).waitFor();
  await page.waitForTimeout(1500); // saved

  // A stage that failed: the layout with a model config that fails on purpose.
  const failing = await api<{ id: string }>("/model-configs", { name: "Failing model", provider: "fake", modelString: "fake-error", family: "fake", pricing: { kind: "free" } });
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
  servers.sql(`UPDATE image_fingerprints SET height = height + 1 WHERE pdf_sha256 = '${sha}'`);

  await context.close();
  return { done, dropped, wip, wipEditor, humanReview, failed, failedStage: layout.id, differs, differsLayout, artifacts, stageIds };
}

// --- The shots ----------------------------------------------------------------------------------------------------

// `installed`: as an installed app, without a browser bar (the app shows its own back and forward buttons).
type Shot = { name: string; layouts?: Layout["id"][]; installed?: boolean; take: (page: Page) => Promise<void> };

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

// A few model configs of other providers, for the settings' list of configs and its filter (made once: the same
// values again are refused). Their secrets' names needn't exist: nothing is sent.
async function withConfigs(page: Page) {
  await page.goto(`${APP}#/`);
  await page.evaluate(async () => {
    const make = (body: object) => fetch("/api/model-configs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    await make({ provider: "anthropic", modelId: "claude-opus-5-5", effort: "high", secrets: { apiKey: "ANTHROPIC_KEY" }, pricing: { kind: "list" } });
    await make({ provider: "anthropic", modelId: "claude-opus-5-5", effort: "low", secrets: { apiKey: "ANTHROPIC_KEY" }, pricing: { kind: "list" } });
    await make({ name: "Opus in the EU", provider: "bedrock", modelId: "claude-opus-5-5", region: "eu-central-1", routing: "geographic", secrets: { apiKey: "BEDROCK_KEY" }, pricing: { kind: "list" } });
  });
}

async function open(page: Page, hash: string) {
  await page.goto(`${APP}${hash}`);
  await settled(page);
}

// What scrolls sideways that shouldn't (docs/style.md, "Shape, space and depth"): the page itself, and every element
// that can scroll and is wider inside than out, except content that is wide by nature (code, a page or engraving).
async function sideways(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const wideByNature = "pre, code, .mei-code, .page-scroll, .viewer, canvas, svg, img";
    const name = (el: Element) => el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? `.${el.className.trim().split(/\s+/).join(".")}` : "");
    const found: string[] = [];
    for (const el of [document.documentElement, ...document.querySelectorAll("body *")]) {
      const overflowX = getComputedStyle(el).overflowX;
      const scrolls = el === document.documentElement || overflowX === "auto" || overflowX === "scroll";
      if (!scrolls || el.scrollWidth <= el.clientWidth + 1) continue;
      if (el !== document.documentElement && el.matches(wideByNature)) continue;
      found.push(name(el));
    }
    return found;
  });
}

// A click in the middle of an element (an SVG shape the page editors draw), where a person would tap it.
async function clickCentre(page: Page, locator: Locator): Promise<void> {
  const box = (await locator.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
}

// The narrow screen shows the panel only when no artifact is open: closing one goes back to it.
async function projectActions(page: Page, id: string) {
  await open(page, `#/projects/${id}`);
  await page.getByRole("button", { name: "Project actions" }).click();
}

// The human review in one of its views, with an annotation's panel open: the first whose head has `head` ("[unclear]",
// "[clarification]"), found with the annotation arrows; or none.
const VIEW_LABELS = { both: "Show both", original: "Original only", transcription: "Transcription only" };
async function humanReviewPanel(page: Page, hash: string, view: keyof typeof VIEW_LABELS, head: string | null) {
  await open(page, hash);
  if (view !== "both") {
    await page.getByRole("button", { name: "What to show" }).click();
    await page.getByRole("menuitem", { name: VIEW_LABELS[view] }).click();
  }
  if (head) {
    for (let i = 0; i < 20 && !(await page.locator(".issue-panel", { hasText: head }).isVisible()); i++) {
      await page.getByRole("button", { name: "Next annotation" }).click();
    }
  }
  await settled(page);
}

function shots(seed: Seed): Shot[] {
  const project = (id: string) => `#/projects/${id}`;
  const all: Shot[] = [
    { name: "00-home", layouts: ["wide", "narrow"], take: (p) => open(p, "#/") },
    // An instance with no projects yet: the list answered empty.
    {
      name: "00-home-empty",
      layouts: ["wide", "narrow"],
      take: async (p) => {
        await p.route("**/api/projects", (route) => (route.request().method() === "GET" ? route.fulfill({ json: [] }) : route.fallback()));
        await open(p, "#/");
      },
    },
    { name: "01-project", take: (p) => open(p, project(seed.done)) },
    ...seed.artifacts.map((a, i) => ({ name: `02-artifact-${String(i + 1).padStart(2, "0")}-${a.title.toLowerCase().replace(/\W+/g, "-")}`, take: (p: Page) => open(p, a.hash) })),
    { name: "03-stage-details", take: (p) => open(p, `${project(seed.done)}/stages/${seed.stageIds.find((s) => s.title === "layout")!.id}`) },
    { name: "04-fix-layout-editor", take: (p) => open(p, seed.wipEditor) },
    // A box selected (its handles), and a bar line selected with one tap (its handle).
    { name: "04b-fix-layout-box-selected", layouts: ["wide", "narrow"], take: (p) => open(p, seed.wipEditor).then(() => clickCentre(p, p.locator(".layout-label").nth(1))) },
    { name: "04d-fix-layout-hidden", layouts: ["wide", "narrow"], take: (p) => open(p, seed.wipEditor).then(() => p.locator(".layout-box").first().waitFor()).then(() => p.getByRole("button", { name: "Hide the boxes and bar lines" }).click()).then(() => p.waitForTimeout(300)) },
    { name: "04c-fix-layout-bar-selected", layouts: ["wide", "narrow"], take: (p) => open(p, seed.wipEditor).then(() => clickCentre(p, p.locator(".layout-bar").nth(5))) },
    { name: "05-failed-stage", take: (p) => open(p, project(seed.failed)) },
    { name: "05b-failed-stage-details", take: (p) => open(p, `${project(seed.failed)}/stages/${seed.failedStage}`) },
    { name: "06-images-differ", take: (p) => open(p, seed.differsLayout) },
    { name: "06b-dropped-stage", layouts: ["wide", "narrow"], take: (p) => open(p, project(seed.dropped)).then(() => p.locator(".stage-card.dropped").evaluate((el) => el.scrollIntoView({ block: "center" }))) },
    { name: "07-settings", layouts: ["wide", "narrow"], take: (p) => open(p, "#/settings") },
    { name: "07b-settings-configs", layouts: ["wide", "narrow"], take: (p) => withConfigs(p).then(() => open(p, "#/settings/configs")) },
    {
      name: "07c-settings-configs-filter",
      layouts: ["wide", "narrow"],
      take: async (p) => {
        await withConfigs(p);
        await open(p, "#/settings/configs");
        await p.getByRole("button", { name: "Filters" }).click();
        await p.getByRole("checkbox", { name: "Fake", exact: true }).click();
        await p.waitForTimeout(300);
      },
    },
    { name: "08-about", layouts: ["wide", "narrow"], take: (p) => open(p, "#/about") },
    { name: "09-statistics", layouts: ["wide", "narrow"], take: (p) => open(p, "#/stats") },
    // Open menus.
    { name: "10-menu-project-picker", layouts: ["wide", "narrow"], take: (p) => open(p, project(seed.done)).then(() => p.locator(".picker-field").click()).then(() => p.waitForTimeout(300)) },
    { name: "11-menu-header", layouts: ["wide", "narrow"], take: (p) => open(p, project(seed.done)).then(() => p.getByRole("button", { name: "Menu" }).click()).then(() => p.waitForTimeout(300)) },
    { name: "12-menu-project-actions", layouts: ["wide", "narrow"], take: (p) => projectActions(p, seed.done).then(() => p.waitForTimeout(300)) },
    { name: "12b-export-dialog", layouts: ["wide", "narrow"], take: (p) => projectActions(p, seed.done).then(() => p.getByRole("menuitem", { name: "Export" }).click()).then(() => p.waitForTimeout(300)) },
    {
      name: "13-menu-stage",
      layouts: ["wide", "narrow"],
      take: async (p) => {
        await open(p, project(seed.done));
        await p.locator(".stage-card", { has: p.locator(".stage-title", { hasText: /^Layout$/ }) }).getByRole("button", { name: /actions/ }).click();
        await p.waitForTimeout(300);
      },
    },
    {
      name: "13b-menu-apply-review",
      layouts: ["wide", "narrow"],
      take: async (p) => {
        await open(p, project(seed.done));
        await p.locator(".stage-card", { has: p.locator(".stage-title", { hasText: /^Apply review$/ }) }).getByRole("button", { name: /actions/ }).click();
        await p.waitForTimeout(300);
      },
    },
    // A human review in progress (docs/stages/music.md, `human_review`): its screen, an issue's panel, the clarification's
    // panel with what keeps it from being finished, the confirmation before deleting it, and the two single views.
    { name: "20-human-review", take: (p) => open(p, seed.humanReview) },
    // An issue's and the clarification's panels, in each of the three views.
    ...(["both", "original", "transcription"] as const).flatMap((view) => [
      { name: `21-human-review-issue-${view}`, take: (p: Page) => humanReviewPanel(p, seed.humanReview, view, "[unclear]") },
      { name: `22-human-review-clarification-${view}`, take: (p: Page) => humanReviewPanel(p, seed.humanReview, view, "[clarification]") },
    ]),
    {
      name: "23-dialog-delete-clarification",
      layouts: ["wide", "narrow"],
      take: async (p) => {
        await humanReviewPanel(p, seed.humanReview, "both", "[clarification]");
        await p.getByRole("button", { name: "Delete clarification" }).click();
        await p.waitForTimeout(300);
      },
    },
    { name: "24-human-review-original-only", layouts: ["wide", "narrow"], take: (p) => humanReviewPanel(p, seed.humanReview, "original", null) },
    { name: "25-human-review-transcription-only", layouts: ["wide", "narrow"], take: (p) => humanReviewPanel(p, seed.humanReview, "transcription", null) },
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
      // Back and forward in an installed app: the project opened from the start page, so back can go there.
      name: "19-installed-app",
      installed: true,
      take: async (p) => {
        await open(p, "#/");
        await p.evaluate((hash) => (window.location.hash = hash), project(seed.done));
        await settled(p);
      },
    },
    {
      // A test that failed with a long error. Test is offered only for real providers: the failing fake config is
      // listed as Anthropic's, and the test's answer is made up here.
      name: "26-dialog-test-failed",
      layouts: ["wide", "narrow"],
      take: async (p) => {
        await p.route("**/api/model-configs", async (route) => {
          if (route.request().method() !== "GET") return route.continue();
          const response = await route.fetch();
          const configs = (await response.json()) as { name: string; provider: string }[];
          await route.fulfill({ response, json: configs.map((c) => (c.name === "Failing model" ? { ...c, provider: "anthropic" } : c)) });
        });
        const error = `400 ${JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "output_config.format.schema: the_compiled_grammar_is_too_large_for_the_provider_to_accept_it" } })}`;
        await p.route("**/api/model-configs/*/test", (route) => route.fulfill({ json: { status: "error", error, costUsd: null, durationMs: 1234 } }));
        await open(p, "#/settings");
        await p.getByRole("button", { name: "Failing model: actions" }).click();
        await p.getByRole("menuitem", { name: "Test" }).click();
        await p.getByRole("button", { name: "Send request" }).click();
        await p.locator(".test-result.failed").waitFor();
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

async function contextFor(browser: Browser, theme: (typeof THEMES)[number], layout: Layout, installed = false): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: layout.viewport, colorScheme: theme.dark ? "dark" : "light", deviceScaleFactor: 1 });
  await context.addInitScript(
    ({ theme, collapsed }) => {
      localStorage.setItem("score3ly.theme", theme);
      localStorage.setItem("pipelinePanelCollapsed", collapsed ? "1" : "0");
    },
    { theme: theme.id, collapsed: layout.collapsed },
  );
  // Chromium can't be told it is an installed app (the display mode isn't among the media features it emulates), so
  // the app's question is answered here.
  if (installed) {
    await context.addInitScript(() => {
      const matchMedia = window.matchMedia.bind(window);
      window.matchMedia = (query: string) =>
        query.includes("display-mode: standalone") ? ({ ...matchMedia(query), matches: true, media: query, addEventListener() {}, removeEventListener() {} } as MediaQueryList) : matchMedia(query);
    });
  }
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
  const stateDir = mkdtempSync(join(tmpdir(), "score3ly-screenshots-"));
  process.on("exit", () => {
    stopAll();
    rmSync(stateDir, { recursive: true, force: true });
  });
  process.on("SIGINT", () => process.exit(130));

  console.log("Starting the Worker and Vite…");
  servers = await startServers({ workerPort: WORKER_PORT, webPort: WEB_PORT, stateDir, desktop: DESKTOP });
  APP = servers.app;

  const browser = await launchBrowser();
  try {
    console.log("Seeding the projects (the fake model runs them)…");
    const seeded = await seed(browser);
    const list = shots(seeded).filter((s) => !ONLY || ONLY.split("|").some((part) => s.name.includes(part)));
    rmSync(OUT, { recursive: true, force: true });
    const taken = new Set<string>();
    const columns: { theme: string; layout: string }[] = [];
    for (const theme of THEMES) {
      for (const layout of LAYOUTS) {
        columns.push({ theme: theme.id, layout: layout.id });
        mkdirSync(join(OUT, theme.id, layout.id), { recursive: true });
        for (const shot of list.filter((s) => !s.layouts || s.layouts.includes(layout.id))) {
          // A fresh context for every shot: nothing cached, nothing left open by the shot before.
          const context = await contextFor(browser, theme, layout, shot.installed);
          const page = await context.newPage();
          const path = `${theme.id}/${layout.id}/${shot.name}.png`;
          try {
            await shot.take(page);
            await page.screenshot({ path: join(OUT, path) });
            taken.add(path);
            for (const where of await sideways(page)) console.warn(`  ${path}: scrolls sideways: ${where}`);
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
