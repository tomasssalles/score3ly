// Step 1 of the list of models and prices for Anthropic's API (gather/README.md, "Anthropic"):
//
//   node model-list/gather/anthropic.ts --download   fetches the sources into gather/downloads/ (not committed), cuts
//                                                    the excerpts the parsing reads into gather/sources/anthropic/
//                                                    (committed), then parses them
//   node model-list/gather/anthropic.ts              parses the committed excerpts again
//
// and writes model-list/anthropic.json. Run from apps/worker. The parsing is expected to change from release to release:
// URLs move, formats change. What it reads, both pages in their Markdown versions (the URL with ".md"):
// - Anthropic's page "Pricing", its table "Model pricing": one row per model, named for people ("Claude Opus 4.1 ([retired,
//   …](…))"), with its base input, 5-minute cache write, cache hit and output prices ("$0.25 / MTok<sup>1</sup>"). Haiku
//   5.5 has two rows, for prompts up to and over 100,000 tokens; the first is kept (short-context prices only).
// - Anthropic's page "Model deprecations", its table of every model's API name and state (Active, Deprecated, Retired).
//   The API name is the model string, with a date for the older models ("claude-sonnet-4-5-20250929"); without the
//   date, it is the app's id. Retired models aren't listed.
// - claude-models.json, kept by hand: which models the app lists, their names, efforts and thinking.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PRICING_URL = "https://platform.claude.com/docs/en/about-claude/pricing.md";
const DEPRECATIONS_URL = "https://platform.claude.com/docs/en/about-claude/model-deprecations.md";

const here = import.meta.dirname;
const downloads = join(here, "downloads", "anthropic");
const sources = join(here, "sources", "anthropic");
const output = join(here, "..", "anthropic.json");
const today = new Date().toISOString().slice(0, 10);

type Known = { name: string; efforts: string[]; thinking?: "adaptive" };

// The table's columns the parsing reads, by their headers.
const COLUMNS = {
  input: "Base input tokens",
  cacheWrite: "5m cache writes",
  cacheRead: "Cache hits and refreshes",
  output: "Output tokens",
} as const;

function cells(line: string): string[] {
  return line.split("|").slice(1, -1).map((c) => c.trim());
}

// The Markdown table whose header line matches, as its lines: the header, the separator and the rows.
function table(lines: string[], header: RegExp): string[] {
  const start = lines.findIndex((l) => l.startsWith("|") && header.test(l));
  if (start < 0) return [];
  let end = start;
  while (end < lines.length && lines[end].startsWith("|")) end++;
  return lines.slice(start, end);
}

const PRICING_HEADER = /\|\s*Model\s*\|\s*Base input tokens\s*\|/;
const DEPRECATIONS_HEADER = /\|\s*API model name\s*\|\s*Current state\s*\|/;

async function download(): Promise<void> {
  mkdirSync(downloads, { recursive: true });
  for (const [url, file] of [
    [PRICING_URL, "pricing.md"],
    [DEPRECATIONS_URL, "model-deprecations.md"],
  ]) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    writeFileSync(join(downloads, file), Buffer.from(await response.arrayBuffer()));
    console.log(`Downloaded ${url}`);
  }
}

// From the downloads, what the parsing reads: the two tables, each with where and when it was fetched.
function excerpt(): void {
  const pricing = table(readFileSync(join(downloads, "pricing.md"), "utf8").split("\n"), PRICING_HEADER);
  const deprecations = table(readFileSync(join(downloads, "model-deprecations.md"), "utf8").split("\n"), DEPRECATIONS_HEADER);
  if (pricing.length < 3 || deprecations.length < 3) throw new Error("The pages' tables weren't found: their format changed.");
  mkdirSync(sources, { recursive: true });
  writeFileSync(join(sources, "pricing.md"), [`# ${PRICING_URL}`, `# fetched ${today}; the table "Model pricing"`, "", ...pricing, ""].join("\n"));
  writeFileSync(join(sources, "model-deprecations.md"), [`# ${DEPRECATIONS_URL}`, `# fetched ${today}; the table of the models' states`, "", ...deprecations, ""].join("\n"));
  console.log(`Excerpts: ${pricing.length - 2} price rows, ${deprecations.length - 2} models' states.`);
}

// "$0.25 / MTok<sup>1</sup>" → 0.25
function dollars(cell: string): number | null {
  const match = /^\$(\d+(?:\.\d+)?) \/ MTok/.exec(cell);
  return match ? Number(match[1]) : null;
}

function parse(): void {
  const known = (JSON.parse(readFileSync(join(here, "claude-models.json"), "utf8")) as { models: Record<string, Known> }).models;
  const byName = new Map(Object.entries(known).map(([id, k]) => [k.name, id]));
  const pricingLines = readFileSync(join(sources, "pricing.md"), "utf8").split("\n");
  const fetched = /fetched (\d{4}-\d{2}-\d{2})/.exec(pricingLines[1])?.[1] ?? today;
  const problems: string[] = [];

  // The states: "| claude-opus-4-5-20251101   | Active        | N/A | …"
  const states = new Map<string, { string: string; state: string }>();
  for (const line of table(readFileSync(join(sources, "model-deprecations.md"), "utf8").split("\n"), DEPRECATIONS_HEADER).slice(2)) {
    const [string, state] = cells(line);
    states.set(string.replace(/-\d{8}$/, ""), { string, state });
  }

  // The prices: "| Claude Opus 4.1 ([retired, …](…)) | $15 / MTok | $18.75 / MTok | $30 / MTok | $1.50 / MTok | $75 / MTok |"
  const [header, , ...rows] = table(pricingLines, PRICING_HEADER);
  const columns = cells(header);
  const index = Object.fromEntries(Object.entries(COLUMNS).map(([kind, title]) => [kind, columns.indexOf(title)])) as Record<keyof typeof COLUMNS, number>;
  for (const [kind, i] of Object.entries(index)) if (i < 0) problems.push(`The pricing table has no column "${COLUMNS[kind as keyof typeof COLUMNS]}": its format changed.`);

  const models: { id: string; string: string }[] = [];
  const prices: Record<string, unknown>[] = [];
  for (const line of rows) {
    const row = cells(line);
    if (/for prompts over/i.test(row[0])) continue; // the long-context prices
    const name = row[0].replace(/\s*\(.*$/, "");
    const id = byName.get(name);
    if (!id) {
      problems.push(`${name} isn't in claude-models.json: decide whether the app lists it.`);
      continue;
    }
    const state = states.get(id);
    if (!state) {
      problems.push(`${name} (${id}) isn't in the table of the models' states.`);
      continue;
    }
    if (state.state === "Retired") continue;
    if (models.some((m) => m.id === id)) {
      problems.push(`${name}: two rows of prices.`);
      continue;
    }
    const price = Object.fromEntries(Object.entries(index).map(([kind, i]) => [kind, dollars(row[i] ?? "")]));
    const missing = Object.entries(price).filter(([, usd]) => usd === null);
    if (missing.length > 0) {
      problems.push(`${name}: no price for ${missing.map(([kind]) => kind).join(", ")} in "${line.replace(/\s+/g, " ")}".`);
      continue;
    }
    models.push({ id, string: state.string });
    prices.push({ model: id, region: "", routing: null, input: price.input, output: price.output, cacheRead: price.cacheRead, cacheWrite: price.cacheWrite, source: `pricing table: ${row[0]}` });
  }
  if (problems.length > 0) {
    console.error(problems.map((p) => `  ${p}`).join("\n"));
    process.exit(1);
  }

  const file = {
    $schema: "./schema.json",
    provider: "anthropic",
    collectedAt: fetched,
    sources: [
      { url: PRICING_URL, note: "the prices: gather/sources/anthropic/pricing.md" },
      { url: DEPRECATIONS_URL, note: "the model strings, and which models are retired: gather/sources/anthropic/model-deprecations.md" },
    ],
    models: models.map((m) => ({
      id: m.id,
      name: known[m.id].name,
      family: "claude",
      string: m.string,
      efforts: known[m.id].efforts,
      ...(known[m.id].thinking ? { thinking: known[m.id].thinking } : {}),
    })),
    regions: [{ region: "", routings: null }],
    prices,
  };
  writeFileSync(output, JSON.stringify(file, null, 2) + "\n");
  console.log(`anthropic.json: ${models.length} models, ${prices.length} prices.`);
}

if (process.argv.includes("--download")) {
  await download();
  excerpt();
}
parse();
