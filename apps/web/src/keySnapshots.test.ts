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
  for (const model of MODELS) {
    out.push(
      await layoutStageKey({
        promptVersion: 4,
        model,
        imageRecipe: { limit: LIMIT, scale: 1, deskew: 1, rotate: 1, draw: 2 },
        pages: pages.map((p, i) => ({ pageImageKey: p.pageImageKey, linesSha256: i === 1 ? null : hex(`${i}f`) })),
      }),
      await analyzeStageKey({
        promptVersion: 5,
        model,
        imageRecipe: { limit: LIMIT, scoreLimit: { maxLongEdge: 1200, maxPixels: 1_000_000 }, scale: 1, deskew: 1, rotate: 1, draw: 2 },
        pages,
      }),
      await extractStageKey({
        promptVersion: 7,
        model,
        imageRecipe: { limit: LIMIT, manyImages: MANY, scale: 1, crop: 1, deskew: 1, rotate: 1, margins: { top: 0.4, bottom: 0.4, side: 0.02 } },
        pages,
        ...music,
      }),
      await reviewStageKey({ promptVersion: 7, model, imageRecipe: { limit: LIMIT, manyImages: null, scale: 1 }, transcription, pages, ...music }),
      await applyReviewStageKey({
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
      7,
    ),
  );
  return out;
}

const EXPECTED: string[] = [
  "1cf3c2cc457caf3192b80cdbd004044636c8ae7af3d4532beeb60c87f8e77db7",
  "932345ebb05a09618f8349ed3fba9a6fdf8d99f60b554988570ac10462f33094",
  "653c913eff6a74755b523760a57d9abd42752b72669f3f4c767a8d312f79eea0",
  "573da2d99aa20c3077a465b441381b96eacf7db2205bea020fd0c1f74118ac29",
  "9f3fc3f6cc5e4106f0e60c8028700dd4d5f26bc7c17908638bbd420b2f6067c8",
  "10257385b655430e6c5fa9032bb95f501f415489766a8b2f5e70ed8895b0fea2",
  "e970b214dc97e41086596cec9d4ac432d25caaa82dfe23984e058d783cf168ba",
  "6519fbda3d9bed1f89a48ba265c14663eace090aee3e36885a70f634f61e3e48",
  "64c90c849626a5509659b91b06d13d2e544255c0ca569e8bd4138a1763c42d41",
  "6b87459020059c13d88f41328abd322dac41e997c3e8d955d5840f502f50787f",
  "aca934df0aee83894647a869b6f9886e40c67fd7724fde4deea816b8375875b2",
  "78cab17b2fe11ab8939ac26d8f01d293074a7e3816575953edd1ce34f6c810cb",
  "f87b07c8332ab3a3f05020c0a9e1eccf429b9628b75a6cc84d7b14300b161258",
  "d6ec8150c6b4572bc8fe2ff06e0a6dbb8d203e80c8761534f47b0f5c85a3a35b",
  "2b99003b01fa7c19ab2edacdd34f195843af13a329a6bdbf3d4dd5d25806157e",
  "3498bb6e52ae06bbf4f93232e8807bc816383b5c9f79b7a4e65de36b79cb069f",
  "05d5511ac2f93276223a36f6c32f6f62dbb2e2af692b682be3da0b62b469d374",
  "9cabfff28de35bb8cdc1f05334784583a758ee930523313cd95d26af5be6c1b2",
];

test("the stage keys are as they were", async () => {
  assert.deepEqual(await keys(), EXPECTED);
});
