// Step 1 of the list of models and prices for Google AI Studio (gather/README.md, "Google AI Studio"):
//
//   node model-list/gather/ai-studio.ts --download   fetches the source into gather/downloads/ (not committed), cuts
//                                                    the excerpt the parsing reads into gather/sources/ai-studio/
//                                                    (committed), then parses it
//   node model-list/gather/ai-studio.ts              parses the committed excerpt again
//
// and writes model-list/ai-studio.json. Run from apps/worker. The parsing is expected to change from release to release:
// URLs move, formats change. What it reads:
// - Google's page "Gemini Developer API pricing", in its Markdown (Markdoc) version: one section ("## …") per model or
//   group of models, its model strings as links ("[`gemini-4-argon`](…)", the first one naming the section), and tabs
//   per service tier. Of the "Standard" tab, the paid tier's input, output and context caching prices per million
//   tokens. A price cell may hold several lines: dated prices ("$2.00 through November 30, 2026." and "$4.00 starting
//   December 1, 2026."), the one valid on the day of the gathering is taken and the later ones printed (decided
//   2026-11-06); prices for prompts over 200k tokens (left out: short-context prices only); audio input (left out: we
//   send text and images); the storage price of explicit caching (left out: only implicit caching is used, which has no
//   write price, so cacheWrite is 0). The free tier is left out: it is a config's pricing kind, not the list's.
// - gemini-models.json, kept by hand: which models the app lists, their ids, names and efforts, and which are ignored.

import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { command, download as fetchAll, failOn, type Gathered, geminiModels, isoDay, type KnownGemini as Known, paths, type ProviderFile, readJsonl, today, writeJsonl } from "./common.ts";

const PAGE_URL = "https://ai.google.dev/gemini-api/docs/pricing.md.txt";

const { downloads, sources } = paths("ai-studio");

type Kind = "input" | "output" | "cacheRead";
type Section = { heading: string; strings: string[]; cells?: Record<Kind, string> };

// The rows of the price table the parsing reads, by their labels.
const ROWS: Record<Kind, RegExp> = {
  input: /^Input price/,
  output: /^Output price/,
  cacheRead: /^Context caching price$/,
};

// The page's model sections: a section's heading, its model strings, and, for the models the app lists, the paid
// tier's cells of the Standard tab, as text.
function sections(page: string, listed: Record<string, Known>): Section[] {
  const result: Section[] = [];
  for (const section of page.split(/\n(?=## )/)) {
    const strings = [...section.matchAll(/\[`([^`]+)`\]/g)].map((m) => m[1]);
    if (strings.length === 0) continue; // not a model: tools, agents, notes
    const heading = section.split("\n")[0].replace(/\s*\{%.*%\}\s*$/, "").replace(/^##\s*/, "");
    if (!listed[strings[0]]) {
      result.push({ heading, strings });
      continue;
    }
    const standard = /\{% tab title="Standard" %\}([\s\S]*?)\{% \/tab %\}/.exec(section)?.[1];
    if (!standard) throw new Error(`${heading}: no Standard tab: the page's format changed.`);
    const cells: Partial<Record<Kind, string>> = {};
    for (const row of standard.split(/\n\s*---\s*\n/)) {
      // "* Input price\n  * Free of charge\n  * $0.75 through …\n  $1.50 starting …": the label, the free tier, the paid tier.
      const items = row.trim().split(/\n\s*\* /).map((item) => item.replace(/^\* /, "").trim());
      for (const [kind, label] of Object.entries(ROWS) as [Kind, RegExp][]) if (label.test(items[0]) && items.length >= 3) cells[kind] = items.slice(2).join("\n");
    }
    for (const kind of Object.keys(ROWS) as Kind[]) if (!cells[kind]) throw new Error(`${heading}: no row "${ROWS[kind].source}" in the Standard tab: the page's format changed.`);
    result.push({ heading, strings, cells: cells as Record<Kind, string> });
  }
  return result;
}

async function download(): Promise<void> {
  await fetchAll(downloads, [[PAGE_URL, "pricing.md"]]);
}

// From the download, what the parsing reads: every model section's heading and strings, and the price cells of the
// models the app lists, with where and when it was fetched.
function excerpt(): void {
  const found = sections(readFileSync(join(downloads, "pricing.md"), "utf8"), geminiModels().models);
  mkdirSync(sources, { recursive: true });
  writeJsonl(
    join(sources, "pricing.jsonl"),
    { url: PAGE_URL, fetched: today(), note: "every model section's heading and model strings; for the models the app lists, the paid tier's cells of the Standard tab" },
    found,
  );
  console.log(`Excerpt: ${found.length} model sections, ${found.filter((s) => s.cells).length} with prices.`);
}

// What a price line may say besides its price and dates: the media it applies to, or the short-context threshold.
const ALLOWED_TAIL = /^(\((text \/ image \/ video)( \/ audio)?\)|, prompts <= 200k( tokens)?)?\.?$/;

// One cell's price on the given day, and the dated changes after it.
function price(cell: string, day: string): { usd: number | null; later: string[]; problem?: string } {
  const lines = cell
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/storage price|Implicit caching only|prompts > 200k|^\(?\$[\d.]+ \(audio\)$|^\*Same as Standard\*$/.test(l));
  const valid: number[] = [];
  const later: string[] = [];
  for (const line of lines) {
    const match = /^\$(\d+(?:\.\d+)?)\s*(.*)$/.exec(line);
    if (!match) return { usd: null, later, problem: `a line that isn't a price: "${line}"` };
    const usd = Number(match[1]);
    let tail = match[2];
    const through = /\s*through (\w+ \d+, \d{4})/.exec(tail);
    const starting = /\s*starting (\w+ \d+, \d{4})/.exec(tail);
    tail = tail.replace(/\s*(through|starting) \w+ \d+, \d{4}/, "").trim();
    if (!ALLOWED_TAIL.test(tail)) return { usd: null, later, problem: `a price line not understood: "${line}"` };
    if (starting && isoDay(starting[1]) > day) later.push(`$${usd} from ${isoDay(starting[1])}`);
    else if (!through || day <= isoDay(through[1])) valid.push(usd);
  }
  if (valid.length !== 1) return { usd: null, later, problem: `${valid.length} prices valid on ${day} in "${cell.replace(/\s+/g, " ")}"` };
  return { usd: valid[0], later };
}

export function parse(): Gathered {
  const { models: listed, ignored } = geminiModels();
  const { head, rows: found } = readJsonl<Section>(join(sources, "pricing.jsonl"));
  const fetched = head.fetched;
  const problems: string[] = [];
  const changes: string[] = [];

  for (const s of found) if (!listed[s.strings[0]] && !ignored.includes(s.strings[0])) problems.push(`${s.heading} (${s.strings[0]}) is in neither list of gemini-models.json: decide whether the app lists it.`);
  for (const [string, k] of Object.entries(listed)) if (k.onlyOn !== "vertex" && !found.some((s) => s.strings[0] === string)) problems.push(`${string}: not on the pricing page.`);
  // A model marked as Vertex AI's only that this page has: the mark is out of date.
  for (const [string, k] of Object.entries(listed)) if (k.onlyOn === "vertex" && found.some((s) => s.strings[0] === string)) problems.push(`${string}: marked onlyOn "vertex" in gemini-models.json, but on the pricing page: check it and remove the mark.`);

  const models: { string: string; known: Known }[] = [];
  const prices: ProviderFile["prices"] = [];
  for (const s of found) {
    if (!s.cells) continue;
    const k = listed[s.strings[0]];
    const p = Object.fromEntries((Object.keys(ROWS) as Kind[]).map((kind) => [kind, price(s.cells![kind], fetched)])) as Record<Kind, ReturnType<typeof price>>;
    for (const [kind, r] of Object.entries(p)) {
      if (r.problem) problems.push(`${k.id}, ${kind}: ${r.problem}.`);
      for (const change of r.later) changes.push(`${k.id}, ${kind}: ${change}`);
    }
    if (Object.values(p).some((r) => r.usd === null)) continue;
    models.push({ string: s.strings[0], known: k });
    prices.push({ model: k.id, region: "", routing: null, input: p.input.usd!, output: p.output.usd!, cacheRead: p.cacheRead.usd!, cacheWrite: 0, source: `pricing page: ${s.heading}, Standard, paid tier` });
  }
  failOn(problems);

  const file = {
    provider: "ai-studio",
    collectedAt: fetched,
    sources: [{ url: PAGE_URL, note: "the models, their strings and prices: gather/sources/ai-studio/pricing.jsonl" }],
    models: models.map((m) => ({ id: m.known.id, name: m.known.name, family: "gemini" as const, string: m.string, efforts: m.known.efforts })),
    regions: [{ region: "", routings: null }],
    prices,
  } satisfies ProviderFile;
  const notes = changes.length > 0 ? [`Prices that change after ${fetched} (the list has the current ones; note them in docs/tasks.md):\n${changes.map((c) => `  ${c}`).join("\n")}`] : [];
  return { file, notes };
}

await command(import.meta, { download, excerpt, parse, summary: (file) => `ai-studio.json: ${file.models.length} models, ${file.prices.length} prices.` });
