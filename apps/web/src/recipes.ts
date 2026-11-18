// What every image is made from (docs/images.md §8.6): the recipes, and the one place that builds them. A recipe's key
// (its canonical JSON's hash) is the image's key in the device's cache and the key its fingerprint is stored under,
// every LLM request names its images by it, and each LLM stage's key holds its images' recipe: a recipe built two ways
// would split all of them. pageImages.ts makes the images; this module only says what they are.

import type { Box, LayoutSystem } from "@score3ly/core";
import { CROP_VERSION, DESKEW_VERSION, DRAW_VERSION, ROTATE_VERSION, SCALE_VERSION, type SizeLimit } from "@score3ly/imaging";
import type { EngraveConfig } from "./engrave.ts";
import type { StoredIssue } from "./extract.ts";
import { RASTERIZE_VERSION } from "./rasterize.ts";
import { RENDERING_VERSION, VEROVIO_VERSION } from "./rendering.ts";
import { boxesOnCrop } from "./transcription.ts";

// The versions of our image code (packages/imaging), by operation: an LLM stage's image recipe (in its stage key) names
// those its images go through.
export const IMAGE_VERSIONS = { scale: SCALE_VERSION, crop: CROP_VERSION, deskew: DESKEW_VERSION, rotate: ROTATE_VERSION, draw: DRAW_VERSION };

export function imageVersions<K extends keyof typeof IMAGE_VERSIONS>(...operations: K[]): Pick<typeof IMAGE_VERSIONS, K> {
  return Object.fromEntries(operations.map((o) => [o, IMAGE_VERSIONS[o]])) as Pick<typeof IMAGE_VERSIONS, K>;
}

// A page image (`rasterize`). pdf.js's version is part of it: another version may draw vector pages differently.
export type PageRecipe = { step: "rasterize"; version: number; pdf: string; page: number; dpi: number; pdfjs: string };

export function pageRecipe(pdfSha256: string, page: number, dpi: number, pdfjsVersion: string): PageRecipe {
  return { step: "rasterize", version: RASTERIZE_VERSION, pdf: pdfSha256, page, dpi, pdfjs: pdfjsVersion };
}

// A page image straightened by the angle its lines give (§8.4), or not at all (null: the image is the page image).
// `deskew` is the version of the decision, `rotate` of the rotation code.
export type StraightRecipe = { page: PageRecipe; angle: number | null; deskew: number; rotate: number };

export function straightRecipe(page: PageRecipe, angle: number | null): StraightRecipe {
  return { page, angle, deskew: DESKEW_VERSION, rotate: ROTATE_VERSION };
}

// The recipe of the image a straightened page is: with no angle, the page image's (pageImages.ts makes no image of its
// own then, so a fingerprint is kept and checked under the page image's key).
export function straightImageRecipe(straight: StraightRecipe): PageRecipe | StraightRecipe {
  return straight.angle === null ? straight.page : straight;
}

// A straightened page shrunk to a model's limits (`layout`, `analyze`). `scale` is the scaling code's version.
export type ModelPageRecipe = { straight: StraightRecipe; limit: SizeLimit; scale: number };

export function modelPageRecipe(straight: StraightRecipe, limit: SizeLimit): ModelPageRecipe {
  return { straight, limit, scale: SCALE_VERSION };
}

// A part of a straightened page shrunk to a model's limits: the system and stretch crops the music stages send, and the
// Transcription shows. The box is a fraction of the straightened page, margins included (crops.ts).
export type CropRecipe = { straight: StraightRecipe; box: Box; crop: number; limit: SizeLimit; scale: number };

export function cropRecipe(straight: StraightRecipe, box: Box, limit: SizeLimit): CropRecipe {
  return { straight, box, crop: CROP_VERSION, limit, scale: SCALE_VERSION };
}

// The image sent to a model with its layout drawn on it, for it to check (`layout`'s rounds).
export type DrawnPageRecipe = { page: ModelPageRecipe; systems: LayoutSystem[]; draw: number };

export function drawnPageRecipe(page: ModelPageRecipe, systems: LayoutSystem[]): DrawnPageRecipe {
  return { page, systems, draw: DRAW_VERSION };
}

// A crop sent to a model with boxes drawn on it, each labelled (`review`, `apply_review`: the issues on the crop, by
// their ids). The boxes are fractions of the crop.
export type MarkedCropRecipe = { crop: CropRecipe; boxes: Box[]; labels: string[]; draw: number };

// The crop of a page with the boxes of the issues that fall on it.
export function markedCropRecipe(crop: CropRecipe, page: number, issues: Iterable<StoredIssue>): MarkedCropRecipe {
  const notes = [...issues].map((issue) => ({ key: `issue-${issue.id}`, boxes: issue.boxes, kind: "issue" as const, issue }));
  const on = boxesOnCrop(notes, page, crop.box);
  return {
    crop,
    boxes: on.map((b) => b.box),
    labels: on.map((b) => (b.note.kind === "issue" ? String(b.note.issue.id) : "")),
    draw: DRAW_VERSION,
  };
}

// A page sent to a model with its layout drawn on it, labelled for `analyze` (systems numbered in the whole score from
// `first`, bar lines numbered), in colour or gray (docs/stages/analyze.md).
export type LayoutPageRecipe = {
  page: ModelPageRecipe;
  systems: LayoutSystem[];
  first: number;
  barLineNumbers: boolean;
  gray: boolean;
  draw: number;
};

export function layoutPageRecipe(page: ModelPageRecipe, systems: LayoutSystem[], first: number, gray: boolean): LayoutPageRecipe {
  return { page, systems, first, barLineNumbers: true, gray, draw: DRAW_VERSION };
}

// Our PDF code's version: a change of how the engraving's pages become a PDF makes it anew.
export const PDF_VERSION = 1;

// `engrave`'s PDF (docs/stages/engrave.md): the MEI, the page size, and the versions of the code that make it.
export type PdfRecipe = { mei: string; config: EngraveConfig; verovio: string; rendering: number; pdf: number };

export function pdfRecipe(meiSha256: string, config: EngraveConfig): PdfRecipe {
  return { mei: meiSha256, config, verovio: VEROVIO_VERSION, rendering: RENDERING_VERSION, pdf: PDF_VERSION };
}
