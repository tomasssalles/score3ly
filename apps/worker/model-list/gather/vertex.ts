// Step 1 of the list of models and prices for Vertex AI (gather/README.md, "Vertex AI"):
//
//   node model-list/gather/vertex.ts --download   fetches the sources into gather/downloads/ (not committed), cuts
//                                                 the excerpts the parsing reads into gather/sources/vertex/
//                                                 (committed), then parses them
//   node model-list/gather/vertex.ts              parses the committed excerpts again
//
// and writes model-list/vertex.json. Run from apps/worker. The parsing is expected to change from release to release:
// URLs move, formats change. What it reads, all public pages (no credentials):
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
// - gemini-models.json, kept by hand: which models the app lists, their names and efforts.
// Only Gemini: the app doesn't support Claude on Vertex AI (docs/llm.md, "Calling the providers").

import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { command, download as fetchAll, failOn, type Gathered, geminiModels, isoDay, paths, type ProviderFile, readJsonl, tables, today, writeJsonl } from "./common.ts";

const GEMINI_PRICES_URL = "https://cloud.google.com/vertex-ai/generative-ai/pricing?hl=en";
const LOCATIONS_URL = "https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations?hl=en";

const { downloads, sources } = paths("vertex");

// The excerpts' rows.
type GeminiPrice = { model: string; type: string; region: string; price: string; cached: string };
type GeminiPlaces = { name: string; string: string; locations: string[] };

// ---- HTML (common.ts reads the tables).

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
  await fetchAll(
    downloads,
    [
      [GEMINI_PRICES_URL, "pricing.html"],
      [LOCATIONS_URL, "locations.html"],
    ],
    { headers: { "Accept-Language": "en" } }, // Google localizes its pages otherwise
  );
}

const header = (url: string, note: string) => ({ url, fetched: today(), note });

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
  writeJsonl(join(sources, "locations.jsonl"), header(LOCATIONS_URL, "every Gemini model of \"Google model endpoint locations\", with the locations marked as supported"), found);
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
  const listed = new Set(Object.keys(geminiModels().models));
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
  writeJsonl(join(sources, "gemini-prices.jsonl"), header(GEMINI_PRICES_URL, "of the Standard tabs, the rows of the Gemini models the app lists: model, type, region, the short-context price and cached-input cells, per million tokens"), rows);
  return rows.length;
}

function excerpt(): void {
  mkdirSync(sources, { recursive: true });
  const places = excerptLocations();
  const geminiPrices = excerptGeminiPrices(places);
  console.log(`Excerpts: ${places.length} Gemini models' locations, ${geminiPrices} Gemini price rows.`);
}

// ---- Parsing the excerpts.

const readExcerpt = <T>(file: string) => readJsonl<T>(join(sources, file));

type Price = ProviderFile["prices"][number];
type Model = ProviderFile["models"][number];

const usd = (cell: string) => (/^\$\d+(\.\d+)?$/.test(cell) ? Number(cell.slice(1)) : null);

function parseGemini(problems: string[], notes: string[]): { models: Model[]; prices: Price[] } {
  const { models: listed, ignored } = geminiModels();
  const places = readExcerpt<GeminiPlaces>("locations.jsonl").rows;
  const { rows } = readExcerpt<GeminiPrice>("gemini-prices.jsonl");

  for (const p of places) if (!listed[p.string] && !ignored.includes(p.string)) problems.push(`${p.name} (${p.string}) is in neither list of gemini-models.json: decide whether the app lists it.`);
  for (const [string, k] of Object.entries(listed)) if (k.onlyOn !== "ai-studio" && !places.some((p) => p.string === string)) problems.push(`${string}: not on the locations page.`);
  // A model marked as AI Studio's only that this page has: the mark is out of date.
  for (const [string, k] of Object.entries(listed)) if (k.onlyOn === "ai-studio" && places.some((p) => p.string === string)) problems.push(`${string}: marked onlyOn "ai-studio" in gemini-models.json, but on the locations page: check it and remove the mark.`);

  const models: Model[] = [];
  const prices: Price[] = [];
  for (const place of places) {
    const k = listed[place.string];
    if (!k || k.onlyOn === "ai-studio") continue;
    // The model's rows, in groups by the date in their model cell; the latest group is the standard price.
    const mine = rows.filter((r) => cellNames(r.model).some((n) => normal(n) === normal(place.name)));
    const startOf = (r: GeminiPrice) => {
      const date = /starting (\w+ \d+, \d{4})/i.exec(r.model)?.[1];
      return date ? isoDay(date) : null;
    };
    const starts = mine.map(startOf).filter((s) => s !== null).sort();
    const latest = starts.length > 0 ? mine.filter((r) => startOf(r) === starts.at(-1)) : mine.filter((r) => !/through \w+ \d+, \d{4}/i.test(r.model));
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

export function parse(): Gathered {
  const fetched = readExcerpt("gemini-prices.jsonl").head.fetched;
  const problems: string[] = [];
  const notes: string[] = [];
  const gemini = parseGemini(problems, notes);
  failOn(problems);
  const prices = gemini.prices;
  const regions = [...new Set(prices.map((p) => p.region))].sort((a, b) => regionOrder(a).localeCompare(regionOrder(b)));
  const file = {
    provider: "vertex",
    collectedAt: fetched,
    sources: [
      { url: GEMINI_PRICES_URL, note: "the Gemini models' prices: gather/sources/vertex/gemini-prices.jsonl" },
      { url: LOCATIONS_URL, note: "the Gemini models' strings and locations: gather/sources/vertex/locations.jsonl" },
    ],
    models: gemini.models,
    regions: regions.map((region) => ({ region, routings: null })),
    prices,
  } satisfies ProviderFile;
  return { file, notes: notes.length > 0 ? [`Left out:\n${notes.map((n) => `  ${n}`).join("\n")}`] : [] };
}

await command(import.meta, {
  download,
  excerpt,
  parse,
  summary: (file) => `vertex.json: ${file.models.length} models, ${file.regions.length} locations, ${file.prices.length} prices.`,
});
