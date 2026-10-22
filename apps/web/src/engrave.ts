// The `engrave` step (DESIGN.md §6): the last stage, always. It builds the full score's MEI from the latest extraction
// (the systems' stored answers, their layout, where the pieces start) and the metadata, and stores it: the file a user
// downloads. The engraving (Verovio's pages, the PDF) is made from the same sources and the config when it is needed,
// never stored. What doesn't need the browser is here; the runner is runEngrave.ts, the views EngravingView.tsx.

import { buildScore, meiString, type MeiMetadata, type Score } from "@score3ly/notation";
import { REPOSITORY_URL } from "./about.ts";
import type { ApiStage } from "./api";
import type { StoredExtraction } from "./extract.ts";
import { normalizeMetadata } from "./fixMetadata.ts";
import { keyOf } from "./keys.ts";
import type { PageLayout } from "./layout";
import { indexMei } from "./meiView.ts";
import { pageOfItem } from "./rasterize.ts";

export const ENGRAVE_VERSION = 1;

// The page size. The engraving always has Verovio's own breaks (DESIGN.md §6, `engrave`).
export type EngraveConfig = { pageSize: "a4" | "letter" };

export const DEFAULT_ENGRAVE_CONFIG: EngraveConfig = { pageSize: "a4" };

// Page sizes in millimetres (Verovio counts tenths of them).
export const PAGE_SIZES = {
  a4: { label: "A4", width: 210, height: 297 },
  letter: { label: "US Letter", width: 215.9, height: 279.4 },
} as const;

export function engraveConfigOf(stored: Record<string, unknown> | null): EngraveConfig {
  const pageSize = stored?.pageSize === "a4" || stored?.pageSize === "letter" ? stored.pageSize : DEFAULT_ENGRAVE_CONFIG.pageSize;
  return { pageSize };
}

// What `engrave` is built from: the latest extraction's systems, the latest layout's pages, the latest metadata and
// pieces before it. Null where something is missing (the stage can't run yet).
export type EngraveSources = {
  extractions: { id: string; item: string; sha256: string }[];
  layouts: { id: string; page: number; sha256: string }[];
  metadata: { id: string; sha256: string };
  pieces: { id: string; sha256: string };
};

// The steps whose stages produce the extraction `engrave` reads; `fix_mei` is offered after the latest (§6).
export const EXTRACTION_STEPS = ["extract"]; // `apply_review` too, once it exists
const LAYOUT_STEPS = ["layout", "fix_layout"];
const METADATA_STEPS = ["fix_metadata", "analyze"];

export function engraveSources(earlier: ApiStage[]): EngraveSources | { missing: string } {
  const latest = [...earlier].reverse();
  const extraction = latest.find((s) => EXTRACTION_STEPS.includes(s.step));
  if (!extraction || extraction.status !== "done") return { missing: "the music hasn't been extracted yet." };
  const layout = latest.find((s) => LAYOUT_STEPS.includes(s.step));
  const withOutput = (type: string) => {
    const stage = latest.find((s) => METADATA_STEPS.includes(s.step) && s.outputs.some((o) => o.item === "" && o.type === type && o.contentSha256));
    const output = stage?.outputs.find((o) => o.item === "" && o.type === type && o.contentSha256);
    return stage && output && stage.status === "done" ? { id: output.id, sha256: output.contentSha256! } : null;
  };
  const metadata = withOutput("metadata");
  const pieces = withOutput("pieces");
  if (!layout || !metadata || !pieces) return { missing: "the score hasn't been analysed yet." };
  return {
    extractions: extraction.outputs
      .filter((o) => o.type === "extraction" && o.contentSha256)
      .map((o) => ({ id: o.id, item: o.item, sha256: o.contentSha256! })),
    layouts: layout.outputs
      .filter((o) => o.type === "layout" && o.contentSha256)
      .map((o) => ({ id: o.id, page: pageOfItem(o.item) ?? 0, sha256: o.contentSha256! })),
    metadata,
    pieces,
  };
}

// What `engrave` reads: the sources it builds the MEI from, or, when `fix_mei` comes right before it, that
// stage's MEI, taken as it is.
export type EngraveInput = { built: EngraveSources } | { edited: { id: string; sha256: string } };

export function engraveInput(earlier: ApiStage[]): EngraveInput | { missing: string } {
  const last = earlier.at(-1);
  if (last?.step === "fix_mei") {
    const mei = last.outputs.find((o) => o.item === "" && o.type === "mei" && o.contentSha256);
    if (last.status !== "done" || !mei) return { missing: "\"Fix MEI\" isn't finished yet." };
    return { edited: { id: mei.id, sha256: mei.contentSha256! } };
  }
  const sources = engraveSources(earlier);
  return "missing" in sources ? sources : { built: sources };
}

export const sourceIds = (sources: EngraveSources): string[] => [
  ...sources.extractions.map((e) => e.id),
  ...sources.layouts.map((l) => l.id),
  sources.metadata.id,
  sources.pieces.id,
];

// The stage key (§5.2): the step, its version, the MEI builder's (the format's) version, the config, and the content of
// what it reads (with `fix_mei`'s MEI, that file).
export function engraveStageKey(config: EngraveConfig, input: EngraveInput, lensVersion: number): Promise<string> {
  if ("edited" in input) return keyOf({ step: "engrave", version: ENGRAVE_VERSION, config, mei: input.edited.sha256 });
  const sources = input.built;
  return keyOf({
    step: "engrave",
    version: ENGRAVE_VERSION,
    lensVersion,
    config,
    extractions: sources.extractions.map((e) => [e.item, e.sha256]),
    layouts: sources.layouts.map((l) => [l.page, l.sha256]),
    metadata: sources.metadata.sha256,
    pieces: sources.pieces.sha256,
  });
}

// The score and the metadata, from the sources' content (fetched by `fetch`).
export async function loadScore(sources: EngraveSources, fetch: (sha256: string) => Promise<unknown>): Promise<{ score: Score; metadata: MeiMetadata }> {
  const [extractions, layouts, metadata, pieces] = await Promise.all([
    Promise.all(sources.extractions.map(async (e) => ({ item: e.item, extraction: (await fetch(e.sha256)) as StoredExtraction }))),
    Promise.all(sources.layouts.map(async (l) => [l.page, (await fetch(l.sha256)) as PageLayout] as const)).then((l) => new Map(l)),
    fetch(sources.metadata.sha256),
    fetch(sources.pieces.sha256) as Promise<number[]>,
  ]);
  const systems = extractions.map(({ item, extraction }) => {
    const index = Number(item.split("/s")[1] ?? 1);
    const layout = layouts.get(extraction.page)?.systems[index - 1];
    return { number: extraction.system, page: extraction.page, box: layout?.box ?? null, barLines: layout?.barLines ?? [], answer: extraction.answer };
  });
  if (systems.length === 0) throw new Error("There are no systems to engrave.");
  return { score: buildScore(systems, pieces), metadata: meiMetadata(metadata) };
}

// The full score's MEI as `engrave` stores it: the file, with how it was made.
export function meiText(score: Score, metadata: MeiMetadata): string {
  return meiString(score, { metadata, application: { name: "score3ly", version: __APP_VERSION__, url: REPOSITORY_URL } });
}

// The stored metadata (`analyze`'s or `fix_metadata`'s) as the MEI header takes it: without pages and confidences.
export function meiMetadata(stored: unknown): MeiMetadata {
  const m = normalizeMetadata(stored);
  const texts = (list: { text: string }[]) => list.map((t) => ({ text: t.text }));
  return {
    titles: m.titles.map((t) => ({ text: t.text, type: t.type })),
    people: m.people.map((p) => ({ name: p.name, role: p.role })),
    pieces: m.pieces.map((p) => ({ title: p.title, system: p.system })),
    catalogueNumbers: texts(m.catalogueNumbers),
    dedications: texts(m.dedications),
    instrumentation: texts(m.instrumentation),
    compositionDates: texts(m.compositionDates),
    publishers: texts(m.publishers),
    places: texts(m.places),
    dates: texts(m.dates),
    plateNumbers: texts(m.plateNumbers),
    notices: texts(m.notices),
    comments: texts(m.comments),
  };
}

// The card's short result, e.g. "96 measures" or "13 pieces · 412 measures".
export function engraveNote(score: Score): string {
  const measures = score.pieces.reduce((n, p) => n + p.measures.reduce((k, m) => k + m.count, 0), 0);
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  return [...(score.pieces.length > 1 ? [plural(score.pieces.length, "piece")] : []), plural(measures, "measure")].join(" · ");
}

// The same for an MEI file edited by hand (`fix_mei`): its pieces (`mdiv`) and measures (`measure @n`, a
// multi-measure rest's range counting each, a measure divided by a bar line inside it once).
export function meiNote(text: string): string {
  const index = indexMei(text.split("\n"));
  const numbers = new Set<string>();
  for (const m of index.measures) {
    const [from, to = from] = m.n.split("–").map(Number);
    if (!Number.isInteger(from) || !Number.isInteger(to)) numbers.add(`${m.piece}/line ${m.line}`); // a number edited away
    else for (let n = from; n <= to; n++) numbers.add(`${m.piece}/${n}`);
  }
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  return [...(index.pieces.length > 1 ? [plural(index.pieces.length, "piece")] : []), plural(numbers.size, "measure")].join(" · ");
}

// A file name from the project's name: what a file system would refuse is replaced.
export function downloadName(projectName: string, extension: "mei" | "pdf" | "zip" | "report.json"): string {
  const base = projectName.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").trim() || "score";
  return `${base}.s3l.${extension}`;
}
