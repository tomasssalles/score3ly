// Step 1 of the list of models and prices for Bedrock (gather/README.md, "Bedrock"):
//
//   node model-list/gather/bedrock.ts --download   fetches the sources into gather/downloads/ (not committed), cuts
//                                                  the excerpts the parsing reads into gather/sources/bedrock/
//                                                  (committed), then parses them
//   node model-list/gather/bedrock.ts              parses the committed excerpts again
//
// and writes model-list/bedrock.json. Run from apps/worker. The parsing is expected to change from release to release:
// URLs move, formats change. What it reads:
// - AWS's price list for Bedrock's foundation models, a public JSON file of about 10 MB: each product has a `model`
//   ("Claude Opus 5.5"), a `regionCode`, an `inferenceType` (input, output, cache read, cache write) and a `usagetype`
//   that says the routing ("global" in it: global; else regional, the same price for geographic and in-region) and the
//   variants left out (batch, long context, the 1-hour cache write, reserved throughput); its price per million tokens
//   is under `terms.OnDemand`. Two spellings of the usage types exist ("InputTokenCount_Global", "input_tokens_global_standard").
// - AWS's model card of each model ("Models at a glance"), for `bedrock-runtime`, the endpoint the app uses: its model
//   ID and inference profile IDs (the base ID, to which the app adds the routing's prefix: "global.", "eu.", …), the
//   regions with the routings each offers (In-Region, Geo, Global), and each geography's source regions.
// - claude-models.json, kept by hand: which models the app lists, their names, efforts and thinking.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PRICE_LIST_URL = "https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonBedrockFoundationModels/current/index.json";
const cardUrl = (id: string) => `https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-${id}.html`;

const here = import.meta.dirname;
const downloads = join(here, "downloads", "bedrock");
const sources = join(here, "sources", "bedrock");
const output = join(here, "..", "bedrock.json");
const today = new Date().toISOString().slice(0, 10);

type Routing = "global" | "geographic" | "in-region";
type Kind = "input" | "output" | "cacheRead" | "cacheWrite";
type PriceRow = { model: string; region: string; kind: Kind; global: boolean; usd: number; usagetype: string };
type Known = { name: string; efforts: string[]; thinking?: "adaptive" };

const KINDS: Record<string, Kind> = {
  "Input tokens": "input",
  "Output tokens": "output",
  "Prompt cache read input tokens": "cacheRead",
  "Prompt cache write input tokens": "cacheWrite",
};

// The usage types the app is billed by: on demand, short context, the 5-minute cache write.
function kept(usagetype: string): boolean {
  return !/batch|long_?ctx|longcontext|_1h|1h|reserved|provisioned|flex|priority/i.test(usagetype);
}

const known = (): Record<string, Known> => (JSON.parse(readFileSync(join(here, "claude-models.json"), "utf8")) as { models: Record<string, Known> }).models;

async function download(): Promise<void> {
  mkdirSync(join(downloads, "cards"), { recursive: true });
  const files: [string, string][] = [[PRICE_LIST_URL, "price-list.json"], ...Object.keys(known()).map((id): [string, string] => [cardUrl(id), join("cards", `${id}.html`)])];
  for (const [url, file] of files) {
    const response = await fetch(url);
    if (response.status === 404) {
      console.log(`No model card: ${url}`);
      continue;
    }
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    writeFileSync(join(downloads, file), Buffer.from(await response.arrayBuffer()));
    console.log(`Downloaded ${url}`);
  }
}

type Card = { id: string; base: string; global: boolean; geos: Record<string, string[]>; regions: { region: string; inRegion: boolean; geo: boolean; global: boolean }[] };

const cellText = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const regionOf = (cell: string) => /^([a-z]{2}(?:-gov)?-[a-z]+-\d)\b/.exec(cellText(cell))?.[1];

// From a model card's HTML: the `bedrock-runtime` row of "Programmatic Access", the table "Availability using the
// bedrock-runtime endpoint", and the "Geo: …" sections with their source regions. Null when the card has no
// `bedrock-runtime` IDs.
function readCard(id: string, html: string): Card | null {
  const rows = (table: string) => [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1]));
  const access = rows(html).find((cells) => cells.length >= 5 && cellText(cells[0]) === "bedrock-runtime");
  if (!access) return null;
  const ids = [...cellText(access.join(" ")).matchAll(/\b(?:([a-z]{2,6})\.)?(anthropic\.claude-[a-z0-9.:-]+)/g)];
  if (ids.length === 0) return null;
  const bases = new Set(ids.map((m) => m[2]));
  if (bases.size !== 1) throw new Error(`${id}: more than one model ID on the card: ${[...bases].join(", ")}.`);
  const start = html.indexOf("Availability using the <code class=\"code\">bedrock-runtime");
  const stop = html.indexOf("Availability using the", start + 1);
  if (start < 0) return null;
  const yes = (cell: string) => /alt="supported"/.test(cell);
  const regions = rows(html.slice(start, stop < 0 ? undefined : stop))
    .filter((cells) => cells.length === 4 && regionOf(cells[0]))
    .map((cells) => ({ region: regionOf(cells[0])!, inRegion: yes(cells[1]), geo: yes(cells[2]), global: yes(cells[3]) }));
  const geos: Record<string, string[]> = {};
  // A geography is named by its profile's prefix ("eu.", "gov.", …), which the app sends; the heading ("Geo: US") can
  // be the same for two (US and GovCloud).
  for (const m of html.matchAll(/<b>Geo: [^<]*<\/b>([\s\S]*?)(?=<b>Geo: |<h\d|$)/g)) {
    const prefix = /inference ID:\s*<code[^>]*>([a-z-]+)\.anthropic\./i.exec(m[1])?.[1];
    if (!prefix) throw new Error(`${id}: a geography without its inference ID: the card's format changed.`);
    const regions = rows(m[1]).map((cells) => (cells[0] ? regionOf(cells[0]) : undefined)).filter((r): r is string => !!r);
    geos[prefix.toUpperCase()] = [...(geos[prefix.toUpperCase()] ?? []), ...regions];
  }
  return { id, base: [...bases][0], global: ids.some((m) => m[1] === "global"), geos, regions };
}

// From the downloads, what the parsing reads: each card's IDs, availability and geographies (as text lines), and the
// price list's rows for the listed models in those regions, in the usage types kept. Each with where and when it was fetched.
function excerpt(): void {
  const lines = [`# AWS's model cards, ${cardUrl("<id>")}; fetched ${today}; for bedrock-runtime: the model ID, the routings per region, the geographies' source regions`, ""];
  const regionCodes = new Set<string>();
  for (const id of Object.keys(known())) {
    let html: string;
    try {
      html = readFileSync(join(downloads, "cards", `${id}.html`), "utf8");
    } catch {
      continue;
    }
    const card = readCard(id, html);
    if (!card) {
      console.log(`${id}: its card has no IDs or availability for bedrock-runtime: not listed.`);
      continue;
    }
    lines.push(`## ${id} | ${card.base} | global: ${card.global ? "yes" : "no"}`);
    for (const r of card.regions) {
      regionCodes.add(r.region);
      lines.push(`| ${r.region} | in-region: ${r.inRegion ? "yes" : "no"} | geo: ${r.geo ? "yes" : "no"} | global: ${r.global ? "yes" : "no"}`);
    }
    for (const [geo, sources] of Object.entries(card.geos)) lines.push(`geo ${geo}: ${sources.join(", ")}`);
    lines.push("");
  }
  mkdirSync(sources, { recursive: true });
  writeFileSync(join(sources, "cards.txt"), lines.join("\n"));
  const names = new Set(Object.values(known()).map((k) => k.name));
  const list = JSON.parse(readFileSync(join(downloads, "price-list.json"), "utf8")) as {
    publicationDate: string;
    products: Record<string, { attributes: Record<string, string> }>;
    terms: { OnDemand: Record<string, Record<string, { priceDimensions: Record<string, { unit: string; pricePerUnit: { USD: string } }> }>> };
  };
  const rows: string[] = [];
  for (const [sku, product] of Object.entries(list.products)) {
    const a = product.attributes;
    if (!names.has(a.model) || !regionCodes.has(a.regionCode) || a.feature !== "On-demand Inference" || !KINDS[a.inferenceType] || !kept(a.usagetype)) continue;
    for (const offer of Object.values(list.terms.OnDemand[sku] ?? {})) {
      for (const dimension of Object.values(offer.priceDimensions)) {
        if (dimension.unit !== "1M tokens") continue;
        rows.push(JSON.stringify({ model: a.model, region: a.regionCode, inferenceType: a.inferenceType, usagetype: a.usagetype, usd: Number(dimension.pricePerUnit.USD) }));
      }
    }
  }
  rows.sort();
  writeFileSync(
    join(sources, "price-list.jsonl"),
    [JSON.stringify({ url: PRICE_LIST_URL, fetched: today, publicationDate: list.publicationDate, note: "the on-demand, short-context rows of the listed models in the cards' regions, per million tokens" }), ...rows, ""].join("\n"),
  );
  console.log(`Excerpts: ${lines.filter((l) => l.startsWith("## ")).length} model cards, ${regionCodes.size} regions, ${rows.length} price rows.`);
}

function parse(): void {
  const knownModels = known();
  const text = readFileSync(join(sources, "cards.txt"), "utf8").split("\n");
  const fetched = /fetched (\d{4}-\d{2}-\d{2})/.exec(text[0])?.[1] ?? today;
  const problems: string[] = [];

  // The cards: "## claude-opus-5-5 | anthropic.claude-opus-5-5 | global: yes", its regions
  // "| eu-central-1 | in-region: no | geo: yes | global: yes" and geographies "geo EU: eu-central-1, …".
  const cards: Card[] = [];
  for (const line of text) {
    const head = /^## (\S+) \| (\S+) \| global: (yes|no)$/.exec(line);
    if (head) cards.push({ id: head[1], base: head[2], global: head[3] === "yes", geos: {}, regions: [] });
    const row = /^\| (\S+) \| in-region: (yes|no) \| geo: (yes|no) \| global: (yes|no)$/.exec(line);
    if (row) cards.at(-1)!.regions.push({ region: row[1], inRegion: row[2] === "yes", geo: row[3] === "yes", global: row[4] === "yes" });
    const geo = /^geo (\S+): (.*)$/.exec(line);
    if (geo) cards.at(-1)!.geos[geo[1]] = geo[2].split(", ").filter(Boolean);
  }
  for (const c of cards) if (!knownModels[c.id]) problems.push(`${c.id} has a card but isn't in claude-models.json.`);

  // A region's geography, from the cards' geographies. A region can be a source of several (Tokyo: JP and APAC; Canada:
  // US and CA), but the list has one per region: the one most models offer there, then the first by name. The others
  // are left out, and printed. The EU's regions have only EU.
  const counts = new Map<string, Map<string, number>>();
  for (const c of cards) {
    for (const [geo, regions] of Object.entries(c.geos)) {
      for (const r of new Set(regions)) {
        if (!counts.has(r)) counts.set(r, new Map());
        counts.get(r)!.set(geo, (counts.get(r)!.get(geo) ?? 0) + 1);
      }
    }
  }
  const geographyOf = new Map<string, string>();
  for (const [region, byGeo] of counts) {
    const ranked = [...byGeo.entries()].sort(([a, x], [b, y]) => y - x || a.localeCompare(b));
    geographyOf.set(region, ranked[0][0]);
    if (ranked.length > 1) console.log(`  ${region}: geography ${ranked[0][0]}; left out: ${ranked.slice(1).map(([g]) => g).join(", ")}.`);
  }
  // Which routings a model has at a region: the card's table, a geographic one only where the model's profile for the
  // region's geography starts there.
  const routingsAt = (c: Card, region: string): Routing[] => {
    const r = c.regions.find((x) => x.region === region);
    if (!r) return [];
    const out: Routing[] = [];
    if (r.global && c.global) out.push("global");
    const geo = geographyOf.get(region);
    if (r.geo && geo && c.geos[geo]?.includes(region)) out.push("geographic");
    if (r.inRegion) out.push("in-region");
    return out;
  };
  const regionCodes = [...new Set(cards.flatMap((c) => c.regions.map((r) => r.region)))].sort();
  const models = cards.filter((c) => knownModels[c.id]).map((c) => ({ id: c.id, awsName: knownModels[c.id].name, string: c.base, card: c }));

  // The prices.
  const [, ...rowLines] = readFileSync(join(sources, "price-list.jsonl"), "utf8").trim().split("\n");
  const rows: PriceRow[] = rowLines.map((l) => {
    const r = JSON.parse(l) as { model: string; region: string; inferenceType: string; usagetype: string; usd: number };
    return { model: r.model, region: r.region, kind: KINDS[r.inferenceType], global: /global/i.test(r.usagetype), usd: r.usd, usagetype: r.usagetype };
  });
  const prices: Record<string, unknown>[] = [];
  const listed = models;
  const offered = new Map<string, Set<Routing>>(); // what some priced model offers at a region
  for (const m of listed) {
    for (const region of regionCodes) {
      for (const routing of routingsAt(m.card, region)) {
        const global = routing === "global";
        const found = (kind: Kind) => rows.filter((row) => row.model === m.awsName && row.region === region && row.kind === kind && row.global === global);
        const four = (["input", "output", "cacheRead", "cacheWrite"] as Kind[]).map(found);
        if (four.some((f) => f.length === 0)) continue; // not served there, or not with this routing
        for (const [i, f] of four.entries()) {
          if (new Set(f.map((row) => row.usd)).size > 1) problems.push(`${m.id} in ${region} (${routing}): two prices for ${["input", "output", "cache read", "cache write"][i]}.`);
        }
        if (!offered.has(region)) offered.set(region, new Set());
        offered.get(region)!.add(routing);
        prices.push({
          model: m.id,
          region,
          routing,
          input: four[0][0].usd,
          output: four[1][0].usd,
          cacheRead: four[2][0].usd,
          cacheWrite: four[3][0].usd,
          source: `price list: ${four.map((f) => f[0].usagetype).join(", ")}`,
        });
      }
    }
  }
  const priced = new Set(prices.map((p) => p.model));
  for (const m of listed) if (!priced.has(m.id)) problems.push(`${m.id}: no price at any of its card's regions.`);
  const ORDER: Routing[] = ["global", "geographic", "in-region"];
  const regions = [...offered.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([region, set]) => {
      const routings = ORDER.filter((r) => set.has(r));
      return { region, routings, ...(set.has("geographic") ? { geography: geographyOf.get(region)! } : {}) };
    });
  if (problems.length > 0) {
    console.error(problems.map((p) => `  ${p}`).join("\n"));
    process.exit(1);
  }

  const file = {
    $schema: "./schema.json",
    provider: "bedrock",
    collectedAt: fetched,
    sources: [
      { url: PRICE_LIST_URL, note: "the prices: gather/sources/bedrock/price-list.jsonl" },
      { url: cardUrl("<id>"), note: "the models on bedrock-runtime, their model IDs, the regions and routings: gather/sources/bedrock/cards.txt" },
    ],
    models: listed.map((m) => ({
      id: m.id,
      name: knownModels[m.id].name,
      family: "claude",
      string: m.string,
      efforts: knownModels[m.id].efforts,
      ...(knownModels[m.id].thinking ? { thinking: knownModels[m.id].thinking } : {}),
    })),
    regions,
    prices,
  };
  writeFileSync(output, JSON.stringify(file, null, 2) + "\n");
  console.log(`bedrock.json: ${listed.length} models, ${regions.length} regions, ${prices.length} prices.`);
}

if (process.argv.includes("--download")) {
  await download();
  excerpt();
}
parse();
