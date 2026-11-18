// What the gathering scripts share (gather/README.md): where each provider's files are, the download loop, the
// excerpts' heads, the models kept by hand, the provider file the scripts write, and the small readers of HTML and
// dates. Node only; run by hand before a release, checked by the typecheck and by `npm run model-list -- --check`.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { ProviderFile } from "../../src/llm/generateModelList.ts";
import type { Effort } from "@score3ly/core";
import type { Provider } from "../../src/llm/models.ts";

export type { ProviderFile };

const here = import.meta.dirname;

// A provider's folders and files: the whole downloads (not committed), the excerpts (committed), its JSON file.
export function paths(provider: Provider) {
  return {
    downloads: join(here, "downloads", provider),
    sources: join(here, "sources", provider),
    output: join(here, "..", `${provider}.json`),
  };
}

export const today = () => new Date().toISOString().slice(0, 10);

// The problems that stop a gathering: thrown, printed by the command.
export class GatherProblems extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(problems.map((p) => `  ${p}`).join("\n"));
    this.problems = problems;
  }
}

export function failOn(problems: string[]): void {
  if (problems.length > 0) throw new GatherProblems(problems);
}

// Downloads each URL into the provider's downloads, as `file`. `skip404`: a page that doesn't exist is left out (said).
export async function download(dir: string, files: [url: string, file: string][], init?: RequestInit & { skip404?: boolean }): Promise<void> {
  mkdirSync(dir, { recursive: true });
  for (const [url, file] of files) {
    const response = await fetch(url, init);
    if (init?.skip404 && response.status === 404) {
      console.log(`Not found: ${url}`);
      continue;
    }
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    writeFileSync(join(dir, file), Buffer.from(await response.arrayBuffer()));
    console.log(`Downloaded ${url}`);
  }
}

// ---- Excerpts.

// A JSON-lines excerpt: a head line (where and when it was fetched, and what it keeps), then one row per line.
export type ExcerptHead = { url: string; fetched: string; note: string; [more: string]: unknown };

export function writeJsonl(path: string, head: ExcerptHead, rows: unknown[]): void {
  writeFileSync(path, [JSON.stringify(head), ...rows.map((r) => JSON.stringify(r)), ""].join("\n"));
}

export function readJsonl<T>(path: string): { head: ExcerptHead; rows: T[] } {
  const [first, ...lines] = readFileSync(path, "utf8").trim().split("\n");
  const head = JSON.parse(first) as ExcerptHead;
  if (typeof head?.fetched !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(head.fetched)) throw new Error(`${path}: its first line doesn't say when it was fetched.`);
  return { head, rows: lines.map((l) => JSON.parse(l) as T) };
}

// The day a text excerpt was fetched, from its header line ("# fetched 2026-11-06; …"): never guessed.
export function fetchedOn(path: string, line: string | undefined): string {
  const day = /fetched (\d{4}-\d{2}-\d{2})/.exec(line ?? "")?.[1];
  if (!day) throw new Error(`${path}: its header doesn't say when it was fetched.`);
  return day;
}

// ---- The models kept by hand.

export type KnownClaude = { name: string; efforts: Effort[]; thinking?: "adaptive" };
export type KnownGemini = { id: string; name: string; efforts: Effort[]; onlyOn?: "ai-studio" | "vertex" };

// claude-models.json: by the app's id.
export function claudeModels(): Record<string, KnownClaude> {
  return (JSON.parse(readFileSync(join(here, "claude-models.json"), "utf8")) as { models: Record<string, KnownClaude> }).models;
}

// gemini-models.json: by the model string, and the strings decided not to be listed.
export function geminiModels(): { models: Record<string, KnownGemini>; ignored: string[] } {
  return JSON.parse(readFileSync(join(here, "gemini-models.json"), "utf8"));
}

// ---- The provider file.

// The file as it is written: the schema first, two spaces, a newline at the end.
export function providerFileText(file: ProviderFile): string {
  return JSON.stringify({ $schema: "./schema.json", ...file }, null, 2) + "\n";
}

// A gathering: the file parsed from the committed excerpts, and what to print beside it (left out, dated prices).
export type Gathered = { file: ProviderFile; notes: string[] };

// What a gathering script does as a command: with --download, fetch and cut the excerpts first; then parse them and
// write the file. Only when the script is run itself, not imported (the check imports the parsing).
export async function command(meta: ImportMeta, steps: { download: () => Promise<void>; excerpt: () => void; parse: () => Gathered; summary: (file: ProviderFile) => string }): Promise<void> {
  if (!process.argv[1] || pathToFileURL(process.argv[1]).href !== meta.url) return;
  const { parseArgs } = await import("node:util");
  try {
    if (parseArgs({ options: { download: { type: "boolean", default: false } } }).values.download) {
      await steps.download();
      steps.excerpt();
    }
    const { file, notes } = steps.parse();
    writeFileSync(paths(file.provider).output, providerFileText(file));
    console.log(steps.summary(file));
    for (const note of notes) console.log(note);
  } catch (err) {
    console.error(err instanceof GatherProblems ? err.message : err);
    process.exit(1);
  }
}

// ---- HTML, read with regular expressions: enough for these pages' tables.

export function decode(s: string): string {
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
export function text(html: string): string {
  return decode(html.replace(/<br[^>]*>/g, " ").replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

export type Cell = { attributes: string; text: string };
export type Table = { start: number; rows: Cell[][] };

export function tables(html: string): Table[] {
  return [...html.matchAll(/<table[\s\S]*?<\/table>/g)].map((t) => ({
    start: t.index,
    rows: [...t[0].matchAll(/<tr[\s\S]*?<\/tr>/g)].map((r) => [...r[0].matchAll(/<t([dh])([^>]*)>([\s\S]*?)<\/t\1>/g)].map((c) => ({ attributes: c[2], text: text(c[3]) }))),
  }));
}

// ---- Dates.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// "December 1, 2026" → "2026-12-01"
export function isoDay(date: string): string {
  const [, month, day, year] = /^(\w+) (\d+), (\d{4})$/.exec(date) ?? [];
  const m = MONTHS.indexOf(month);
  if (m < 0) throw new Error(`Not a date: "${date}"`);
  return `${year}-${String(m + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
}
