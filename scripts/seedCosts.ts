// Mock usage for building the costs view (docs/llm.md, "The costs view"): five months of one user's projects, stages
// and LLM calls, written into a local database of its own, never the one `npm run dev:worker` uses.
//
//   npm run seed:costs                      builds apps/worker/.wrangler/seed-costs (deleting what was there)
//   npm run dev:worker -- --persist-to .wrangler/seed-costs
//
// A simulation, not hand-written rows: each stage makes its calls one after the other, with tokens and durations
// from the step and the model config's effort, costs computed as the Worker computes them (llm/prices.ts), and the
// spending cap enforced on the rolling 24 hours, so a long score stops at the cap and resumes the next day. Seeded,
// so every run gives the same data. What it holds:
// - model configs on every provider: Opus on Anthropic's API, Sonnet, Haiku on Vertex AI, Gemini marked free tier,
//   Fable (deleted after a trial), Opus on Bedrock in the EU edited once (two rows, one superseding the other), and
//   the fake model of migration 0014;
// - 17 projects from June to today, with a quiet summer gap; two on the same PDF; three deleted, one of whose names
//   is used again;
// - stages kept in a pipeline, replaced by a re-run (another config, a fix before them), stopped, failed, and
//   manual stages between them; calls that failed, were cut off or couldn't be parsed, and their retries.
// Only rows: no outputs, no R2 content. Opening a seeded project shows its pipeline, not its artifacts.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WORKER = join(ROOT, "apps/worker");
const STATE = process.argv[2] ?? ".wrangler/seed-costs"; // relative to apps/worker, like --persist-to there
const TODAY = Date.parse("2026-10-27T16:00:00Z");
const CAP_USD = 15;

// Mulberry32: a small seeded generator, so the data is the same on every run.
let seed = 0x5c03e1;
function random(): number {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (min: number, max: number) => min + random() * (max - min);
const int = (min: number, max: number) => Math.floor(between(min, max + 1));
const chance = (p: number) => random() < p;
const hex = (n: number) => Array.from({ length: n }, () => Math.floor(random() * 16).toString(16)).join("");
const uuid = () => `${hex(8)}-${hex(4)}-4${hex(3)}-${hex(4)}-${hex(12)}`;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const iso = (t: number) => new Date(t).toISOString();
const at = (date: string) => Date.parse(`${date}Z`);

// A stage's row is written once it ends, after its calls: the calls go last, for their foreign key.
const statements: string[] = [];
const callStatements: string[] = [];
function sql(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}
function insert(table: string, row: Record<string, unknown>) {
  (table === "llm_calls" ? callStatements : statements).push(`INSERT INTO ${table} (${Object.keys(row).join(", ")}) VALUES (${Object.values(row).map(sql).join(", ")});`);
}

// ---- Model configs and prices (as llm/prices.ts has them; US dollars per million tokens) ----

type Price = { input: number; output: number; cacheRead: number; cacheWrite: number };
const claude = (input: number, output: number, cacheRead: number): Price => ({ input, output, cacheRead, cacheWrite: input * 1.25 });
const PRICES: Record<string, Price> = {
  opus: claude(4, 20, 0.2),
  sonnet: claude(2, 10, 0.2),
  haiku: claude(0.1, 0.5, 0.01),
  fable: claude(10, 50, 0.25),
};

type Config = { id: string; family: keyof typeof PRICES | "gemini" | "fake"; responseModel: string; effort: string | null; free: boolean };
const EFFORT_OUTPUT: Record<string, number> = { low: 0.4, medium: 0.7, high: 1, xhigh: 1.5, max: 2.2 };

function config(row: { id: string; name: string | null; provider: string; model: string; effort: string | null; params?: object; secrets?: object; free?: boolean; created: string; deleted?: string; supersedes?: string }, family: Config["family"], responseModel: string): Config {
  insert("model_configs", {
    id: row.id,
    name: row.name,
    provider: row.provider,
    model: row.model,
    effort: row.effort,
    params_json: JSON.stringify(row.params ?? {}),
    secrets_json: JSON.stringify(row.secrets ?? {}),
    free_tier: row.free ? 1 : 0,
    supersedes_id: row.supersedes ?? null,
    created_at: iso(at(row.created)),
    deleted_at: row.deleted ? iso(at(row.deleted)) : null,
  });
  return { id: row.id, family, responseModel, effort: row.effort, free: !!row.free };
}

const FAKE: Config = { id: "fake-model", family: "fake", responseModel: "fake", effort: null, free: true }; // migration 0014
const OPUS = config({ id: "cfg-opus", name: "Opus", provider: "anthropic", model: "claude-opus-5-5", effort: "high", secrets: { apiKey: "ANTHROPIC_API_KEY" }, created: "2026-06-04T19:12:00" }, "opus", "claude-opus-5-5");
const SONNET = config({ id: "cfg-sonnet", name: "Sonnet", provider: "anthropic", model: "claude-sonnet-5-5", effort: "medium", secrets: { apiKey: "ANTHROPIC_API_KEY" }, created: "2026-06-10T20:03:00" }, "sonnet", "claude-sonnet-5-5");
const HAIKU = config({ id: "cfg-haiku", name: "Haiku (Vertex)", provider: "anthropic-vertex", model: "claude-haiku-5-5", effort: "low", params: { region: "europe-west1", projectId: "score3ly" }, secrets: { serviceAccount: "VERTEX_SERVICE_ACCOUNT" }, created: "2026-06-20T10:40:00" }, "haiku", "claude-haiku-5-5");
const GEMINI = config({ id: "cfg-gemini", name: null, provider: "google", model: "gemini-3.1-pro-preview", effort: "high", secrets: { apiKey: "GEMINI_FREE_KEY" }, free: true, created: "2026-08-12T21:30:00" }, "gemini", "gemini-3.1-pro-preview");
const FABLE = config({ id: "cfg-fable", name: "Fable", provider: "anthropic", model: "claude-fable-5-1", effort: "max", secrets: { apiKey: "ANTHROPIC_API_KEY" }, created: "2026-08-25T18:55:00", deleted: "2026-08-30T11:00:00" }, "fable", "claude-fable-5-1");
const OPUS_EU_1 = config({ id: "cfg-opus-eu-1", name: "Opus EU", provider: "anthropic-bedrock", model: "anthropic.claude-opus-5-5", effort: "high", params: { region: "eu-central-1" }, secrets: { apiKey: "BEDROCK_API_KEY" }, created: "2026-09-01T19:20:00", deleted: "2026-09-15T20:10:00" }, "opus", "claude-opus-5-5");
const OPUS_EU_2 = config({ id: "cfg-opus-eu-2", name: "Opus EU", provider: "anthropic-bedrock", model: "anthropic.claude-opus-5-5", effort: "xhigh", params: { region: "eu-central-1" }, secrets: { apiKey: "BEDROCK_API_KEY" }, created: "2026-09-15T20:10:00", supersedes: "cfg-opus-eu-1" }, "opus", "claude-opus-5-5");

for (const [key, value] of [["defaultModelConfigId", OPUS_EU_2.id], ["spendingCapUsd", CAP_USD], ["newProjectRunMode", "auto"]] as const) {
  statements.push(`INSERT OR REPLACE INTO settings (key, value_json, updated_at) VALUES (${sql(key)}, ${sql(JSON.stringify(value))}, ${sql(iso(at("2026-09-15T20:12:00")))});`);
}

// ---- Calls ----

// Every paid call so far, for the spending cap's rolling 24 hours.
const paid: { t: number; cost: number }[] = [];
function spentInDayBefore(t: number): number {
  return paid.filter((c) => c.t > t - DAY && c.t <= t).reduce((sum, c) => sum + c.cost, 0);
}

class CapReached extends Error {}

type Tokens = { input: number; output: number; cacheRead: number; cacheWrite: number };

// One call at time `t`: returns when it ended. A failed, cut-off or unparseable call is followed by its retry.
function call(stageId: string, cfg: Config, t: number, tokens: Tokens, deleted: string | null): number {
  if (!cfg.free && spentInDayBefore(t) >= CAP_USD) throw new CapReached();
  const roll = random();
  const status = roll < 0.025 ? "error" : roll < 0.035 ? "cut_off" : roll < 0.045 ? "unparseable" : "ok";
  const effort = EFFORT_OUTPUT[cfg.effort ?? "high"] ?? 1;
  const output = status === "cut_off" ? 32_000 : Math.round(tokens.output * effort * between(0.8, 1.25));
  const seconds = status === "error" ? between(2, 40) : 4 + output / between(50, 90) + tokens.input / 4000;
  const end = t + seconds * 1000;
  const price = cfg.free || cfg.family === "fake" || cfg.family === "gemini" ? null : PRICES[cfg.family];
  const usage = status === "error" ? null : { ...tokens, output };
  const cost = usage === null ? null : price === null ? 0 : Math.round(((usage.input * price.input + usage.output * price.output + usage.cacheRead * price.cacheRead + usage.cacheWrite * price.cacheWrite) / 1_000_000) * 1e6) / 1e6;
  if (cost && !cfg.free) paid.push({ t, cost });
  insert("llm_calls", {
    id: uuid(),
    stage_id: stageId,
    model_config_id: cfg.id,
    request_key: hex(64),
    response_model: usage ? cfg.responseModel : null,
    request_sha256: deleted ? null : hex(64),
    response_sha256: deleted || !usage ? null : hex(64),
    status,
    error:
      status === "error" ? (chance(0.6) ? "The provider is overloaded (529). Try again later." : "The request timed out after 600 s.")
      : status === "cut_off" ? "The answer was cut off."
      : status === "unparseable" ? "The answer ended unexpectedly."
      : null,
    input_tokens: usage?.input ?? null,
    output_tokens: usage?.output ?? null,
    cached_tokens: usage?.cacheRead ?? null,
    cache_write_tokens: usage?.cacheWrite ?? null,
    cost_usd: cost,
    price_json: price && usage ? JSON.stringify({ ...price, asOf: t < at("2026-10-06T00:00:00") ? "2026-05-28" : "2026-10-06" }) : null,
    started_at: iso(t),
    finished_at: iso(end),
    deleted_at: deleted,
  });
  return status === "ok" ? end : call(stageId, cfg, end + between(1, 5) * 1000, tokens, deleted);
}

// Tokens of one request, before the effort scales the output (thinking included).
const LAYOUT_ROUND = (round: number): Tokens => ({ input: int(1800, 2600), output: int(1200, 2400), cacheRead: round === 1 ? 0 : int(3800, 5200) * (round - 1), cacheWrite: round === 1 ? int(3600, 4800) : int(1800, 2600) });
const ANALYZE_PAGE = (): Tokens => ({ input: int(1400, 2200), output: int(1800, 3200), cacheRead: int(2400, 2600), cacheWrite: 0 });
const ANALYZE_SCORE = (pages: number): Tokens => ({ input: 2400 + pages * int(500, 800), output: int(2500, 4500), cacheRead: 0, cacheWrite: 0 });
const EXTRACT_SYSTEM = (staves: number): Tokens => ({ input: int(6000, 9500) * (staves / 2), output: int(2600, 6500) * (staves / 2), cacheRead: int(5200, 6400), cacheWrite: 0 });

// ---- Projects and stages ----

type Project = { id: string; created: number; pages: number; systems: number[]; staves: number; deleted: string | null; entries: string[] };
type Stage = { id: string; end: number };
type StageEnd = "done" | "failed" | "stopped" | "wip";

function project(name: string, file: string, pdf: string, created: number, pages: number, staves: number, deleted: string | null = null): Project {
  const id = uuid();
  insert("projects", {
    id, name, pdf_sha256: pdf, pdf_filename: file, run_mode: "auto", version: 0, next_issue_number: 1,
    created_at: iso(created), last_modified_at: iso(created), last_opened_at: iso(created), deleted_at: deleted ? iso(at(deleted)) : null,
  });
  // Piano music has 4 to 6 systems a page; a title page none.
  const systems = Array.from({ length: pages }, (_, i) => (i === 0 && pages > 6 ? 0 : int(staves > 2 ? 3 : 4, staves > 2 ? 4 : 6)));
  const p = { id, created, pages, systems, staves, deleted: deleted ? iso(at(deleted)) : null, entries: [] };
  stageRow(p, "ingest", null, created, created, "done", null, true);
  return p;
}

function stageRow(p: Project, step: string, cfg: Config | null, start: number | null, end: number | null, status: StageEnd | "planned", note: string | null, inPipeline: boolean, error: string | null = null): string {
  const id = uuid();
  insert("stages", {
    id, created_in: p.id, step, step_version: start === null ? null : 1, status,
    config_json: start === null ? null : "{}", model_config_id: cfg?.id ?? null, stage_key: start === null ? null : hex(64),
    error, note, created_at: iso(start ?? p.created), started_at: start === null ? null : iso(start),
    heartbeat_at: end === null ? null : iso(end), finished_at: end === null || status === "wip" ? null : iso(end),
    page_count: step === "ingest" || start === null ? null : p.pages, in_recipe: step.startsWith("fix_") ? 0 : 1, deleted_at: p.deleted,
  });
  if (inPipeline) p.entries.push(id);
  return id;
}

// An LLM stage, its calls one after the other from `start`. At the spending cap the stage fails and is retried the
// next evening (a retry continues in the same row). `stopAfter` stops it after that many items.
function llm(p: Project, step: "layout" | "analyze" | "extract", cfg: Config, start: number, opts: { inPipeline?: boolean; stopAfter?: number; failAt?: number } = {}): Stage {
  const id = uuid();
  const items: (() => Tokens[])[] = [];
  if (step === "layout") for (let i = 0; i < p.pages; i++) items.push(() => { const rounds = random() < 0.55 ? 1 : random() < 0.8 ? 2 : 3; return Array.from({ length: rounds }, (_, r) => LAYOUT_ROUND(r + 1)); });
  if (step === "analyze") { for (let i = 0; i < p.pages; i++) items.push(() => [ANALYZE_PAGE()]); items.push(() => [ANALYZE_SCORE(p.pages)]); }
  if (step === "extract") for (const n of p.systems) for (let s = 0; s < n; s++) items.push(() => [EXTRACT_SYSTEM(p.staves)]);
  let t = start;
  let status: StageEnd = "done";
  let error: string | null = null;
  const limit = opts.stopAfter ?? opts.failAt ?? items.length;
  for (let i = 0; i < Math.min(limit, items.length); i++) {
    for (const tokens of items[i]()) {
      try {
        t = call(id, cfg, t, tokens, p.deleted) + between(0.3, 2) * 1000;
      } catch (e) {
        if (!(e instanceof CapReached)) throw e;
        // The cap stops the stage; the user retries an evening later, once the last 24 hours allow it.
        let retry = t;
        do {
          const next = new Date(retry + DAY);
          next.setUTCHours(int(18, 21), int(0, 59));
          retry = next.getTime();
        } while (spentInDayBefore(retry) >= CAP_USD);
        t = call(id, cfg, retry, tokens, p.deleted);
      }
    }
  }
  if (opts.stopAfter !== undefined) status = "stopped";
  if (opts.failAt !== undefined) { status = "failed"; error = "System 23: the answer can't be used (a voice of stretch 2 has no music)."; }
  const systems = p.systems.reduce((a, b) => a + b, 0);
  const note = status !== "done" ? null : step === "layout" ? `${systems} systems` : step === "analyze" ? `${int(4, 14)} observations` : `${systems} systems · ${int(2, 20)} issues · ${int(0, 6)} warnings`;
  insert("stages", {
    id, created_in: p.id, step, step_version: 1, status, config_json: "{}", model_config_id: cfg.id, stage_key: hex(64),
    error, note, created_at: iso(start), started_at: iso(start), heartbeat_at: iso(t), finished_at: iso(t), page_count: p.pages, deleted_at: p.deleted,
  });
  if (opts.inPipeline ?? true) p.entries.push(id);
  return { id, end: t };
}

// A computed stage: seconds, no calls.
function computed(p: Project, step: string, start: number, inPipeline = true): number {
  const end = start + between(4, 40) * 1000 * (step === "rasterize" ? p.pages / 6 : 1);
  stageRow(p, step, null, start, end, "done", step === "rasterize" ? `${p.pages} pages` : step === "engrave" ? `${p.systems.reduce((a, b) => a + b, 0) * 4} measures` : null, inPipeline);
  return end;
}

// A manual stage: the user works on it for a while.
function manual(p: Project, step: string, start: number, minutes: [number, number], status: "done" | "wip" = "done", inPipeline = true): number {
  const end = start + between(...minutes) * MINUTE;
  stageRow(p, step, null, start, end, status, status === "done" ? "Changed" : null, inPipeline);
  return end;
}

function planned(p: Project, ...steps: string[]) {
  for (const step of steps) stageRow(p, step, null, null, null, "planned", null, true);
}

function pipeline(p: Project, last: number) {
  p.entries.forEach((stageId, i) => insert("pipeline_entries", { project_id: p.id, position: i + 1, stage_id: stageId }));
  statements.push(`UPDATE projects SET last_modified_at = ${sql(iso(last))}, last_opened_at = ${sql(iso(Math.min(last + between(0, 3) * DAY, TODAY)))} WHERE id = ${sql(p.id)};`);
}

const gap = (min: number, max: number) => between(min, max) * MINUTE;

// The recipe up to `analyze`, from `t`: returns when `analyze` ended.
function front(p: Project, cfg: Config, t: number, fixes: { skew?: boolean; layout?: boolean; metadata?: boolean } = {}): number {
  t = computed(p, "rasterize", t + gap(0, 1));
  t = computed(p, "skew_analysis", t);
  if (fixes.skew) t = manual(p, "fix_skew", t + gap(1, 5), [3, 15]);
  t = llm(p, "layout", cfg, t).end;
  if (fixes.layout) t = manual(p, "fix_layout", t + gap(2, 30), [5, 40]);
  t = llm(p, "analyze", cfg, t + gap(0, 2)).end;
  if (fixes.metadata) t = manual(p, "fix_metadata", t + gap(1, 10), [2, 8]);
  return t;
}

const pdf = () => hex(64);

// ---- Five months of use ----

// June: trying the app with the fake model, then the first real scores.
{
  const p = project("scan test", "scan test.pdf", pdf(), at("2026-06-02T20:15:00"), 3, 2, "2026-06-03T09:00:00");
  let t = front(p, FAKE, at("2026-06-02T20:16:00"));
  t = llm(p, "extract", FAKE, t).end;
  pipeline(p, computed(p, "engrave", t));
}
{
  const p = project("Kinderszenen", "Schumann - Kinderszenen Op. 15.pdf", pdf(), at("2026-06-04T19:20:00"), 14, 2);
  let t = front(p, OPUS, at("2026-06-04T19:21:00"), { layout: true, metadata: true });
  t = llm(p, "extract", OPUS, t + gap(5, 20)).end;
  pipeline(p, computed(p, "engrave", t));
}
{
  // Sonnet first, then extract again with Opus: the Sonnet extract and the first engrave are replaced.
  const p = project("Sonatinas Op. 36", "Clementi - 6 Sonatinas Op. 36.pdf", pdf(), at("2026-06-10T20:10:00"), 22, 2);
  let t = front(p, SONNET, at("2026-06-10T20:11:00"));
  t = llm(p, "extract", SONNET, t, { inPipeline: false }).end;
  t = computed(p, "engrave", t, false);
  t = llm(p, "extract", OPUS, at("2026-06-13T10:30:00")).end;
  pipeline(p, computed(p, "engrave", t));
}
{
  // Layout on Haiku to save money; boxes fixed by hand, layout again on Opus, which replaces Haiku's and the fix.
  const p = project("Inventions", "Bach - Two-Part Inventions BWV 772-786.pdf", pdf(), at("2026-06-20T10:45:00"), 30, 2);
  let t = computed(p, "rasterize", at("2026-06-20T10:46:00"));
  t = computed(p, "skew_analysis", t);
  t = llm(p, "layout", HAIKU, t, { inPipeline: false }).end;
  t = manual(p, "fix_layout", t + gap(5, 10), [20, 50], "done", false);
  t = llm(p, "layout", OPUS, t + gap(10, 30)).end;
  t = llm(p, "analyze", HAIKU, t).end;
  t = llm(p, "extract", OPUS, at("2026-06-21T15:00:00")).end;
  pipeline(p, computed(p, "engrave", t));
}
{
  const p = project("Album for the Young", "Tchaikovsky - Album for the Young Op. 39.pdf", pdf(), at("2026-07-04T09:30:00"), 36, 2);
  let t = front(p, OPUS, at("2026-07-04T09:31:00"), { skew: true, layout: true });
  t = llm(p, "extract", OPUS, t + gap(2, 10)).end;
  pipeline(p, computed(p, "engrave", t));
}
// Mid-July to mid-August: holidays, one small score.
{
  const p = project("Für Elise", "Beethoven - Fur Elise WoO 59.pdf", pdf(), at("2026-07-29T21:00:00"), 4, 2);
  let t = front(p, OPUS, at("2026-07-29T21:01:00"));
  t = llm(p, "extract", OPUS, t).end;
  pipeline(p, computed(p, "engrave", t));
}
// August: the same score on two models; a trial of Fable.
{
  const nocturnes = pdf();
  const a = project("Nocturnes Op. 9, Opus", "Chopin - Nocturnes Op. 9.pdf", nocturnes, at("2026-08-12T20:00:00"), 16, 2);
  let t = front(a, OPUS, at("2026-08-12T20:01:00"), { layout: true });
  t = llm(a, "extract", OPUS, t).end;
  pipeline(a, computed(a, "engrave", t));
  const b = project("Nocturnes Op. 9, Gemini", "Chopin - Nocturnes Op. 9.pdf", nocturnes, at("2026-08-13T19:40:00"), 16, 2);
  let u = front(b, GEMINI, at("2026-08-13T19:41:00"));
  u = llm(b, "extract", GEMINI, u).end;
  pipeline(b, computed(b, "engrave", u));
}
{
  const p = project("Sonata K. 545", "Mozart - Sonata K. 545.pdf", pdf(), at("2026-08-25T19:00:00"), 10, 2);
  let t = front(p, FABLE, at("2026-08-25T19:01:00"));
  t = llm(p, "extract", FABLE, t).end;
  pipeline(p, computed(p, "engrave", t));
}
// September: everything in the EU, on Bedrock. A long score meets the spending cap.
{
  const p = project("Impromptus D. 899", "Schubert - 4 Impromptus D. 899.pdf", pdf(), at("2026-09-03T19:30:00"), 42, 2);
  let t = front(p, OPUS_EU_1, at("2026-09-03T19:31:00"), { layout: true, metadata: true });
  t = llm(p, "extract", OPUS_EU_1, t + gap(3, 15)).end;
  pipeline(p, computed(p, "engrave", t));
}
{
  const p = project("Arabesques", "Debussy - Deux Arabesques.pdf", pdf(), at("2026-09-09T20:30:00"), 12, 2, "2026-09-12T18:00:00");
  let t = front(p, OPUS_EU_1, at("2026-09-09T20:31:00"));
  t = llm(p, "extract", OPUS_EU_1, t).end;
  pipeline(p, computed(p, "engrave", t));
}
{
  // A better scan of the same pieces, under the deleted project's name.
  const p = project("Arabesques", "Debussy - Deux Arabesques (Durand 1891).pdf", pdf(), at("2026-09-12T18:10:00"), 12, 2);
  let t = front(p, OPUS_EU_1, at("2026-09-12T18:11:00"), { skew: true });
  t = llm(p, "extract", OPUS_EU_1, t).end;
  pipeline(p, computed(p, "engrave", t));
}
{
  // Started before the config was edited, extract run again after it with the new effort.
  const p = project("Lyric Pieces Op. 12", "Grieg - Lyric Pieces Op. 12.pdf", pdf(), at("2026-09-14T20:00:00"), 18, 2);
  let t = front(p, OPUS_EU_1, at("2026-09-14T20:01:00"), { layout: true });
  t = llm(p, "extract", OPUS_EU_1, t, { inPipeline: false }).end;
  t = computed(p, "engrave", t, false);
  t = llm(p, "extract", OPUS_EU_2, at("2026-09-16T19:00:00")).end;
  pipeline(p, computed(p, "engrave", t));
}
{
  const p = project("Gymnopédies", "Satie - 3 Gymnopedies.pdf", pdf(), at("2026-09-24T21:10:00"), 8, 2, "2026-10-02T12:00:00");
  let t = front(p, OPUS_EU_2, at("2026-09-24T21:11:00"));
  t = llm(p, "extract", OPUS_EU_2, t).end;
  pipeline(p, computed(p, "engrave", t));
}
// October: experiments on layout, a song, and work in progress.
{
  // Layout tried on Haiku and stopped, then Opus; analyze again after a fix of the boxes.
  const p = project("Pathétique", "Beethoven - Sonata Op. 13 Pathetique.pdf", pdf(), at("2026-10-03T10:00:00"), 20, 2);
  let t = computed(p, "rasterize", at("2026-10-03T10:01:00"));
  t = computed(p, "skew_analysis", t);
  t = llm(p, "layout", HAIKU, t, { inPipeline: false, stopAfter: 6 }).end;
  t = llm(p, "layout", OPUS_EU_2, t + gap(2, 5)).end;
  t = llm(p, "analyze", OPUS_EU_2, t, { inPipeline: false }).end;
  t = manual(p, "fix_layout", at("2026-10-04T16:00:00"), [10, 25]);
  t = llm(p, "analyze", OPUS_EU_2, t).end;
  t = llm(p, "extract", OPUS_EU_2, t).end;
  pipeline(p, computed(p, "engrave", t));
}
{
  // Voice and piano: three staves.
  const p = project("Dichterliebe", "Schumann - Dichterliebe Op. 48.pdf", pdf(), at("2026-10-11T19:00:00"), 34, 3);
  let t = front(p, OPUS_EU_2, at("2026-10-11T19:01:00"), { layout: true, metadata: true });
  t = llm(p, "extract", OPUS_EU_2, t).end;
  pipeline(p, computed(p, "engrave", t));
}
{
  // extract failed on an unusable answer; not retried yet.
  const p = project("Intermezzi Op. 117", "Brahms - 3 Intermezzi Op. 117.pdf", pdf(), at("2026-10-19T20:20:00"), 15, 2);
  let t = front(p, OPUS_EU_2, at("2026-10-19T20:21:00"));
  const failed = llm(p, "extract", OPUS_EU_2, t, { failAt: 23 });
  planned(p, "engrave");
  pipeline(p, failed.end);
}
{
  // Today: the boxes being fixed by hand.
  const p = project("Sonatas K. 1–30", "Scarlatti - Essercizi K. 1-30.pdf", pdf(), at("2026-10-27T09:40:00"), 28, 2);
  let t = computed(p, "rasterize", at("2026-10-27T09:41:00"));
  t = computed(p, "skew_analysis", t);
  t = llm(p, "layout", OPUS_EU_2, t).end;
  t = manual(p, "fix_layout", t + gap(5, 20), [10, 30], "wip");
  planned(p, "analyze", "extract", "engrave");
  pipeline(p, t);
}

if (paid.some((c) => c.t > TODAY)) throw new Error("The simulation ran past today: move the last projects earlier.");

// ---- Write it ----

const stateDir = join(WORKER, STATE);
rmSync(stateDir, { recursive: true, force: true });
// Wrangler reports its errors on stdout, which is only shown when it fails.
function wrangler(args: string[]) {
  try {
    execFileSync("npx", ["wrangler", ...args], { cwd: WORKER, stdio: ["ignore", "pipe", "inherit"] });
  } catch (e) {
    process.stdout.write((e as { stdout?: Buffer }).stdout ?? "");
    throw e;
  }
}
wrangler(["d1", "migrations", "apply", "score3ly", "--local", "--persist-to", STATE]);
const file = join(mkdtempSync(join(tmpdir(), "score3ly-seed-")), "seed.sql");
writeFileSync(file, [...statements, ...callStatements].join("\n"));
wrangler(["d1", "execute", "score3ly", "--local", "--persist-to", STATE, "--file", file]);
rmSync(dirname(file), { recursive: true, force: true });

const total = paid.reduce((sum, c) => sum + c.cost, 0);
console.log(`Seeded ${STATE}: ${callStatements.length} calls, $${total.toFixed(2)} in all.`);
console.log(`Start it with: npm run dev:worker -- --persist-to ${STATE}`);
