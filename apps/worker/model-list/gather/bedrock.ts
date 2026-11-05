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
// - Anthropic's page "Claude in Amazon Bedrock": the models on the Messages API endpoint the app uses, with their model
//   strings, and the regions with the routings each offers (Global; a geography: EU, US, JP, AU; In-region only).
// - claude-models.json, kept by hand: which models the app lists, their names, efforts and thinking.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PRICE_LIST_URL = "https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonBedrockFoundationModels/current/index.json";
const PAGE_URL = "https://platform.claude.com/docs/en/build-with-claude/claude-in-amazon-bedrock";

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

// The page as text, its tables as lines of cells separated by " | ".
function pageText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "")
    .replace(/<(tr|p|h[1-6]|li|br)[^>]*>/g, "\n")
    .replace(/<t[dh][^>]*>/g, " | ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\n\s*\n+/g, "\n");
}

async function download(): Promise<void> {
  mkdirSync(downloads, { recursive: true });
  for (const [url, file] of [
    [PRICE_LIST_URL, "price-list.json"],
    [PAGE_URL, "page.html"],
  ]) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    writeFileSync(join(downloads, file), Buffer.from(await response.arrayBuffer()));
    console.log(`Downloaded ${url}`);
  }
}

// From the downloads, what the parsing reads: the page's two tables (as text), and the price list's rows for the models
// of those tables, in the usage types kept. Each with where and when it was fetched.
function excerpt(): void {
  const text = pageText(readFileSync(join(downloads, "page.html"), "utf8"));
  const lines = text.split("\n");
  const models = lines.filter((l) => /\|\s*anthropic\.claude-[a-z0-9-]+\s*\|/.test(l));
  const regions = lines.filter((l) => /^\s*\|\s*[a-z]{2}(-gov)?-[a-z]+-\d\s*\|/.test(l));
  const global = lines.find((l) => /global endpoint is available for/i.test(l)) ?? "";
  if (models.length === 0 || regions.length === 0) throw new Error("The page's tables weren't found: its format changed.");
  mkdirSync(sources, { recursive: true });
  writeFileSync(
    join(sources, "page.txt"),
    [`# ${PAGE_URL}`, `# fetched ${today}; the tables "Supported models" and "Regions", as text`, "", ...models.map((l) => l.trim()), "", global.trim(), "", ...regions.map((l) => l.trim()), ""].join("\n"),
  );
  const names = new Set(models.map((l) => l.split("|")[1].replace(/\(.*\)/, "").trim()));
  const regionCodes = new Set(regions.map((l) => l.split("|")[1].trim()));
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
    [JSON.stringify({ url: PRICE_LIST_URL, fetched: today, publicationDate: list.publicationDate, note: "the on-demand, short-context rows of the models and regions on Anthropic's page, per million tokens" }), ...rows, ""].join("\n"),
  );
  console.log(`Excerpts: ${models.length} models and ${regions.length} regions from the page, ${rows.length} price rows.`);
}

function parse(): void {
  const known = (JSON.parse(readFileSync(join(here, "claude-models.json"), "utf8")) as { models: Record<string, Known> }).models;
  const page = readFileSync(join(sources, "page.txt"), "utf8").split("\n");
  const fetched = /fetched (\d{4}-\d{2}-\d{2})/.exec(page[1])?.[1] ?? today;
  const problems: string[] = [];

  // The models: "| Claude Opus 4.8 | anthropic.claude-opus-4-8 | Open"
  const models = page
    .filter((l) => /\|\s*anthropic\.claude-/.test(l))
    .map((l) => {
      const [, name, string] = l.split("|").map((c) => c.trim());
      const id = string.replace(/^anthropic\./, "");
      return { id, awsName: name.replace(/\(.*\)/, "").trim(), string };
    });
  for (const m of models) if (!known[m.id]) problems.push(`${m.id} (${m.awsName}) isn't in claude-models.json: decide whether the app lists it.`);

  // The regions: "| eu-central-1 | Europe (Frankfurt) | Global, EU"
  const regions = page
    .filter((l) => /^\|\s*[a-z]{2}(-gov)?-[a-z]+-\d\s*\|/.test(l))
    .map((l) => {
      const [, region, , types] = l.split("|").map((c) => c.trim());
      const names = types.split(",").map((t) => t.trim());
      const geography = names.find((t) => /^(EU|US|JP|AU)$/.test(t));
      const routings: Routing[] = [];
      if (names.includes("Global")) routings.push("global");
      if (geography) routings.push("geographic");
      if (names.some((t) => /in-region/i.test(t))) routings.push("in-region");
      return { region, routings, ...(geography ? { geography } : {}) };
    });

  // The models the global endpoint serves: "The global endpoint is available for Claude Fable 5.1, …, and Claude Haiku
  // 4.5." AWS prices some others globally too (the Mythos models); the page decides.
  const sentence = page.find((l) => /global endpoint is available for/i.test(l));
  if (!sentence) problems.push("The page's sentence on the global endpoint wasn't found: its format changed.");
  const globalNames = new Set(
    (sentence ?? "")
      .replace(/^.*available for /i, "")
      .split(/\.(?:\s|$)/)[0]
      .split(/,\s*(?:and\s+)?|\s+and\s+/)
      .map((n) => n.trim()),
  );

  // The prices.
  const [, ...rowLines] = readFileSync(join(sources, "price-list.jsonl"), "utf8").trim().split("\n");
  const rows: PriceRow[] = rowLines.map((l) => {
    const r = JSON.parse(l) as { model: string; region: string; inferenceType: string; usagetype: string; usd: number };
    return { model: r.model, region: r.region, kind: KINDS[r.inferenceType], global: /global/i.test(r.usagetype), usd: r.usd, usagetype: r.usagetype };
  });
  const prices: Record<string, unknown>[] = [];
  const listed = models.filter((m) => known[m.id]);
  for (const m of listed) {
    for (const r of regions) {
      for (const routing of r.routings) {
        const global = routing === "global";
        if (global && !globalNames.has(m.awsName)) continue;
        const found = (kind: Kind) => rows.filter((row) => row.model === m.awsName && row.region === r.region && row.kind === kind && row.global === global);
        const four = (["input", "output", "cacheRead", "cacheWrite"] as Kind[]).map(found);
        if (four.some((f) => f.length === 0)) continue; // not served there, or not with this routing
        for (const [i, f] of four.entries()) {
          if (new Set(f.map((row) => row.usd)).size > 1) problems.push(`${m.id} in ${r.region} (${routing}): two prices for ${["input", "output", "cache read", "cache write"][i]}.`);
        }
        prices.push({
          model: m.id,
          region: r.region,
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
  for (const m of listed) if (!priced.has(m.id)) problems.push(`${m.id}: no price at any of the page's regions.`);
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
      { url: PAGE_URL, note: "the models on the Messages API endpoint, their strings, the regions and routings: gather/sources/bedrock/page.txt" },
    ],
    models: listed.map((m) => ({
      id: m.id,
      name: known[m.id].name,
      family: "claude",
      string: m.string,
      efforts: known[m.id].efforts,
      ...(known[m.id].thinking ? { thinking: known[m.id].thinking } : {}),
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
