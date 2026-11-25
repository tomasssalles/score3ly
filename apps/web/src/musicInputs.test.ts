import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { canonicalJson, pageItem } from "@score3ly/core";
import type { ApiOutput, ApiStage } from "./api.ts";
import type { PageLayout } from "./layout.ts";
import { musicInputs } from "./musicInputs.ts";
import { CannotStart } from "./stageRunner.ts";

// A score of three pages and two pieces as the music stages read it: page 2 has no systems, page 3 starts the second
// piece, the pages straightened or not, systems with and without inner bar lines.
const realFetch = globalThis.fetch;
const contents = new Map<string, unknown>();
afterEach(() => {
  globalThis.fetch = realFetch;
});
function fakeContent() {
  globalThis.fetch = (async (input: RequestInfo | URL) => Response.json(contents.get(String(input).slice("/api/content/".length)))) as typeof fetch;
}

let n = 0;
function out(type: string, item: string, content?: unknown, recipe?: unknown): ApiOutput {
  const sha = content === undefined ? null : `${++n}`.padStart(64, "c");
  if (sha) contents.set(sha, content);
  return { id: `o${++n}`, item, type, contentSha256: sha, recipeKey: recipe ? `k${n}` : null, recipe: recipe ?? null };
}
const layout = (angle: number | null, systems: { top: number; bottom: number; barLines: number[] }[]): PageLayout => ({
  angle,
  severelySkewed: false,
  systems: systems.map((s) => ({ box: { left: 0.08, right: 0.93, top: s.top, bottom: s.bottom }, barLines: s.barLines })),
  flagged: false,
  note: "",
  rounds: 1,
});
const pageRecipe = (page: number) => ({ op: "page", pdf: "ab".repeat(32), page, dpi: 300, version: 1 });
const stage = (step: string, outputs: ApiOutput[], status: ApiStage["status"] = "done") => ({ id: `s${++n}`, step, status, outputs }) as ApiStage;

const PAGES = [
  layout(-0.4, [
    { top: 0.1, bottom: 0.3, barLines: [0.31, 0.55, 0.78] },
    { top: 0.4, bottom: 0.6, barLines: [0.5] },
    { top: 0.7, bottom: 0.9, barLines: [] },
  ]),
  layout(null, []),
  layout(0.25, [
    { top: 0.12, bottom: 0.4, barLines: [0.25, 0.5, 0.75] },
    { top: 0.5, bottom: 0.8, barLines: [0.4, 0.7] },
  ]),
];
const pipeline = [
  stage("ingest", []),
  stage("rasterize", [1, 2, 3].map((p) => out("page_image", pageItem(p), undefined, pageRecipe(p)))),
  stage("layout", PAGES.map((l, i) => out("layout", pageItem(i + 1), l))),
  stage("analyze", [out("observations", "", { staves: [], items: [] }), out("pieces", "", [1, 4]), out("metadata", "", { titles: [] })]),
  stage("extract", []),
];
const extract = pipeline[4];

test("what the music stages read from a score of three pages and two pieces", async () => {
  fakeContent();
  const inputs = await musicInputs(extract, pipeline);
  const systems = inputs.systems.map((s) => ({ number: s.number, page: s.page, item: s.item, pageIndex: s.pageIndex }));
  assert.deepEqual(systems, [
    { number: 1, page: 1, item: "p1/s1", pageIndex: 0 },
    { number: 2, page: 1, item: "p1/s2", pageIndex: 0 },
    { number: 3, page: 1, item: "p1/s3", pageIndex: 0 },
    { number: 4, page: 3, item: "p3/s1", pageIndex: 2 },
    { number: 5, page: 3, item: "p3/s2", pageIndex: 2 },
  ]);
  assert.deepEqual(
    inputs.systems.map((s) => inputs.bounds(s.number)),
    [
      { first: true, last: false },
      { first: false, last: false },
      { first: false, last: true },
      { first: true, last: false },
      { first: false, last: true },
    ],
  );
  assert.deepEqual(inputs.labelsOf(inputs.byNumber.get(3)!), ["system", "stretch 1", "previous system"]);
  assert.deepEqual(inputs.contextOf(inputs.byNumber.get(4)!).firstOfPiece, true);
  assert.equal(inputs.placeBox({ system: 9, stretch: 1 }), null);
  // Everything, as a snapshot taken before the code review's batch 28 moved these out of the fetching; changed by batch
  // 33 only by the straightened pages' recipes, which name no deskew version (B8, dec. 6).
  const all = {
    systems,
    pages: inputs.pages.map((p) => [p.page, p.output.id, p.image.id]),
    observations: inputs.observationsOutput.id,
    pieces: [inputs.piecesOutput.id, inputs.pieces],
    each: inputs.systems.map((s) => ({
      labels: inputs.labelsOf(s),
      context: inputs.contextOf(s),
      bounds: inputs.bounds(s.number),
      places: [0, 1, 2, 4, 5].map((stretch) => inputs.placeBox({ system: s.number, stretch })),
    })),
    straight: inputs.pages.map((_, i) => inputs.straight(i)),
  };
  assert.equal(createHash("sha256").update(canonicalJson(all)).digest("hex"), "e58429f5559bf652f909fa4378f89197b13920573a0c0b9296a5b4d5170d398c");
});

test("the music stages can't start without what they read", async () => {
  fakeContent();
  const without = (step: string) => pipeline.filter((s) => s.step !== step);
  const refused = async (stages: ApiStage[], message: string) =>
    assert.rejects(musicInputs(extract, stages), (err: unknown) => err instanceof CannotStart && err.message === message);
  await refused(without("rasterize"), "there are no page images: Rasterize hasn't run.");
  await refused(without("layout"), "the layout hasn't been found yet.");
  await refused(without("analyze"), "the score hasn't been analysed yet.");
  const wip = stage("fix_observations", [out("observations", "", { staves: [], items: [] })], "wip");
  await refused([...pipeline.slice(0, 4), wip, extract], "a fix of the analysis isn't finished yet.");
  const empty = stage("layout", [1, 2, 3].map((p) => out("layout", pageItem(p), layout(null, []))));
  await refused([...pipeline.slice(0, 2), empty, ...pipeline.slice(3)], "the layout has no systems.");
});
