// The replay tests (docs/overview.md §12, "Replay tests"): `npm run replay` (`-- --update` to accept what changed,
// `--only <name>` for one fixture). For each fixture in fixtures/replay (`<name>.s3l`, a project exported from the app):
// a Worker and Vite of their own on an empty database, through the app in a real browser (Playwright):
// 1. the project file imported, as a user would;
// 2. the replay model (`fake-replay`, apps/worker/src/llm/replay.ts) given to `layout` and every LLM stage after it,
//    which replaces them all, so every stage from `layout` on runs again; the manual stages after it are carried;
// 3. the stages run one by one, in Manual mode, each started with Run and followed through the API; before each stage
//    that numbers issues, the project's counter set to the number its recorded stage started from (issue numbers come
//    from a project counter that never goes back, docs/notation.md, "Issue ids", and the recorded answers name the
//    original numbers): worked out from the fixture, the smallest number that first appears in the stage's outputs. A
//    stage that lost numbers within itself (reserved, then a failure and a retry) can't be replayed so, and fails,
//    naming the issue;
// 4. every Transcription opened, which works out who chose and applied each answer along the chain of stages
//    (apps/web/src/attribution.ts), and fails on any entry given to a stage of another step than its stored one;
// 5. the result compared with the fixture's snapshots in fixtures/replay/<name>/: `requests/`, every request the
//    replay was asked (the prompts, the schemas, the images by their recipe keys), and `outputs/`, every output of the
//    pipeline (its stored content, or its recipe). A change made on purpose is accepted with `--update`, and the diff
//    of the snapshots shows what it did.
// The replay answers each call with the answer recorded at its place (stage, item, round), so the prompts can change
// without making the recordings stale; a place without a recording fails its stage.
//
// Needs Playwright's Chromium, as the screenshots do (scripts/screenshots.ts). About a minute per fixture.

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { unzipSync } from "fflate";
import type { Page } from "playwright";
import { REPLAY_MODEL } from "@score3ly/core";
import { scriptArgs } from "./cli.ts";
import { FIXTURES, launchBrowser, newProject, openProject, pipelineOf, ROOT, type Servers, startServers, stopAll, turns, until } from "./appServers.ts";

const args = scriptArgs(
  // `--update` accepts what changed as the new snapshots; `--only <name>` replays one fixture.
  { options: { update: { type: "boolean", default: false }, only: { type: "string" } } },
  "Usage: npm run replay [-- [--update] [--only <fixture>]]",
);
const UPDATE = args.values.update;
const ONLY = args.values.only ?? null;

type Row = Record<string, unknown>;
type Export = { pipeline: Row[]; stages: Row[]; outputs: Row[]; llm_calls: Row[] };

// Every file of a snapshot, by its path in the fixture's folder.
type Snapshot = Map<string, string>;

async function content(servers: Servers, sha256: string): Promise<Uint8Array> {
  const response = await fetch(`${servers.apiBase}/content/${sha256}`);
  if (!response.ok) throw new Error(`content ${sha256}: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

// JSON as it is stored, indented for readable diffs; text as it is; anything else by its hash.
function readable(bytes: Uint8Array, sha256: string): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return `(binary, ${bytes.length} bytes, sha256 ${sha256})\n`;
  }
  try {
    return `${JSON.stringify(JSON.parse(text), null, 2)}\n`;
  } catch {
    return text.endsWith("\n") ? text : `${text}\n`;
  }
}

// A file name for a place: the stage's step and its turn among the pipeline's stages of that step, the item.
function placeName(step: string, turn: number, item: string): string {
  return `${step}-${turn}-${item === "" ? "all" : item.replaceAll("/", "-")}`;
}

async function snapshotOf(servers: Servers, data: Export, replayConfigId: string): Promise<Snapshot> {
  const files: Snapshot = new Map();
  const { stepOf, turnOf } = pipelineTurns(data);
  const where = (stageId: string) => ({ step: stepOf(stageId), turn: turnOf.get(stageId)! });

  for (const call of data.llm_calls) {
    if (call.model_config_id !== replayConfigId || !call.stage_id || !turnOf.has(call.stage_id as string)) continue;
    const { step, turn } = where(call.stage_id as string);
    const request = JSON.parse(new TextDecoder().decode(await content(servers, call.request_sha256 as string))) as { messages: { content: Row[] }[] };
    // Images by their recipe keys only: the bytes of an image made again may differ (docs/images.md §8.3).
    for (const m of request.messages) for (const c of m.content) if (c.type === "image") delete c.sha256;
    files.set(`requests/${placeName(step, turn, call.item as string)}-round${call.round}.json`, `${JSON.stringify(request, null, 2)}\n`);
  }
  for (const output of data.outputs) {
    if (!turnOf.has(output.stage_id as string)) continue;
    const { step, turn } = where(output.stage_id as string);
    const name = `outputs/${placeName(step, turn, output.item as string)}-${output.type}`;
    if (output.content_sha256) {
      // The PDF is the fixture itself.
      if (step === "ingest") files.set(`${name}.txt`, `${output.content_sha256}\n`);
      else files.set(`${name}.txt`, readable(await content(servers, output.content_sha256 as string), output.content_sha256 as string));
    } else {
      files.set(`${name}.txt`, `${JSON.stringify({ recipeKey: output.recipe_key, recipe: output.recipe_json ? JSON.parse(output.recipe_json as string) : null }, null, 2)}\n`);
    }
  }
  return files;
}

// The exported pipeline's stages in order, each with its step and its turn among the stages of that step.
function pipelineTurns(data: Export): { order: string[]; stepOf: (stageId: string) => string; turnOf: Map<string, number> } {
  const stages = new Map(data.stages.map((s) => [s.id as string, s]));
  const stepOf = (stageId: string) => stages.get(stageId)!.step as string;
  const order = [...data.pipeline].sort((a, b) => (a.position as number) - (b.position as number)).map((e) => e.stage_id as string);
  const numbers = turns(order, stepOf);
  return { order, stepOf, turnOf: new Map(order.map((id, i) => [id, numbers[i]])) };
}

function storedSnapshot(dir: string): Snapshot {
  const files: Snapshot = new Map();
  for (const sub of ["requests", "outputs"]) {
    if (!existsSync(join(dir, sub))) continue;
    for (const name of readdirSync(join(dir, sub))) files.set(`${sub}/${name}`, readFileSync(join(dir, sub, name), "utf8"));
  }
  return files;
}

// Every issue number found in a stored output: the ids of the items of every "issues" list in it.
function issueIds(value: unknown, into: Set<number>, key = ""): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (key === "issues" && item && typeof item === "object" && typeof (item as Row).id === "number") into.add((item as Row).id as number);
      issueIds(item, into);
    }
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) issueIds(v, into, k);
  }
}

// Where each recorded stage's numbering started, by its step and its turn among the pipeline's stages of that step:
// the smallest issue number in its outputs that no stage before it has. Stages that numbered nothing are left out.
function numberingStarts(file: string): Map<string, number> {
  const zip = unzipSync(readFileSync(file));
  const data = JSON.parse(new TextDecoder().decode(zip["project.json"])) as Export;
  const { order, stepOf, turnOf } = pipelineTurns(data);
  const seen = new Set<number>();
  const starts = new Map<string, number>();
  for (const stageId of order) {
    const step = stepOf(stageId);
    const turn = turnOf.get(stageId)!;
    const ids = new Set<number>();
    for (const o of data.outputs) {
      if (o.stage_id !== stageId || !o.content_sha256) continue;
      const bytes = zip[`content/${o.content_sha256}`];
      if (!bytes) continue;
      try {
        issueIds(JSON.parse(new TextDecoder().decode(bytes)), ids);
      } catch {
        // Not JSON: no issues.
      }
    }
    const fresh = [...ids].filter((id) => !seen.has(id));
    if (fresh.length > 0) starts.set(`${step}#${turn}`, Math.min(...fresh));
    for (const id of ids) seen.add(id);
  }
  return starts;
}

// Runs the stages one by one, in Manual mode, until the last is done or one fails; before each, the issue counter as
// its recorded stage had it. A carried manual stage is kept or dropped by the page as soon as its turn comes.
async function runStageByStage(page: Page, servers: Servers, id: string, starts: Map<string, number>) {
  await servers.api(`/projects/${id}`, { runMode: "manual" }, "PATCH");
  for (let steps = 0; steps < 100; steps++) {
    const stages = await pipelineOf(servers, id);
    if (stages.some((s) => s.status === "failed")) return;
    const index = stages.findIndex((s) => s.status !== "done");
    if (index < 0) return;
    const next = stages[index];
    const turn = turns(stages, (s) => s.step)[index];
    const start = starts.get(`${next.step}#${turn}`);
    if (start !== undefined) servers.sql(`UPDATE projects SET next_issue_number = ${start} WHERE id = '${id}'`);
    await openProject(page, servers, id);
    if (!next.carried) await page.getByRole("button", { name: /^(Run|Retry)$/ }).first().click({ timeout: 30_000 });
    // Until this stage is done or failed, or (a carried one) kept or dropped.
    const now = async () => (await pipelineOf(servers, id)).find((s) => s.id === next.id);
    await until(
      async () => {
        const stage = await now();
        return !stage || stage.status === "done" || stage.status === "failed";
      },
      { every: 1000, timeout: 600_000, what: async () => `${next.step} didn't finish: ${(await now())?.status}` },
    );
  }
  throw new Error("the pipeline didn't come to an end");
}

// Runs one fixture; returns what differs from its snapshot (empty when nothing does, or with --update).
async function replay(name: string): Promise<string[]> {
  const stateDir = mkdtempSync(join(tmpdir(), "score3ly-replay-"));
  const servers = await startServers({ workerPort: 8884, webPort: 5270, stateDir });
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const id = await newProject(page, servers, join(FIXTURES, `${name}.s3l`));

    const replayConfig = await servers.api<{ id: string }>("/model-configs", { name: "Replay", provider: "fake", modelString: REPLAY_MODEL, family: "fake", pricing: { kind: "free" } });
    const layout = (await pipelineOf(servers, id)).find((s) => s.step === "layout");
    if (!layout) throw new Error("the fixture has no layout stage");
    await servers.api(`/projects/${id}/stages/${layout.id}/config`, { config: { ...layout.config, modelConfigId: replayConfig.id }, applyModelConfigToLater: true }, "PUT");
    await runStageByStage(page, servers, id, numberingStarts(join(FIXTURES, `${name}.s3l`)));
    const problems: string[] = [];
    // Each Transcription opened, which works out who chose and applied along the real chain of stages
    // (apps/web/src/attribution.ts): an entry given to a stage of another step is reported on the console.
    page.on("console", (message) => {
      if (message.type() === "error" && message.text().startsWith("Attribution:")) problems.push(message.text());
    });
    for (const stage of await pipelineOf(servers, id)) {
      if (!["extract", "review", "apply_review", "human_review"].includes(stage.step)) continue;
      await page.goto(`${servers.app}#/projects/${id}/artifacts/${stage.id}.music`);
      // The view shows its systems only once the attribution is worked out.
      await page
        .getByText(/^System 1 · page/)
        .first()
        .waitFor({ timeout: 60_000 })
        .catch(async () => {
          problems.push(`${stage.step}'s Transcription (${stage.id}) didn't load`);
          if (process.env.REPLAY_KEEP) await page.screenshot({ path: join(process.env.REPLAY_KEEP, `${stage.id}.png`), fullPage: true });
        });
    }
    await context.close();

    const { stages, dropped } = await servers.api<{ stages: { step: string; status: string; error: string | null }[]; dropped: { step: string }[] }>(`/projects/${id}/pipeline`);
    for (const s of stages) if (s.status !== "done") problems.push(`${s.step} is ${s.status}${s.error ? `: ${s.error}` : ""}`);
    for (const d of dropped) problems.push(`${d.step} was dropped: the replay should have kept every manual stage`);
    if (problems.length > 0) {
      if (process.env.REPLAY_KEEP) {
        const data = await servers.api<Export>(`/projects/${id}/export`);
        mkdirSync(process.env.REPLAY_KEEP, { recursive: true });
        writeFileSync(join(process.env.REPLAY_KEEP, "project.json"), JSON.stringify(data, null, 2));
        for (const sha of (data as unknown as { content: string[] }).content) writeFileSync(join(process.env.REPLAY_KEEP, sha), await content(servers, sha));
      }
      return problems;
    }

    const data = await servers.api<Export>(`/projects/${id}/export`);
    const now = await snapshotOf(servers, data, replayConfig.id);
    const dir = join(FIXTURES, name);
    if (UPDATE) {
      rmSync(dir, { recursive: true, force: true });
      for (const [path, text] of now) {
        mkdirSync(join(dir, path, ".."), { recursive: true });
        writeFileSync(join(dir, path), text);
      }
      console.log(`  ${now.size} files written to ${relative(ROOT, dir)}`);
      return [];
    }
    const before = storedSnapshot(dir);
    if (before.size === 0) return [`no snapshot yet: make it with \`npm run replay -- --update\``];
    for (const [path, text] of now) {
      if (!before.has(path)) problems.push(`new: ${path}`);
      else if (before.get(path) !== text) problems.push(`changed: ${path}`);
    }
    for (const path of before.keys()) if (!now.has(path)) problems.push(`gone: ${path}`);
    return problems;
  } finally {
    await browser.close();
    await stopAll(); // the next fixture's servers take the same ports
    rmSync(stateDir, { recursive: true, force: true });
  }
}

async function main() {
  process.on("exit", () => stopAll());
  process.on("SIGINT", () => process.exit(130));
  const names = readdirSync(FIXTURES)
    .filter((f) => f.endsWith(".s3l"))
    .map((f) => f.slice(0, -".s3l".length))
    .filter((n) => !ONLY || n === ONLY);
  if (names.length === 0) throw new Error(`no fixtures in ${relative(ROOT, FIXTURES)}${ONLY ? ` named ${ONLY}` : ""}`);
  let failed = 0;
  for (const name of names) {
    console.log(`${name}…`);
    const problems = await replay(name);
    for (const p of problems) console.log(`  ${p}`);
    if (problems.length > 0) failed++;
    else if (!UPDATE) console.log("  as before");
  }
  if (failed > 0) {
    console.log(`\n${failed} of ${names.length} fixtures differ. If a change was made on purpose: \`npm run replay -- --update\`, and look at the snapshots' diff.`);
    process.exit(1);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
