// Snapshots of the stage keys (docs/overview.md §5.2), taken before the code review's batch 7 moved the key code into
// @score3ly/core: the same inputs must give the same keys, or every stage runs again. Realistic inputs: several pages,
// models of three providers (one without an effort, one added by hand), the images' recipes as the stages build them.
// Only a change that means to change keys (the paid release) may update them.

import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutStageKey } from "./layout.ts";
import { analyzeStageKey } from "./analyze.ts";
import { extractStageKey } from "./extract.ts";
import { reviewStageKey } from "./review.ts";
import { applyReviewStageKey } from "./applyReview.ts";
import { buildMeiStageKey } from "./engrave.ts";
import { skewStageKey } from "./skewAnalysis.ts";
import { stageKey as rasterizeStageKey } from "./rasterize.ts";

const hex = (seed: string) => seed.repeat(64).slice(0, 64);
const MODELS = [
  { provider: "bedrock", model: "eu.anthropic.claude-opus-5-5", effort: "high" },
  { provider: "vertex", model: "gemini-3.1-pro", effort: null },
  { provider: "openrouter", model: "some-lab/added-by-hand:beta", effort: "low" },
];
const LIMIT = { maxLongEdge: 2576, maxPixels: 3_750_000 };
const MANY = { above: 20, limit: { maxLongEdge: 2000, maxPixels: 3_750_000 } };
const pages = [1, 2, 3].map((n) => ({ pageImageKey: hex(`${n}a`), layoutSha256: hex(`${n}b`) }));
const music = { observationsSha256: hex("0c"), piecesSha256: hex("0d"), lensVersion: 7 };
const transcription = [hex("e1"), hex("e2"), hex("e3"), hex("e4")];

async function keys(): Promise<string[]> {
  const out: string[] = [];
  for (const [m, model] of MODELS.entries()) {
    // The stage's config as its step reads it: the model config's id, which isn't part of the key (llmStageKey.ts).
    const config = { modelConfigId: `config-${m}` };
    out.push(
      await layoutStageKey({
        config,
        promptVersion: 4,
        model,
        imageRecipe: { limit: LIMIT, scale: 1, deskew: 1, rotate: 1, draw: 2 },
        pages: pages.map((p, i) => ({ pageImageKey: p.pageImageKey, linesSha256: i === 1 ? null : hex(`${i}f`) })),
      }),
      await analyzeStageKey({
        config,
        promptVersion: 5,
        model,
        imageRecipe: { limit: LIMIT, scoreLimit: { maxLongEdge: 1200, maxPixels: 1_000_000 }, scale: 1, deskew: 1, rotate: 1, draw: 2 },
        pages,
      }),
      await extractStageKey({
        config,
        promptVersion: 7,
        model,
        imageRecipe: { limit: LIMIT, manyImages: MANY, scale: 1, crop: 1, deskew: 1, rotate: 1, margins: { top: 0.4, bottom: 0.4, side: 0.02 } },
        pages,
        ...music,
      }),
      await reviewStageKey({ config, promptVersion: 7, model, imageRecipe: { limit: LIMIT, manyImages: null, scale: 1 }, transcription, pages, ...music }),
      await applyReviewStageKey({
        config,
        promptVersion: 7,
        model,
        imageRecipe: { limit: LIMIT, manyImages: MANY, scale: 1 },
        transcription,
        reviews: [hex("r1"), hex("r2")],
        pages,
        ...music,
      }),
    );
  }
  out.push(
    await skewStageKey({ maxAngle: 5 }, pages.map((p) => p.pageImageKey)),
    await rasterizeStageKey({ pages: "1-3, 5", dpi: 300 }, hex("9"), "6.4.299"),
    await buildMeiStageKey(
      {
        extractions: transcription.map((sha256, i) => ({ id: `x${i}`, item: `p${1 + (i >> 1)}/s${1 + (i & 1)}`, sha256 })),
        layouts: pages.map((p, i) => ({ id: `l${i}`, page: i + 1, sha256: p.layoutSha256 })),
        metadata: { id: "m", sha256: hex("5e") },
        pieces: { id: "p", sha256: music.piecesSha256 },
      },
      { lensVersion: 7, meiBuilderVersion: 1 },
    ),
  );
  return out;
}

// The 15 keys of the LLM steps changed once, on purpose, with their step versions (the code review, batch 18: answers
// checked against their schema); `build_mei`'s, the last, once, when the MEI builder's version joined it (batch 27);
// `review`'s and `apply_review`'s (the 4th and 5th of each config) once more with their step versions (batch 29: which
// systems a box is on); the other two are as they were.
const EXPECTED: string[] = [
  "f829e1ca4719fad055972a27ea3b4ef58410c2ebe2023bf17294c5763d7f0a24",
  "bed93123a297b9309a595a370d8fa6f055e4f9e5ddc3573b7e9b8b7a8bf17815",
  "9d3a8aa0519ca096738069a918d23f473ec937651a41139e180a740ad9b9791d",
  "f146b7882f35d3a47854d641db72fefd1992314aad065d4b63c4c8d0de506b0a",
  "25fcc73ca49ae44aa08544ef33230c6aa5c61708e106baa4e85ccdc6578645bf",
  "99ca14d965ecb2dfa70515d0b17bc5af2eeef2a82cf54764824587898d11cf2c",
  "5a090354cfe70e5b1e4749a0e57ee85ff09a63e5bbff792746db075f5241552b",
  "547b129c063903e19e09d2dd6a527c62e9eaaae56805f03a5e490e9f42b66172",
  "bd4473f052ee3cdc819fe794c3a9d9346cb71e0c576d36d0aef6c0061408f6fa",
  "976b03e10cf13f70092fe1e5073be75f71528bfbf9f9d0c9917c62c3f8e41cf1",
  "eca6214aef3d9266668f285d2823d96212149197b2eb40ce6eab49696afc8385",
  "9d10b617b0431d1bba5029cb89554964fe9c7f294fc254ab51bf6d00ca8bec03",
  "4e2dd08cd2798a1894e37bf0bb741b2f1efe8a5d9b5c8cc6fa57e9fc98effd54",
  "e211856f13231a3ccf4e431ee3cac2cc9d5a3cf751d4159c5c3cb97609e4947b",
  "69ccfd6c2963767f6565823bf47bbe97ab33e7d19cf06021d9bffe56ce0d2c36",
  "3498bb6e52ae06bbf4f93232e8807bc816383b5c9f79b7a4e65de36b79cb069f",
  "05d5511ac2f93276223a36f6c32f6f62dbb2e2af692b682be3da0b62b469d374",
  "b34802bb86e3908820ef00a362718bfe4e4057911b0f40ec6e55a0c853029202",
];

test("the stage keys are as they were", async () => {
  assert.deepEqual(await keys(), EXPECTED);
});
