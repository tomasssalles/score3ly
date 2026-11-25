// Makes the replay tests' fixture of the fake model (docs/overview.md §12, "Replay tests"): `npm run fixture:fake`.
// A project on one scanned page (testset/bendel_la_cascade_p4.orig.pdf) run to the end with the fake model, with the
// manual stages a real run has: the layout fixed by hand (`fix_layout`, finished as it is), and a human review that
// answers the first issue otherwise than the models did, with the `apply_review` after it. Exported through the app,
// as a user would, to fixtures/replay/fake.s3l. Its snapshots are made by the first replay: `npm run replay -- --update`.
//
// Needs Playwright's Chromium, as the screenshots do (scripts/screenshots.ts).

import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "playwright";
import { FIXTURES, launchBrowser, newProject, openProject, pipelineOf, runToEnd, type Servers, stageActions, startServers, stopAll, TEST_PDF, until } from "./appServers.ts";

const NAME = "fake";

async function addManualStage(page: Page, servers: Servers, id: string, after: string, item: string) {
  await openProject(page, servers, id);
  await stageActions(page, after).click();
  await page.getByRole("menuitem", { name: item }).click();
  const confirm = page.locator(".app-dialog .button-primary");
  if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) await confirm.click();
}

async function finishManualStage(page: Page, servers: Servers, id: string, step: string) {
  await openProject(page, servers, id);
  await page.getByRole("button", { name: "Finish" }).click({ timeout: 30_000 });
  await until(async () => (await pipelineOf(servers, id)).find((s) => s.step === step)?.status === "done", { every: 500, timeout: 30_000, what: () => `${step} didn't finish` });
}

// Waits, on the page as it is, for a run that finishing a manual stage started (Auto mode) to end: reloading the page
// while it runs (as `runToEnd` does) would interrupt it (leaving a project releases its running stage).
// Not before the third look, so that the run has had time to start.
async function settle(servers: Servers, id: string) {
  await until(async (attempt) => attempt > 2 && !(await pipelineOf(servers, id)).some((s) => s.status === "running"), {
    every: 1000,
    timeout: 600_000,
    what: () => "the run after a manual stage didn't end",
  });
}

async function main() {
  const stateDir = mkdtempSync(join(tmpdir(), "score3ly-fixture-"));
  process.on("exit", () => {
    stopAll();
    rmSync(stateDir, { recursive: true, force: true });
  });
  process.on("SIGINT", () => process.exit(130));

  console.log("Starting the Worker and Vite…");
  const servers = await startServers({ workerPort: 8885, webPort: 5271, stateDir });
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    const page = await context.newPage();

    console.log("Running the project with the fake model…");
    const id = await newProject(page, servers, TEST_PDF);
    await servers.api(`/projects/${id}`, { name: "Fake model" }, "PATCH");
    await runToEnd(page, servers, id);

    console.log("Fixing the layout by hand…");
    await addManualStage(page, servers, id, "Layout", "Fix layout manually");
    await page.locator(".editor-viewport").waitFor({ timeout: 60_000 });
    await finishManualStage(page, servers, id, "fix_layout");
    await settle(servers, id);
    await runToEnd(page, servers, id);

    console.log("A human review…");
    await addManualStage(page, servers, id, "Apply review", "Add Human review");
    // The Transcription as a form (docs/stages/music.md, "`human_review`"): the first issue's card, its second answer.
    const answers = page.locator(".transcription.editing .answer-list").first();
    await answers.waitFor({ timeout: 60_000 });
    await page.waitForTimeout(1000);
    await answers.locator(".answer-option").nth(1).click();
    await page.waitForTimeout(1500); // saved
    await finishManualStage(page, servers, id, "human_review");
    await settle(servers, id);
    await runToEnd(page, servers, id);

    const stages = await pipelineOf(servers, id);
    const failed = stages.find((s) => s.status !== "done");
    if (failed) throw new Error(`${failed.step} is ${failed.status}: ${failed.error ?? ""} (${stages.map((s) => `${s.step}:${s.status}`).join(", ")})`);
    console.log(`  ${stages.map((s) => s.step).join(", ")}`);

    console.log("Exporting it…");
    await page.goto(`${servers.app}#/projects/${id}`);
    await page.getByRole("button", { name: "Project actions" }).click();
    await page.getByRole("menuitem", { name: "Export" }).click();
    const download = page.waitForEvent("download", { timeout: 120_000 });
    await page.locator(".export-dialog .button-primary").click();
    mkdirSync(FIXTURES, { recursive: true });
    const path = join(FIXTURES, `${NAME}.s3l`);
    await (await download).saveAs(path);
    console.log(`Written: ${path}. Make its snapshots with \`npm run replay -- --update\`.`);
    await context.close();
  } catch (err) {
    const pages = browser.contexts().flatMap((c) => c.pages());
    for (const p of pages) console.log("DIALOG:", await p.locator("dialog[open]").first().innerText({ timeout: 1000 }).catch(() => "none"));
    throw err;
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
