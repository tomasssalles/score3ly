// Step 1 of the list of models for OpenRouter (gather/README.md, "OpenRouter"):
//
//   node model-list/gather/openrouter.ts --download   fetches the sources into gather/downloads/ (not committed), cuts
//                                                     the excerpt the parsing reads into gather/sources/openrouter/
//                                                     (committed), then parses it
//   node model-list/gather/openrouter.ts              parses the committed excerpt again
//
// and writes model-list/openrouter.json. Run from apps/worker. OpenRouter prices each call itself (its answers say
// what they cost: docs/llm.md, "Priced by the provider"), so the list has no prices for it, only where it offers each
// model: everywhere (region "") and, for the models its EU host serves, in the EU ("eu", a Business account). What it
// reads:
// - OpenRouter's models API on both hosts (https://openrouter.ai/api/v1/models and https://eu.openrouter.ai/api/v1/models),
//   public: each model's id ("anthropic/claude-opus-5.5"), the model string the app sends.
// - claude-models.json and gemini-models.json, kept by hand: which models the app lists, their ids, names and efforts.
//   A listed model's OpenRouter id is its family's prefix ("anthropic/", "google/") and Anthropic's or Google's own
//   model ID, with a version's last dash as a dot for Claude ("claude-opus-5-5" → "claude-opus-5.5"). A listed model
//   OpenRouter doesn't have isn't offered there; OpenRouter's other models are left out.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const HOSTS = { "": "https://openrouter.ai/api/v1/models", eu: "https://eu.openrouter.ai/api/v1/models" } as const;

const here = import.meta.dirname;
const downloads = join(here, "downloads", "openrouter");
const sources = join(here, "sources", "openrouter");
const output = join(here, "..", "openrouter.json");
const today = new Date().toISOString().slice(0, 10);

type Known = { id: string; name: string; family: "claude" | "gemini"; efforts: string[]; thinking?: "adaptive"; string: string };

// The models the app lists, each with the id OpenRouter would give it.
function known(): Known[] {
  const claude = (JSON.parse(readFileSync(join(here, "claude-models.json"), "utf8")) as { models: Record<string, { name: string; efforts: string[]; thinking?: "adaptive" }> }).models;
  const gemini = (JSON.parse(readFileSync(join(here, "gemini-models.json"), "utf8")) as { models: Record<string, { id: string; name: string; efforts: string[] }> }).models;
  return [
    ...Object.entries(claude).map(([id, m]) => ({ id, name: m.name, family: "claude" as const, efforts: m.efforts, ...(m.thinking ? { thinking: m.thinking } : {}), string: `anthropic/${id.replace(/-(\d+)-(\d+)$/, "-$1.$2")}` })),
    ...Object.entries(gemini).map(([string, m]) => ({ id: m.id, name: m.name, family: "gemini" as const, efforts: m.efforts, string: `google/${string}` })),
  ];
}

async function download(): Promise<void> {
  mkdirSync(downloads, { recursive: true });
  for (const [region, url] of Object.entries(HOSTS)) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    writeFileSync(join(downloads, `models${region ? `-${region}` : ""}.json`), Buffer.from(await response.arrayBuffer()));
    console.log(`Downloaded ${url}`);
  }
}

// From the downloads, what the parsing reads: the ids of the Anthropic and Google models on each host.
function excerpt(): void {
  const lines = [`# OpenRouter's models API (${Object.values(HOSTS).join(", ")}); fetched ${today}; the ids of the anthropic/ and google/ models, per host ("" everywhere, "eu" the EU host)`];
  for (const region of Object.keys(HOSTS)) {
    const data = (JSON.parse(readFileSync(join(downloads, `models${region ? `-${region}` : ""}.json`), "utf8")) as { data: { id: string }[] }).data;
    const ids = data.map((m) => m.id).filter((id) => /^(anthropic|google)\//.test(id)).sort();
    if (ids.length === 0) throw new Error(`No Anthropic or Google models on the ${region || "global"} host: its format changed.`);
    lines.push(`${region || '""'}: ${ids.join(" ")}`);
  }
  mkdirSync(sources, { recursive: true });
  writeFileSync(join(sources, "models.txt"), lines.join("\n") + "\n");
  console.log(`Excerpt: ${lines.length - 1} hosts.`);
}

function parse(): void {
  const text = readFileSync(join(sources, "models.txt"), "utf8").split("\n");
  const fetched = /fetched (\d{4}-\d{2}-\d{2})/.exec(text[0])?.[1] ?? today;
  const offered = new Map<string, Set<string>>(); // region → ids
  for (const line of text.slice(1).filter(Boolean)) {
    const [region, ids] = line.split(": ");
    offered.set(region === '""' ? "" : region, new Set(ids.split(" ")));
  }
  const models = known().filter((m) => offered.get("")?.has(m.string) || offered.get("eu")?.has(m.string));
  const regions = Object.keys(HOSTS);
  const file = {
    $schema: "./schema.json",
    provider: "openrouter",
    collectedAt: fetched,
    sources: [{ url: HOSTS[""], note: "the models offered everywhere, and on the EU host, " + HOSTS.eu + ": gather/sources/openrouter/models.txt" }],
    models: models.map((m) => ({ id: m.id, name: m.name, family: m.family, string: m.string, efforts: m.efforts, ...(m.thinking ? { thinking: m.thinking } : {}) })),
    regions: regions.map((region) => ({ region, routings: null })),
    prices: models.flatMap((m) =>
      regions.filter((region) => offered.get(region)?.has(m.string)).map((region) => ({ model: m.id, region, routing: null, source: `models API${region ? ` (${region})` : ""}: ${m.string}` })),
    ),
  };
  writeFileSync(output, JSON.stringify(file, null, 2) + "\n");
  console.log(`openrouter.json: ${models.length} models, ${file.prices.filter((p) => p.region === "eu").length} of them in the EU.`);
}

if (process.argv.includes("--download")) {
  await download();
  excerpt();
}
parse();
