// The replay tests (docs/overview.md §12, "Replay tests"): `npm run replay` (`-- --update` to accept what changed,
// `--only <name>` for one fixture). For each fixture in fixtures/replay (`<name>.s3l`, a project exported from the app):
// a Worker and Vite of their own on an empty database, through the app in a real browser (Playwright):
// 1. the project file imported, as a user would;
// 2. the replay model (`fake-replay`, apps/worker/src/llm/replay.ts) given to `layout` and every LLM stage after it,
//    which replaces them all, so every stage from `layout` on runs again; the manual stages after it are carried;
// 3. Run pressed once, in Auto mode, and the pipeline followed through the API until it is done or a stage fails;
// 4. the result compared with the fixture's snapshots in fixtures/replay/<name>/: `requests/`, every request the
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
import { launchBrowser, newProject, pipelineOf, ROOT, runToEnd, type Servers, startServers, stopAll } from "./appServers.ts";

const FIXTURES = join(ROOT, "fixtures/replay");
const UPDATE = process.argv.includes("--update");
const onlyArg = process.argv.indexOf("--only");
const ONLY = onlyArg > 0 ? process.argv[onlyArg + 1] : null;

type Row = Record<string, unknown>;
type Export = { pipeline: Row[]; stages: Row[]; outputs: Row[]; llm_calls: Row[] };

// Every file of a snapshot, by its path in the fixture's folder.
type Snapshot = Map<string, string>;

async function content(servers: Servers, sha256: string): Promise<Uint8Array> {
  const response = await fetch(`${servers.app}api/content/${sha256}`);
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
  const stages = new Map(data.stages.map((s) => [s.id as string, s]));
  const turns = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const entry of [...data.pipeline].sort((a, b) => (a.position as number) - (b.position as number))) {
    const step = stages.get(entry.stage_id as string)!.step as string;
    seen.set(step, (seen.get(step) ?? 0) + 1);
    turns.set(entry.stage_id as string, seen.get(step)!);
  }
  const where = (stageId: string) => ({ step: stages.get(stageId)!.step as string, turn: turns.get(stageId)! });

  for (const call of data.llm_calls) {
    if (call.model_config_id !== replayConfigId || !call.stage_id || !turns.has(call.stage_id as string)) continue;
    const { step, turn } = where(call.stage_id as string);
    const request = JSON.parse(new TextDecoder().decode(await content(servers, call.request_sha256 as string))) as { messages: { content: Row[] }[] };
    // Images by their recipe keys only: the bytes of an image made again may differ (docs/images.md §8.3).
    for (const m of request.messages) for (const c of m.content) if (c.type === "image") delete c.sha256;
    files.set(`requests/${placeName(step, turn, call.item as string)}-round${call.round}.json`, `${JSON.stringify(request, null, 2)}\n`);
  }
  for (const output of data.outputs) {
    if (!turns.has(output.stage_id as string)) continue;
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

function storedSnapshot(dir: string): Snapshot {
  const files: Snapshot = new Map();
  for (const sub of ["requests", "outputs"]) {
    if (!existsSync(join(dir, sub))) continue;
    for (const name of readdirSync(join(dir, sub))) files.set(`${sub}/${name}`, readFileSync(join(dir, sub, name), "utf8"));
  }
  return files;
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

    const replayConfig = await servers.api<{ id: string }>("/model-configs", { name: "Replay", provider: "fake", modelString: "fake-replay", family: "fake", pricing: { kind: "free" } });
    const layout = (await pipelineOf(servers, id)).find((s) => s.step === "layout");
    if (!layout) throw new Error("the fixture has no layout stage");
    await servers.api(`/projects/${id}/stages/${layout.id}/config`, { config: { ...layout.config, modelConfigId: replayConfig.id }, applyModelConfigToLater: true }, "PUT");
    await runToEnd(page, servers, id);
    await context.close();

    const problems: string[] = [];
    const { stages, dropped } = await servers.api<{ stages: { step: string; status: string; error: string | null }[]; dropped: { step: string }[] }>(`/projects/${id}/pipeline`);
    for (const s of stages) if (s.status !== "done") problems.push(`${s.step} is ${s.status}${s.error ? `: ${s.error}` : ""}`);
    for (const d of dropped) problems.push(`${d.step} was dropped: the replay should have kept every manual stage`);
    if (problems.length > 0) return problems;

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
    stopAll();
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
