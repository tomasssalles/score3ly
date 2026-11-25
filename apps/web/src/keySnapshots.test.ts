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
        imageRecipe: { limit: LIMIT, scoreLimit: { maxLongEdge: 1200, maxPixels: 1_000_000 }, scale: 1, rotate: 1, draw: 2 },
        pages,
      }),
      await extractStageKey({
        config,
        promptVersion: 7,
        model,
        imageRecipe: { limit: LIMIT, manyImages: MANY, scale: 1, crop: 1, rotate: 1, margins: { top: 0.4, bottom: 0.4, side: 0.02 } },
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
// systems a box is on); `analyze`'s (the 2nd of each config) once more with its step version (batch 30: its checks);
// the other two are as they were. Batch 33 (the paid release): `layout`'s (the 1st of each config) with its rounds
// (B9); `analyze`'s and `extract`'s (the 2nd and 3rd) with their images' recipe, which names no deskew version any
// more (B8, dec. 6); `skew_analysis`'s with findSkew's version and `rasterize`'s with the page image code's (B7). Batch 34: `layout`'s once more with its step
// version (B3: its bar lines normalized), `analyze`'s with its step version (D18b: other pieces dropped).
const EXPECTED: string[] = [
  "0da6ab668e7b8ca70c0d386a9139befa32f990cb198feb21a0f98aaf0b7f6c18",
  "018f697ec948581787f9d4431c9c941b86e5bbb77804da37d9f1d96652435fc0",
  "5a4217701e08af0a9436f88b68239845dee63bdd74dc7c46f6e83e5b315c8564",
  "f146b7882f35d3a47854d641db72fefd1992314aad065d4b63c4c8d0de506b0a",
  "25fcc73ca49ae44aa08544ef33230c6aa5c61708e106baa4e85ccdc6578645bf",
  "7590342bf23a1063f1bff37d62c784f8c98178ba39c8693d00661ebfef7540dc",
  "31485e3faba1ca6b43234f69bcc6c48c23dd9e676453d0b1e9d6e0e1133c661f",
  "cc46b77c2cc87e087fa0b359d20e050c3c2e035228f19dc853b41af2f2d935e2",
  "bd4473f052ee3cdc819fe794c3a9d9346cb71e0c576d36d0aef6c0061408f6fa",
  "976b03e10cf13f70092fe1e5073be75f71528bfbf9f9d0c9917c62c3f8e41cf1",
  "1006ac843abcbc9d16112ad88b7d3f7ea57149988066c1134acbaff80052041d",
  "16a5ce0a894ef7af85c9889b0d02f248d7f88f8dd3b8dfa17cd76d6d2d46ab86",
  "32e4486a8493db7aed49577b388367af56acde50f73803fd9a5e22c6bd3b5869",
  "e211856f13231a3ccf4e431ee3cac2cc9d5a3cf751d4159c5c3cb97609e4947b",
  "69ccfd6c2963767f6565823bf47bbe97ab33e7d19cf06021d9bffe56ce0d2c36",
  "482e4c1d9d6d806e6c963275e1c7f175840b6b00ab52d7475d68aae4e8c17d88",
  "f3700411c60f4376ac10e66f4b0c3ae260f8166b7a85ec3da2628f5fc96e05ba",
  "b34802bb86e3908820ef00a362718bfe4e4057911b0f40ec6e55a0c853029202",
];

test("the stage keys are as they were", async () => {
  assert.deepEqual(await keys(), EXPECTED);
});
