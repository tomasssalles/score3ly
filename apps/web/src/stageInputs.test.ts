import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { pageOfItem, type StepId } from "@score3ly/core";
import type { ApiOutput, ApiStage } from "./api.ts";
import { applyReviewInputIds, latestOutput, latestStage, musicSources, pageCountBefore, pageCountOf, PRODUCERS, reviewInputIds } from "./stageInputs.ts";
import { fakeFixture } from "./testing/fixture.ts";
import { carriedInputs, FIX_STARTS, STEPS } from "./steps.ts";
import { engraveSources, latestMei } from "./engrave.ts";

const fixture = fakeFixture();
const stages = fixture.pipeline.stages;

// What the code derived before `musicSources` (code review, batch 28), copied as it was: steps.ts' `reviewInputIds`,
// and runApplyReview's input ids over musicInputs' lookups. `musicSources` must give the same ids.
function reviewInputIdsBefore(earlier: ApiStage[]): string[] {
  const latest = [...earlier].reverse();
  const transcribed = latest.find((s) => ["extract", "apply_review"].includes(s.step));
  const rasterize = latest.find((s) => s.step === "rasterize");
  const layout = latest.find((s) => s.step === "layout" || s.step === "fix_layout");
  const latestOutput = (steps: string[], type: string) =>
    latest.find((s) => steps.includes(s.step) && s.outputs.some((o) => o.item === "" && o.type === type))?.outputs.find((o) => o.item === "" && o.type === type && o.contentSha256);
  const observations = latestOutput(["fix_observations", "analyze"], "observations");
  const pieces = latestOutput(["fix_metadata", "analyze"], "pieces");
  if (!transcribed || !rasterize || !layout || !observations || !pieces) return [];
  const images = new Map(rasterize.outputs.filter((o) => o.type === "page_image").map((o) => [o.item, o]));
  const pages = layout.outputs
    .filter((o) => o.type === "layout" && o.contentSha256 && images.get(o.item)?.recipe)
    .sort((a, b) => (pageOfItem(a.item) ?? 0) - (pageOfItem(b.item) ?? 0));
  return [
    ...transcribed.outputs.filter((o) => (o.type === "extraction" || (o.item === "" && o.type === "score_checks")) && o.contentSha256).map((o) => o.id),
    ...pages.flatMap((p) => [p.id, images.get(p.item)!.id]),
    observations.id,
    pieces.id,
  ];
}

function applyReviewInputIdsBefore(stagesBefore: ApiStage[]): string[] | null {
  const earlier = [...stagesBefore].reverse();
  const rasterize = earlier.find((s) => s.step === "rasterize");
  const layoutStage = earlier.find((s) => ["layout", "fix_layout"].includes(s.step));
  if (!rasterize || !layoutStage) return null;
  const latest = (steps: string[], type: string) => {
    const s = earlier.find((x) => steps.includes(x.step) && x.outputs.some((o) => o.item === "" && o.type === type));
    return s ? { stage: s, output: s.outputs.find((o) => o.item === "" && o.type === type && o.contentSha256)! } : null;
  };
  const obs = latest(["fix_observations", "analyze"], "observations");
  const pcs = latest(["fix_metadata", "analyze"], "pieces");
  if (!obs || !pcs) return null;
  const images = new Map(rasterize.outputs.filter((o) => o.type === "page_image").map((o) => [o.item, o]));
  const pages = layoutStage.outputs
    .filter((o) => o.type === "layout" && o.contentSha256 && images.get(o.item)?.recipe)
    .map((o) => ({ output: o, image: images.get(o.item)!, page: pageOfItem(o.item) ?? 0 }))
    .sort((a, b) => a.page - b.page);
  const at = earlier.findIndex((s) => ["extract", "apply_review"].includes(s.step));
  const transcribed = at >= 0 ? earlier[at] : null;
  if (!transcribed) return null;
  const steps: Record<string, string> = { review: "review", human_review: "human_review" };
  const reviewers = earlier.slice(0, at).filter((s) => s.step in steps).reverse();
  const entriesOf = (r: ApiStage) => r.outputs.filter((o) => o.type === steps[r.step] && o.contentSha256);
  const extractionOutputs = new Map(transcribed.outputs.filter((o) => o.type === "extraction" && o.contentSha256).map((o) => [o.item, o]));
  const checksOutput = transcribed.outputs.find((o) => o.item === "" && o.type === "score_checks" && o.contentSha256);
  if (!checksOutput) return null;
  return [
    ...[...extractionOutputs.values(), checksOutput].map((o) => o.id),
    ...reviewers.flatMap(entriesOf).map((o) => o.id),
    ...pages.flatMap((p) => [p.output.id, p.image.id]),
    obs.output.id,
    pcs.output.id,
  ];
}

// Pipelines to compare on: the fixture's, and the same with fixes, a second review and stages that aren't done.
let n = 0;
const output = (type: string, item = "", content = true): ApiOutput => ({ id: `x${++n}`, item, type, contentSha256: content ? `${n}`.padStart(64, "0") : null, recipeKey: null, recipe: null });
const stage = (step: string, outputs: ApiOutput[], status: ApiStage["status"] = "done"): ApiStage => ({ ...stages[0], id: `s${++n}`, step, status, outputs });
const at = (step: string) => stages.findIndex((s) => s.step === step);
const insert = (after: string, ...added: ApiStage[]) => [...stages.slice(0, at(after) + 1), ...added, ...stages.slice(at(after) + 1)];
const variants: [string, ApiStage[]][] = [
  ["the fixture", stages],
  ["fix_metadata and fix_observations", insert("analyze", stage("fix_metadata", [output("metadata"), output("pieces")]), stage("fix_observations", [output("observations")]))],
  ["a WIP fix_observations not yet saved", insert("analyze", stage("fix_observations", [], "wip"))],
  ["a WIP fix_metadata, saved", insert("analyze", stage("fix_metadata", [output("metadata"), output("pieces")], "wip"))],
  ["a second fix_layout, WIP", insert("fix_layout", stage("fix_layout", [output("layout", "p1")], "wip"))],
  ["a second review", insert("human_review", stage("review", [output("review", "p1/s1"), output("review", "p1/s2", false)]))],
  ["no layout", stages.filter((s) => s.step !== "layout" && s.step !== "fix_layout")],
  ["no analysis", stages.filter((s) => s.step !== "analyze")],
];

test("musicSources gives the ids the code derived before, on every prefix of each pipeline", () => {
  let compared = 0;
  for (const [name, pipeline] of variants) {
    for (let i = 0; i <= pipeline.length; i++) {
      const earlier = pipeline.slice(0, i);
      const sources = musicSources(earlier);
      assert.deepEqual(reviewInputIds(sources), reviewInputIdsBefore(earlier), `${name}, ${i}: review`);
      const before = applyReviewInputIdsBefore(earlier);
      if (before) assert.deepEqual(applyReviewInputIds(sources), before, `${name}, ${i}: apply_review`);
      if (before) compared++;
    }
  }
  assert.ok(compared > 20);
});

test("the review's ids on the fixture are those it recorded", () => {
  const review = at("review");
  assert.deepEqual(reviewInputIds(musicSources(stages.slice(0, review))), [
    "d3713976-d7e6-444b-80c7-c134b6b2f9ea",
    "823c3caa-d454-4404-aec9-4a7b6d3e6ccd",
    "6e9e542f-d4ae-4b49-9e7f-963c1274a1a3",
    "74b8c26f-8df0-41c2-96b1-47d523e2f1b2",
    "36c7ca04-3b61-4a18-ad0b-fbb368998e06",
    "1486318a-3218-4023-b317-be2386054a7d",
    "9f00c5bb-671c-446e-b86f-67450c0cba63",
    "28d49109-1275-4c41-a628-40e93c121f53",
    "f2b939e7-e7db-41f1-b055-96e5f6e1d218",
    "4e302372-2c78-4f4a-b92b-31e7712802e5",
    "3cfb036d-6d34-4ae2-874f-a12e8a0aa95b",
  ]);
});

test("latestStage and latestOutput find the latest producer, a fix not yet saved passed over", () => {
  const pipeline = variants[2][1];
  assert.equal(latestStage(pipeline, PRODUCERS.observations)?.step, "fix_observations");
  assert.equal(latestOutput(pipeline, "observations")?.stage.step, "analyze");
  assert.equal(latestOutput(variants[1][1], "pieces")?.stage.step, "fix_metadata");
  assert.equal(latestOutput(variants[1][1], "metadata")?.output.type, "metadata");
  assert.equal(latestStage(stages, PRODUCERS.mei)?.step, "build_mei");
  assert.equal(latestStage([], PRODUCERS.layout), null);
});

test("musicSources: the reviews after the transcription, in order", () => {
  const pipeline = variants[5][1];
  const sources = musicSources(pipeline.slice(0, pipeline.map((s) => s.step).lastIndexOf("review") + 1));
  assert.deepEqual(sources.transcription?.reviews.map((s) => s.step), ["human_review", "review"]);
  assert.equal(sources.transcription?.stage.step, "apply_review");
});

// What the lookups give on the fixture, as a snapshot taken before batch 28 put them on `latestStage` and
// `latestOutput`: every stage's artifacts (done and WIP), `build_mei`'s sources, the latest MEI, and what each stage
// would read if carried.
test("the artifacts and sources found on the fixture's pipeline are unchanged", () => {
  const found: unknown[] = [];
  for (let i = 0; i < stages.length; i++) {
    for (const status of ["done", "wip"] as const) found.push(STEPS[stages[i].step as StepId].artifacts({ ...stages[i], status }, stages.slice(0, i)));
    found.push(engraveSources(stages.slice(0, i)), latestMei(stages.slice(0, i)), carriedInputs(stages, i));
  }
  assert.equal(createHash("sha256").update(JSON.stringify(found)).digest("hex"), "8fa0e01309a72e3f8697a0cfff89827b947202668e4d0cf54e995f349e95f206");
  // And on the variants, with fixes and stages not done.
  const more: unknown[] = [];
  for (const [, pipeline] of variants.slice(1)) {
    for (let i = 0; i < pipeline.length; i++) {
      for (const status of ["done", "wip"] as const) more.push(STEPS[pipeline[i].step as StepId].artifacts({ ...pipeline[i], status }, pipeline.slice(0, i)));
      more.push(engraveSources(pipeline.slice(0, i)), latestMei(pipeline.slice(0, i)), carriedInputs(pipeline, i));
    }
  }
  assert.equal(createHash("sha256").update(JSON.stringify(more)).digest("hex"), "91422e4b03e7b61314f36447a5721675a209dbe6449cdd06106bb6ae55386861");
});

// The owner's dec. 40 (the code review's F7): a stage's page count is the selected pages for every stage after
// rasterize, from the page images of the latest rasterize before it; before, extract counted the pages with systems,
// review and apply_review the layouts, build_mei and engrave the page images.
test("a stage's page count: the selected pages, from the latest rasterize before it", () => {
  const output = (item: string, type: string) => ({ id: `${type}-${item}`, item, type }) as ApiOutput;
  const stage = (id: string, step: string, outputs: ApiOutput[]) => ({ id, step, outputs }) as unknown as ApiStage;
  const pipeline = [
    stage("i", "ingest", [output("", "pdf")]),
    stage("r", "rasterize", [output("p1", "page_image"), output("p2", "page_image"), output("p3", "page_image")]),
    stage("l", "layout", [output("p1", "layout"), output("p2", "layout"), output("p3", "layout")]),
    stage("f", "fix_layout", []),
    stage("e", "extract", [output("p2/s1", "extraction")]), // a cover page and a page without music: still 3 pages
  ];
  assert.equal(pageCountOf(pipeline.slice(0, 1)), null); // no rasterize before
  assert.equal(pageCountOf(pipeline), 3);
  assert.equal(pageCountBefore(pipeline, "e"), 3);
  assert.equal(pageCountBefore(pipeline, "r"), null);
  assert.equal(FIX_STARTS.fix_layout(pipeline[2], pipeline.slice(0, 3)).pageCount, 3);
  // The fixture's stages, each after rasterize, have the selected pages (its one page).
  for (const s of stages.slice(2)) assert.equal(pageCountBefore(stages, s.id), 1, s.step);
});
