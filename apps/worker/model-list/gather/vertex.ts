// Step 1 of the list of models and prices for Vertex AI (gather/README.md, "Vertex AI"):
//
//   node model-list/gather/vertex.ts --download   fetches the sources into gather/downloads/ (not committed), cuts
//                                                 the excerpts the parsing reads into gather/sources/vertex/
//                                                 (committed), then parses them
//   node model-list/gather/vertex.ts              parses the committed excerpts again
//
// and writes model-list/vertex.json. Run from apps/worker. The parsing is expected to change from release to release:
// URLs move, formats change. What it reads, all public pages (no credentials):
// - Anthropic's page "Claude Models on Google Cloud (Google managed)", the offering the app's adapter uses
//   (`AnthropicVertex`), in its Markdown version: the table "API model IDs", each model's name and its string on Vertex
//   AI (with an `@` date for the models before 4.6).
// - Google's page "Partner Models Pricing": a table of Claude prices per location, one tab per location ("Global",
//   "EU Multi-Region (EU)", "europe-west 1", …). A model is served where its tab has its prices. Of each model, the
//   short-context column (≤ 200K, or ≤ 100K for Haiku 5.5) of Input, Output, 5m Cache Write and Cache Hit.
// - Google's page "Vertex AI pricing", the "Standard" tabs: Gemini's input, output and cached input prices per million
//   tokens, short context, "Global" and "Non-global" (or one price for every location, for Gemini 2.5). Dated prices
//   (introductory or promotional, "through December 31, 2026", and the price "starting January 1, 2027"): the latest,
//   the standard price, is taken, which is what Google's billing catalog charges (decided 2026-11-06: the promotions are
//   paid back as credits; counting the billed price keeps the spending cap on the safe side). Audio input is left out,
//   and implicit caching has no write price: cacheWrite is 0.
// - Google's page "Vertex AI locations", its HTML (the Markdown version lacks the marks): the section "Google model
//   endpoint locations", one row per Gemini model ("Gemini 4 Argon (gemini-4-argon)"), a mark (`compare-yes`) per location
//   serving it.
// Google localizes its pages by where they are fetched from, so they are asked for in English (`hl=en`).
// - claude-models.json and gemini-models.json, kept by hand: which models the app lists, their names and efforts.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CLAUDE_PAGE_URL = "https://platform.claude.com/docs/en/build-with-claude/claude-models-on-google-cloud/google-managed.md";
const CLAUDE_PRICES_URL = "https://cloud.google.com/model-garden/partner-models/pricing?hl=en";
const GEMINI_PRICES_URL = "https://cloud.google.com/vertex-ai/generative-ai/pricing?hl=en";
const LOCATIONS_URL = "https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations?hl=en";

const here = import.meta.dirname;
const downloads = join(here, "downloads", "vertex");
const sources = join(here, "sources", "vertex");
const output = join(here, "..", "vertex.json");
const today = new Date().toISOString().slice(0, 10);

type Kind = "input" | "output" | "cacheRead" | "cacheWrite";
const KINDS: Kind[] = ["input", "output", "cacheRead", "cacheWrite"];
type KnownClaude = { name: string; efforts: string[]; thinking?: "adaptive" };
type KnownGemini = { id: string; name: string; efforts: string[]; onlyOn?: "ai-studio" | "vertex" };

// The excerpts' rows.
type ClaudePrice = { tab: string; model: string; type: string; usd: number };
type GeminiPrice = { model: string; type: string; region: string; price: string; cached: string };
type GeminiPlaces = { name: string; string: string; locations: string[] };

const CLAUDE_TYPES: Record<string, Kind> = { Input: "input", Output: "output", "Cache Hit": "cacheRead", "5m Cache Write": "cacheWrite" };

// ---- HTML, read with regular expressions: enough for these pages' tables.

function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

// An element's text: tags removed, a <br> as a space, whitespace collapsed.
function text(html: string): string {
  return decode(html.replace(/<br[^>]*>/g, " ").replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

type Cell = { attributes: string; text: string };
type Table = { start: number; rows: Cell[][] };

function tables(html: string): Table[] {
  return [...html.matchAll(/<table[\s\S]*?<\/table>/g)].map((t) => ({
    start: t.index,
    rows: [...t[0].matchAll(/<tr[\s\S]*?<\/tr>/g)].map((r) => [...r[0].matchAll(/<t([dh])([^>]*)>([\s\S]*?)<\/t\1>/g)].map((c) => ({ attributes: c[2], text: text(c[3]) }))),
  }));
}

// The label of the tab a table is in: the nearest tab panel opened before it, named by its tab button.
function tabOf(html: string, start: number): string | undefined {
  const panels = [...html.slice(0, start).matchAll(/role="tabpanel" aria-labelledby="([^"]+)"/g)];
  const id = panels.at(-1)?.[1];
  if (!id) return undefined;
  const button = [...html.matchAll(/<button[^>]*role="tab"[^>]*>/g)].map((b) => b[0]).find((b) => b.includes(`id="${id}"`));
  return /track-metadata-eventdetail="([^"]*)"/.exec(button ?? "")?.[1];
}

// ---- Downloads and excerpts.

async function download(): Promise<void> {
  mkdirSync(downloads, { recursive: true });
  for (const [url, file] of [
    [CLAUDE_PAGE_URL, "claude-models.md"],
    [CLAUDE_PRICES_URL, "partner-pricing.html"],
    [GEMINI_PRICES_URL, "pricing.html"],
    [LOCATIONS_URL, "locations.html"],
  ]) {
    const response = await fetch(url, { headers: { "Accept-Language": "en" } }); // Google localizes its pages otherwise
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    writeFileSync(join(downloads, file), Buffer.from(await response.arrayBuffer()));
    console.log(`Downloaded ${url}`);
  }
}

const header = (url: string, note: string) => JSON.stringify({ url, fetched: today, note });

function writeJsonl(file: string, head: string, rows: unknown[]): void {
  writeFileSync(join(sources, file), [head, ...rows.map((r) => JSON.stringify(r)), ""].join("\n"));
}

// The Claude models' strings: the rows of the table "API model IDs".
function excerptClaudeModels(): number {
  const lines = readFileSync(join(downloads, "claude-models.md"), "utf8")
    .split("\n")
    .filter((l) => /^\|\s*Claude [^|]*\|\s*`claude-[^`]+`\s*\|$/.test(l.trim()));
  if (lines.length === 0) throw new Error("Anthropic's table \"API model IDs\" wasn't found: its format changed.");
  writeFileSync(join(sources, "claude-models.md"), [`# ${CLAUDE_PAGE_URL}`, `# fetched ${today}; the table "API model IDs"`, "", ...lines.map((l) => l.trim()), ""].join("\n"));
  return lines.length;
}

// Claude's prices: per tab (a location), model and type, the short-context cell, the only one of the "=<" columns
// that has a price.
function excerptClaudePrices(): number {
  const html = readFileSync(join(downloads, "partner-pricing.html"), "utf8");
  const rows: ClaudePrice[] = [];
  for (const table of tables(html)) {
    const head = table.rows[0]?.map((c) => c.text) ?? [];
    if (head[0] !== "Model" || head[1] !== "Type") continue;
    const short = head.flatMap((h, i) => (/^Price \(\/1M tokens\) =< \d+K input tokens/.test(h) ? [i] : []));
    let model = "";
    for (const row of table.rows.slice(1)) {
      model = row[0]?.text || model;
      if (!/^(Claude )?(Opus|Sonnet|Haiku|Fable|Mythos) /.test(model)) break; // another partner's table
      const type = row[1]?.text ?? "";
      if (!CLAUDE_TYPES[type]) continue;
      const tab = tabOf(html, table.start);
      if (!tab) throw new Error(`${model}: its table isn't in a tab: the page's format changed.`);
      const cells = short.map((i) => row[i]?.text ?? "").filter((c) => c !== "");
      if (cells.length !== 1 || !/^\$[\d.]+$/.test(cells[0])) throw new Error(`${model}, ${type} (${tab}): not exactly one short-context price: ${JSON.stringify(cells)}.`);
      rows.push({ tab, model: model.startsWith("Claude ") ? model : `Claude ${model}`, type, usd: Number(cells[0].slice(1)) });
    }
  }
  if (rows.length === 0) throw new Error("No Claude prices found on the partner pricing page: its format changed.");
  writeJsonl("claude-prices.jsonl", header(CLAUDE_PRICES_URL, "per location tab, the Claude models' short-context Input, Output, 5m Cache Write and Cache Hit, per million tokens"), rows);
  return rows.length;
}

// Gemini's locations: every Gemini row of the section "Google model endpoint locations", with the locations marked
// as supported, merged across the tables (one per area).
function excerptLocations(): GeminiPlaces[] {
  const html = readFileSync(join(downloads, "locations.html"), "utf8");
  const from = html.indexOf('id="google-models"');
  const to = html.indexOf('id="genai-partner-models"');
  if (from < 0 || to < from) throw new Error("The locations page's section \"Google model endpoint locations\" wasn't found: its format changed.");
  const byString = new Map<string, GeminiPlaces>();
  for (const table of tables(html.slice(from, to))) {
    const columns = table.rows[0].map((c) => /\(([a-z0-9-]+)\)$/.exec(c.text)?.[1]);
    for (const row of table.rows.slice(1)) {
      const match = /^(.*) \((gemini-[a-z0-9.-]+)\)$/.exec(row[0]?.text ?? "");
      if (!match) continue;
      const entry = byString.get(match[2]) ?? { name: match[1], string: match[2], locations: [] };
      for (const [i, cell] of row.entries()) if (/\bcompare-yes\b/.test(cell.attributes) && columns[i]) entry.locations.push(columns[i]);
      byString.set(match[2], entry);
    }
  }
  const found = [...byString.values()];
  if (found.length === 0) throw new Error("No Gemini models found on the locations page: its format changed.");
  writeJsonl("locations.jsonl", header(LOCATIONS_URL, "every Gemini model of \"Google model endpoint locations\", with the locations marked as supported"), found);
  return found;
}

// A Gemini model's name as the pages spell it, for matching the pricing page's names with the locations page's.
const normal = (name: string) => name.toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ").trim();

// The names in a pricing table's model cell, without the dates and footnote marks: "Gemini 4 Argon (Starting December
// 1, 2026), Gemini 4 Argon Cyber Permissive" → both models.
function cellNames(cell: string): string[] {
  return cell
    .replace(/\*/g, " ")
    .replace(/\(?\s*(through|starting) \w+ \d+, \d{4}\s*\)?/gi, " ")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

// Gemini's prices: of the "Standard" tabs' tables, the rows of the models the app lists, with the short-context price
// and cached-input cells.
function excerptGeminiPrices(places: GeminiPlaces[]): number {
  const html = readFileSync(join(downloads, "pricing.html"), "utf8");
  const listed = new Set(Object.keys(geminiKnown().models));
  const names = new Set(places.filter((p) => listed.has(p.string)).map((p) => normal(p.name)));
  const rows: GeminiPrice[] = [];
  for (const table of tables(html)) {
    const head = table.rows[0]?.map((c) => c.text) ?? [];
    if (head[0] !== "Model" || head[1] !== "Type" || !/^Standard/.test(tabOf(html, table.start) ?? "")) continue;
    const short = head.flatMap((h, i) => (i >= 2 && /price/i.test(h) && !/>/.test(h) ? [i] : []));
    const cachedColumn = short.filter((i) => /cached/i.test(head[i]));
    const priceColumn = short.filter((i) => !/cached/i.test(head[i]));
    const regionColumn = head.indexOf("Region");
    let model = "";
    let type = "";
    for (const row of table.rows.slice(1)) {
      model = row[0]?.text || model;
      type = row[1]?.text || type;
      if (!cellNames(model).some((n) => names.has(normal(n)))) continue;
      if (priceColumn.length !== 1 || cachedColumn.length !== 1) throw new Error(`${model}: not exactly one short-context price and cached-input column in ${JSON.stringify(head)}.`);
      rows.push({ model, type, region: regionColumn >= 0 ? row[regionColumn]?.text ?? "" : "", price: row[priceColumn[0]]?.text ?? "", cached: row[cachedColumn[0]]?.text ?? "" });
    }
  }
  writeJsonl("gemini-prices.jsonl", header(GEMINI_PRICES_URL, "of the Standard tabs, the rows of the Gemini models the app lists: model, type, region, the short-context price and cached-input cells, per million tokens"), rows);
  return rows.length;
}

function excerpt(): void {
  mkdirSync(sources, { recursive: true });
  const claudeModels = excerptClaudeModels();
  const claudePrices = excerptClaudePrices();
  const places = excerptLocations();
  const geminiPrices = excerptGeminiPrices(places);
  console.log(`Excerpts: ${claudeModels} Claude models, ${claudePrices} Claude price rows, ${places.length} Gemini models' locations, ${geminiPrices} Gemini price rows.`);
}

// ---- Parsing the excerpts.

function claudeKnown(): Record<string, KnownClaude> {
  return (JSON.parse(readFileSync(join(here, "claude-models.json"), "utf8")) as { models: Record<string, KnownClaude> }).models;
}

function geminiKnown(): { models: Record<string, KnownGemini>; ignored: string[] } {
  return JSON.parse(readFileSync(join(here, "gemini-models.json"), "utf8"));
}

function readJsonl<T>(file: string): { fetched: string; rows: T[] } {
  const [head, ...lines] = readFileSync(join(sources, file), "utf8").trim().split("\n");
  return { fetched: (JSON.parse(head) as { fetched: string }).fetched, rows: lines.map((l) => JSON.parse(l) as T) };
}

// "Global" → global, "EU Multi-Region (EU)" → eu, "europe-west 1" → europe-west1.
function locationOfTab(tab: string): string {
  if (tab === "Global") return "global";
  const code = /\(([A-Z]{2})\)$/.exec(tab)?.[1];
  return code ? code.toLowerCase() : tab.replace(/\s+/g, "");
}

type Price = { model: string; region: string; routing: null; input: number; output: number; cacheRead: number; cacheWrite: number; source: string };
type Model = { id: string; name: string; family: "claude" | "gemini"; string: string; efforts: string[]; thinking?: "adaptive" };

function parseClaude(problems: string[], notes: string[]): { models: Model[]; prices: Price[] } {
  const known = claudeKnown();
  // "| Claude Opus 4.5 | `claude-opus-4-5@20251101` |", the name possibly followed by "([deprecated](…))".
  const strings = readFileSync(join(sources, "claude-models.md"), "utf8")
    .split("\n")
    .filter((l) => l.startsWith("| Claude"))
    .map((l) => {
      const [, name, string] = l.split("|").map((c) => c.trim());
      return { name: name.replace(/\s*\(.*\)\s*$/, ""), string: string.replace(/`/g, "") };
    });
  const { rows } = readJsonl<ClaudePrice>("claude-prices.jsonl");

  for (const name of new Set(rows.map((r) => r.model))) if (!strings.some((s) => s.name === name)) problems.push(`${name} has prices but isn't in Anthropic's table of model IDs: its string is unknown.`);
  const models: Model[] = [];
  const prices: Price[] = [];
  for (const { name, string } of strings) {
    const id = string.replace(/@\d+$/, "");
    if (!known[id]) {
      problems.push(`${id} (${name}) isn't in claude-models.json: decide whether the app lists it.`);
      continue;
    }
    const mine = rows.filter((r) => r.model === name);
    if (mine.length === 0) {
      notes.push(`${name}: on Anthropic's page, without prices on Google's: left out.`);
      continue;
    }
    for (const tab of new Set(mine.map((r) => r.tab))) {
      const four = KINDS.map((kind) => mine.filter((r) => r.tab === tab && CLAUDE_TYPES[r.type] === kind));
      // Google's tables have slips (a row missing, an output labelled input, a row twice): such a place is left out,
      // and printed for the spot-check, rather than guessed.
      if (four.some((f) => f.length !== 1)) {
        notes.push(`${name} at ${locationOfTab(tab)}: not exactly one price of each kind on the page (input, output, cache read, cache write: ${four.map((f) => f.length).join(", ")}): left out.`);
        continue;
      }
      const [input, output, cacheRead, cacheWrite] = four.map((f) => f[0].usd);
      prices.push({ model: id, region: locationOfTab(tab), routing: null, input, output, cacheRead, cacheWrite, source: `partner pricing page: tab "${tab}", ${name}` });
    }
    models.push({ id, name: known[id].name, family: "claude", string, efforts: known[id].efforts, ...(known[id].thinking ? { thinking: known[id].thinking } : {}) });
  }
  return { models, prices };
}

const usd = (cell: string) => (/^\$\d+(\.\d+)?$/.test(cell) ? Number(cell.slice(1)) : null);

function parseGemini(problems: string[], notes: string[]): { models: Model[]; prices: Price[] } {
  const { models: listed, ignored } = geminiKnown();
  const places = readJsonl<GeminiPlaces>("locations.jsonl").rows;
  const { rows } = readJsonl<GeminiPrice>("gemini-prices.jsonl");

  for (const p of places) if (!listed[p.string] && !ignored.includes(p.string)) problems.push(`${p.name} (${p.string}) is in neither list of gemini-models.json: decide whether the app lists it.`);
  for (const [string, k] of Object.entries(listed)) if (k.onlyOn !== "ai-studio" && !places.some((p) => p.string === string)) problems.push(`${string}: not on the locations page.`);

  const models: Model[] = [];
  const prices: Price[] = [];
  for (const place of places) {
    const k = listed[place.string];
    if (!k || k.onlyOn === "ai-studio") continue;
    // The model's rows, in groups by the date in their model cell; the latest group is the standard price.
    const mine = rows.filter((r) => cellNames(r.model).some((n) => normal(n) === normal(place.name)));
    const startOf = (r: GeminiPrice) => {
      const date = /starting (\w+ \d+, \d{4})/i.exec(r.model)?.[1];
      return date ? Date.parse(date) : null;
    };
    const starts = mine.map(startOf).filter((s) => s !== null);
    const latest = starts.length > 0 ? mine.filter((r) => startOf(r) === Math.max(...starts)) : mine.filter((r) => !/through \w+ \d+, \d{4}/i.test(r.model));
    const dropped = new Set(mine.filter((r) => !latest.includes(r)).map((r) => r.model));
    for (const cell of dropped) notes.push(`${k.id}: the prices of "${cell}" left out, the standard ones taken.`);
    for (const location of place.locations) {
      const region = location === "global" ? "Global" : "Non-global";
      const at = latest.filter((r) => r.region === "" || r.region.replace(/\*$/, "") === region);
      const input = at.filter((r) => /^Input \(text, image, video(, audio)?\)$/.test(r.type));
      const out = at.filter((r) => /^Text output/.test(r.type));
      if (input.length === 0 && out.length === 0) {
        notes.push(`${k.id} at ${location}: served there, no ${region.toLowerCase()} price: left out.`);
        continue;
      }
      if (input.length !== 1 || out.length !== 1) {
        notes.push(`${k.id} at ${location}: ${input.length} input and ${out.length} output rows on the page, not one each: left out.`);
        continue;
      }
      const values = [usd(input[0].price), usd(out[0].price), usd(input[0].cached)];
      if (values.some((v) => v === null)) {
        problems.push(`${k.id} at ${location}: a price not understood: ${JSON.stringify([input[0].price, out[0].price, input[0].cached])}.`);
        continue;
      }
      const [i, o, c] = values as number[];
      prices.push({ model: k.id, region: location, routing: null, input: i, output: o, cacheRead: c, cacheWrite: 0, source: `pricing page: ${input[0].model}, ${input[0].region || "every location"}` });
    }
    if (prices.some((p) => p.model === k.id)) models.push({ id: k.id, name: k.name, family: "gemini", string: place.string, efforts: k.efforts });
    else notes.push(`${k.id}: no price at any of its locations: left out.`);
  }
  return { models, prices };
}

// global, then the multi-regions, then the regions, each alphabetical.
function regionOrder(r: string): string {
  return `${r === "global" ? 0 : r.includes("-") ? 2 : 1} ${r}`;
}

function parse(): void {
  const fetched = readJsonl("claude-prices.jsonl").fetched;
  const problems: string[] = [];
  const notes: string[] = [];
  const claude = parseClaude(problems, notes);
  const gemini = parseGemini(problems, notes);
  if (problems.length > 0) {
    console.error(problems.map((p) => `  ${p}`).join("\n"));
    process.exit(1);
  }
  const prices = [...claude.prices, ...gemini.prices];
  const regions = [...new Set(prices.map((p) => p.region))].sort((a, b) => regionOrder(a).localeCompare(regionOrder(b)));
  const file = {
    $schema: "./schema.json",
    provider: "vertex",
    collectedAt: fetched,
    sources: [
      { url: CLAUDE_PAGE_URL, note: "the Claude models' strings: gather/sources/vertex/claude-models.md" },
      { url: CLAUDE_PRICES_URL, note: "the Claude models' locations and prices: gather/sources/vertex/claude-prices.jsonl" },
      { url: GEMINI_PRICES_URL, note: "the Gemini models' prices: gather/sources/vertex/gemini-prices.jsonl" },
      { url: LOCATIONS_URL, note: "the Gemini models' strings and locations: gather/sources/vertex/locations.jsonl" },
    ],
    models: [...claude.models, ...gemini.models],
    regions: regions.map((region) => ({ region, routings: null })),
    prices,
  };
  writeFileSync(output, JSON.stringify(file, null, 2) + "\n");
  console.log(`vertex.json: ${file.models.length} models, ${regions.length} locations, ${prices.length} prices.`);
  if (notes.length > 0) console.log(`Left out:\n${notes.map((n) => `  ${n}`).join("\n")}`);
}

if (process.argv.includes("--download")) {
  await download();
  excerpt();
}
parse();
