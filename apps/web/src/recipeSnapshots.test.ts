// Snapshots of the images' recipes as the stages, views and editors build them, taken before the code review's batch 24
// gave them one module (review/plan.md, "What guards requests"): a recipe's key is the image's key in the device's
// cache, the key a fingerprint is stored under, and every LLM request's key names its images by them; each LLM stage's
// key holds its images' recipe too. The same inputs must give the same keys, or every image is made again and every
// call paid again. Realistic inputs: a scan's page and a vector page, straightened and not, a page with several
// systems and bar lines, its system and stretch crops with margins at the few-image and the many-image limits, issues
// on them, models of two families. Only a change that means to change keys (the paid release) may update them.

import { test } from "node:test";
import assert from "node:assert/strict";
import { keyOf, type LayoutSystem, type ModelConfig } from "@score3ly/core";
import { CROP_VERSION, DESKEW_VERSION, DRAW_VERSION, ROTATE_VERSION, SCALE_VERSION, type SizeLimit } from "@score3ly/imaging";
import type { StoredIssue } from "./extract.ts";
import { MARGINS, stretchCropBoxes, systemCropBox } from "./crops.ts";
import { boxesOnCrop } from "./transcription.ts";
import { imageLimit, imageLimitFor, requestLimits } from "./requestLimits.ts";
import { RENDERING_VERSION, VEROVIO_VERSION } from "./rendering.ts";
import {
  cropRecipe,
  drawnPageRecipe,
  imageVersions,
  layoutPageRecipe,
  markedCropRecipe,
  modelPageRecipe,
  pageRecipe,
  pdfRecipe,
  straightImageRecipe,
  straightRecipe,
  type CropRecipe,
  type DrawnPageRecipe,
  type LayoutPageRecipe,
  type MarkedCropRecipe,
  type ModelPageRecipe,
  type PageRecipe,
  type StraightRecipe,
} from "./recipes.ts";

const PDF = "3f9a".repeat(16);
const PDFJS = "5.4.296";
const CLAUDE = { provider: "bedrock", family: "claude" } as ModelConfig;
const GEMINI = { provider: "vertex", family: "gemini" } as ModelConfig;

// Page 3 of a scan (its own pixels: the dpi only for vector pages) and page 12 of a vector PDF at 200 dpi.
const PAGES: PageRecipe[] = [
  { step: "rasterize", version: 1, pdf: PDF, page: 3, dpi: 300, pdfjs: PDFJS },
  { step: "rasterize", version: 1, pdf: PDF, page: 12, dpi: 200, pdfjs: PDFJS },
];
const ANGLES = [-0.4137, null];

// A page with four systems, unevenly spaced bar lines, one on its box's edge; a short system without bar lines.
const SYSTEMS: LayoutSystem[] = [
  { box: { left: 0.0812, right: 0.9234, top: 0.0915, bottom: 0.2047 }, barLines: [0.30251, 0.52, 0.71377] },
  { box: { left: 0.0798, right: 0.9241, top: 0.2433, bottom: 0.3561 }, barLines: [0.25, 0.5, 0.75, 0.9312] },
  { box: { left: 0.1003, right: 0.9011, top: 0.3958, bottom: 0.5103 }, barLines: [0.1003, 0.33333, 0.66667] },
  { box: { left: 0.0801, right: 0.6127, top: 0.5502, bottom: 0.6629 }, barLines: [] },
];

// Issues on page 3: inside system 1, across systems 1 and 2, on a bar line of system 2, and one on another page.
const issue = (id: number, boxes: StoredIssue["boxes"]) => ({ id, boxes }) as StoredIssue;
const ISSUES = [
  issue(4, [{ page: 3, box: { left: 0.31, right: 0.4, top: 0.1, bottom: 0.19 } }]),
  issue(7, [{ page: 3, box: { left: 0.7, right: 0.92, top: 0.18, bottom: 0.27 } }]),
  issue(12, [{ page: 3, box: { left: 0.49, right: 0.53, top: 0.25, bottom: 0.35 } }, { page: 4, box: { left: 0.1, right: 0.2, top: 0.1, bottom: 0.2 } }]),
];

// The literals as the code built them before recipes.ts (runLayout, runAnalyze, musicInputs, ArtifactView,
// ExtractionView, LayoutEditor; runExtract; runReview and runApplyReview; engraving.ts).
function literals(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [p, page] of PAGES.entries()) {
    out[`page ${p}`] = page;
    for (const angle of ANGLES) {
      const straight: StraightRecipe = { page, angle, deskew: DESKEW_VERSION, rotate: ROTATE_VERSION };
      const name = `page ${p} at ${angle}`;
      out[`${name}: straight`] = straight;
      for (const [c, config] of [CLAUDE, GEMINI].entries()) {
        const model: ModelPageRecipe = { straight, limit: imageLimit(config), scale: SCALE_VERSION };
        out[`${name}: model page ${c}`] = model;
        out[`${name}: score page ${c}`] = { straight, limit: imageLimitFor(config, 30), scale: SCALE_VERSION } satisfies ModelPageRecipe;
        out[`${name}: drawn ${c}`] = { page: model, systems: SYSTEMS, draw: DRAW_VERSION } satisfies DrawnPageRecipe;
        for (const gray of [false, true]) {
          out[`${name}: layout page ${c} ${gray}`] = {
            page: model,
            systems: SYSTEMS,
            first: 5,
            barLineNumbers: true,
            gray,
            draw: DRAW_VERSION,
          } satisfies LayoutPageRecipe;
        }
      }
      for (const [s, system] of SYSTEMS.entries()) {
        const boxes = [systemCropBox(system), ...stretchCropBoxes(system)];
        for (const [count, limit] of [1, 25].map((n): [number, SizeLimit] => [n, imageLimitFor(CLAUDE, n)])) {
          for (const [b, box] of boxes.entries()) {
            const crop: CropRecipe = { straight, box, crop: CROP_VERSION, limit, scale: SCALE_VERSION };
            out[`${name}: system ${s} crop ${b} of ${count}`] = crop;
            const notes = ISSUES.map((i) => ({ key: `issue-${i.id}`, boxes: i.boxes, kind: "issue" as const, issue: i }));
            const on = boxesOnCrop(notes, page.page, box);
            out[`${name}: system ${s} marked ${b} of ${count}`] = {
              crop,
              boxes: on.map((x) => x.box),
              labels: on.map((x) => (x.note.kind === "issue" ? String(x.note.issue.id) : "")),
              draw: DRAW_VERSION,
            } satisfies MarkedCropRecipe;
          }
        }
      }
    }
  }
  for (const [c, config] of [CLAUDE, GEMINI].entries()) {
    out[`layout ${c}`] = { limit: imageLimit(config), scale: SCALE_VERSION, deskew: DESKEW_VERSION, rotate: ROTATE_VERSION, draw: DRAW_VERSION };
    out[`analyze ${c}`] = {
      limit: imageLimit(config),
      scoreLimit: imageLimitFor(config, 30),
      scale: SCALE_VERSION,
      deskew: DESKEW_VERSION,
      rotate: ROTATE_VERSION,
      draw: DRAW_VERSION,
    };
    out[`extract ${c}`] = {
      limit: imageLimit(config),
      manyImages: requestLimits(config).manyImages,
      scale: SCALE_VERSION,
      crop: CROP_VERSION,
      deskew: DESKEW_VERSION,
      rotate: ROTATE_VERSION,
      margins: MARGINS,
    };
    out[`review ${c}`] = {
      limit: imageLimit(config),
      manyImages: requestLimits(config).manyImages,
      scale: SCALE_VERSION,
      crop: CROP_VERSION,
      deskew: DESKEW_VERSION,
      rotate: ROTATE_VERSION,
      draw: DRAW_VERSION,
      margins: MARGINS,
    };
  }
  for (const pageSize of ["a4", "letter"]) {
    out[`pdf ${pageSize}`] = { mei: "b7e1".repeat(16), config: { pageSize }, verovio: VEROVIO_VERSION, rendering: RENDERING_VERSION, pdf: 1 };
  }
  return out;
}

// The same, from recipes.ts's constructors.
function constructed(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [p, { page, dpi }] of PAGES.entries()) {
    const pageR = pageRecipe(PDF, page, dpi, PDFJS);
    out[`page ${p}`] = pageR;
    for (const angle of ANGLES) {
      const straight = straightRecipe(pageR, angle);
      const name = `page ${p} at ${angle}`;
      out[`${name}: straight`] = straight;
      for (const [c, config] of [CLAUDE, GEMINI].entries()) {
        const model = modelPageRecipe(straight, imageLimit(config));
        out[`${name}: model page ${c}`] = model;
        out[`${name}: score page ${c}`] = modelPageRecipe(straight, imageLimitFor(config, 30));
        out[`${name}: drawn ${c}`] = drawnPageRecipe(model, SYSTEMS);
        for (const gray of [false, true]) out[`${name}: layout page ${c} ${gray}`] = layoutPageRecipe(model, SYSTEMS, 5, gray);
      }
      for (const [s, system] of SYSTEMS.entries()) {
        const boxes = [systemCropBox(system), ...stretchCropBoxes(system)];
        for (const count of [1, 25]) {
          for (const [b, box] of boxes.entries()) {
            const crop = cropRecipe(straight, box, imageLimitFor(CLAUDE, count));
            out[`${name}: system ${s} crop ${b} of ${count}`] = crop;
            out[`${name}: system ${s} marked ${b} of ${count}`] = markedCropRecipe(crop, page, new Map(ISSUES.map((i) => [i.id, i])).values());
          }
        }
      }
    }
  }
  for (const [c, config] of [CLAUDE, GEMINI].entries()) {
    out[`layout ${c}`] = { limit: imageLimit(config), ...imageVersions("scale", "deskew", "rotate", "draw") };
    out[`analyze ${c}`] = { limit: imageLimit(config), scoreLimit: imageLimitFor(config, 30), ...imageVersions("scale", "deskew", "rotate", "draw") };
    out[`extract ${c}`] = { limit: imageLimit(config), manyImages: requestLimits(config).manyImages, ...imageVersions("scale", "crop", "deskew", "rotate"), margins: MARGINS };
    out[`review ${c}`] = {
      limit: imageLimit(config),
      manyImages: requestLimits(config).manyImages,
      ...imageVersions("scale", "crop", "deskew", "rotate", "draw"),
      margins: MARGINS,
    };
  }
  for (const pageSize of ["a4", "letter"] as const) out[`pdf ${pageSize}`] = pdfRecipe("b7e1".repeat(16), { pageSize });
  return out;
}

// One hash over every recipe's key, by name, and a few keys alone, so that a failure says where to look.
async function snapshot(all: Record<string, unknown>): Promise<Record<string, string>> {
  const keys: Record<string, string> = {};
  for (const [name, recipe] of Object.entries(all)) keys[name] = await keyOf(recipe);
  const pick = (name: string) => keys[name].slice(0, 16);
  return {
    count: String(Object.keys(keys).length),
    all: (await keyOf(keys)).slice(0, 16),
    page: pick("page 0"),
    straight: pick("page 0 at -0.4137: straight"),
    modelPage: pick("page 1 at null: model page 0"),
    crop: pick("page 0 at -0.4137: system 1 crop 2 of 25"),
    marked: pick("page 0 at -0.4137: system 1 marked 0 of 1"),
    layoutPage: pick("page 0 at -0.4137: layout page 1 true"),
    extract: pick("extract 0"),
    review: pick("review 1"),
    pdf: pick("pdf a4"),
  };
}

const EXPECTED: Record<string, string> = {
  count: "344",
  all: "0438f85fb1b730dd",
  page: "7f91305dd692dadf",
  straight: "429d775f9df8fabc",
  modelPage: "5ee351a6d52adc0e",
  crop: "212b33ec70ade9ca",
  marked: "e639404512986403",
  layoutPage: "26451386be63b006",
  extract: "78e86f13a885776a",
  review: "f226cf6f5f627e5a",
  pdf: "14968ec0228100c2",
};

test("the images' recipes are what they were", async () => {
  assert.deepEqual(await snapshot(literals()), EXPECTED);
});

test("recipes.ts's constructors give the same recipes", async () => {
  assert.deepEqual(await snapshot(constructed()), EXPECTED);
});

test("a straightened page with no angle is the page image", () => {
  const page = pageRecipe(PDF, 3, 300, PDFJS);
  assert.equal(straightImageRecipe(straightRecipe(page, null)), page);
  const straight = straightRecipe(page, 0.25);
  assert.equal(straightImageRecipe(straight), straight);
});
