// The last two steps (docs/stages/engrave.md). `build_mei` builds the full score's MEI from the latest extraction (the
// systems' stored answers, their layout, where the pieces start) and the metadata, and stores it: the file a user
// downloads, unless `fix_mei` edits it. `engrave`, the last stage, always, engraves the latest MEI as a PDF of its page
// size: its output is the PDF's recipe, the PDF itself cached on the device (engraving.ts). What doesn't need the
// browser is here (the page sizes and Verovio's options: engravePage.ts); the runners are runBuildMei.ts and runEngrave.ts,
// the views EngravingView.tsx, the downloads downloads.ts.

import { buildScore, meiString, type MeiMetadata, type Score } from "@score3ly/notation";
import { REPOSITORY_URL } from "./about.ts";
import type { ApiStage } from "./api";
import { scoreInput, type StoredExtraction } from "./extract.ts";
import { latestOutput, latestProducer, scoreOutput } from "./stageInputs.ts";
import type { PdfRecipe } from "./recipes.ts";
import { normalizeMetadata } from "./analyze.ts";
import { keyOf, pageOfItem, systemOfItem } from "@score3ly/core";
import type { PageLayout } from "./layout";
import { count } from "./format.ts";

export const BUILD_MEI_VERSION = 1;
export const ENGRAVE_VERSION = 2; // 2: the PDF is made by the stage; the MEI by `build_mei`

// What `build_mei` builds the MEI from: the latest extraction's systems, the latest layout's pages, the latest metadata
// and pieces before it. Null where something is missing (the stage can't run yet).
export type EngraveSources = {
  extractions: { id: string; item: string; sha256: string }[];
  layouts: { id: string; page: number; sha256: string }[];
  metadata: { id: string; sha256: string };
  pieces: { id: string; sha256: string };
};

export function engraveSources(earlier: ApiStage[]): EngraveSources | { missing: string } {
  const extraction = latestProducer(earlier, "extraction");
  if (!extraction || extraction.status !== "done") return { missing: "the music hasn't been extracted yet." };
  const layout = latestProducer(earlier, "layout");
  const withOutput = (type: "metadata" | "pieces") => {
    const found = latestOutput(earlier, type);
    return found && found.stage.status === "done" ? { id: found.output.id, sha256: found.output.contentSha256! } : null;
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

// The latest MEI before a stage: `fix_mei`'s when it comes right before, else the latest `build_mei`'s. What `engrave`
// engraves, and what a `fix_mei` starts from (its parent).
export function latestMei(earlier: ApiStage[]): { id: string; sha256: string; step: string } | { missing: string } {
  const stage = latestProducer(earlier, "mei");
  const mei = stage ? scoreOutput(stage, "mei") : undefined;
  if (!stage) return { missing: "the MEI hasn't been built yet." };
  if (stage.status !== "done" || !mei) return { missing: stage.step === "fix_mei" ? "\"Fix MEI\" isn't finished yet." : "the MEI hasn't been built yet." };
  return { id: mei.id, sha256: mei.contentSha256!, step: stage.step };
}

export const sourceIds = (sources: EngraveSources): string[] => [
  ...sources.extractions.map((e) => e.id),
  ...sources.layouts.map((l) => l.id),
  sources.metadata.id,
  sources.pieces.id,
];

// `build_mei`'s stage key (§5.2): the step, its version, the lens's version (what the answers mean), the MEI
// builder's (what it writes from them), and the content of what it reads.
export function buildMeiStageKey(sources: EngraveSources, versions: { lensVersion: number; meiBuilderVersion: number }): Promise<string> {
  return keyOf({
    step: "build_mei",
    version: BUILD_MEI_VERSION,
    lensVersion: versions.lensVersion,
    meiBuilderVersion: versions.meiBuilderVersion,
    extractions: sources.extractions.map((e) => [e.item, e.sha256]),
    layouts: sources.layouts.map((l) => [l.page, l.sha256]),
    metadata: sources.metadata.sha256,
    pieces: sources.pieces.sha256,
  });
}

// `engrave`'s stage key (§5.2): the step, its version, and the PDF's recipe (the MEI it engraves and the page options).
export function engraveStageKey(recipe: PdfRecipe): Promise<string> {
  return keyOf({ step: "engrave", version: ENGRAVE_VERSION, recipe });
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
    const index = systemOfItem(item)?.index ?? 1;
    return scoreInput({ number: extraction.system, page: extraction.page, layout: layouts.get(extraction.page)?.systems[index - 1] }, extraction.answer);
  });
  if (systems.length === 0) throw new Error("There are no systems to engrave.");
  return { score: buildScore(systems, pieces), metadata: meiMetadata(metadata) };
}

// The full score's MEI as `build_mei` stores it: the file, with how it was made.
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
  return [...(score.pieces.length > 1 ? [count(score.pieces.length, "piece")] : []), count(measures, "measure")].join(" · ");
}
