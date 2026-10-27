// The `rasterize` step (docs/stages/pages.md): the selected pages of the PDF as images, one output per page. Only each
// page's recipe is stored; the images are computed on the device and cached there (§5.3, §8.6). This module has
// what doesn't need the browser: the config, its resolution, the recipes and the keys.

import { keyOf } from "@score3ly/core";
import { formatPages, parsePages, selectPages } from "@score3ly/core";

export const RASTERIZE_VERSION = 1;

export type RasterizeConfig = {
  pages: string; // print-dialog notation; empty: all pages
  dpi: number; // for vector pages; scans keep their own pixels
};

export const DEFAULT_CONFIG: RasterizeConfig = { pages: "", dpi: 300 };

export const MIN_DPI = 72;
export const MAX_DPI = 600;

// The stored config (null: the defaults), with defaults for what is missing.
export function configOf(stored: Record<string, unknown> | null): RasterizeConfig {
  return {
    pages: typeof stored?.pages === "string" ? stored.pages : DEFAULT_CONFIG.pages,
    dpi: typeof stored?.dpi === "number" ? stored.dpi : DEFAULT_CONFIG.dpi,
  };
}

// Why a config can't be used, before the PDF is known; null if it can.
export function configError(config: RasterizeConfig): string | null {
  const parsed = parsePages(config.pages);
  if ("error" in parsed) return parsed.error;
  if (!Number.isInteger(config.dpi) || config.dpi < MIN_DPI || config.dpi > MAX_DPI) {
    return `The resolution must be a whole number from ${MIN_DPI} to ${MAX_DPI} dpi.`;
  }
  return null;
}

// The config as the stage runs it: the pages written out for this PDF, so that "" and "1-3" for a PDF of three
// pages are the same config, and give the same stage key.
export function resolveConfig(
  config: RasterizeConfig,
  pageCount: number,
): { config: RasterizeConfig; pages: number[] } | { error: string } {
  const error = configError(config);
  if (error) return { error };
  const selected = selectPages(config.pages, pageCount);
  if ("error" in selected) return selected;
  return { config: { pages: formatPages(selected.pages), dpi: config.dpi }, pages: selected.pages };
}

// What a page image is made from (§8.6). pdf.js's version is part of it: another version may draw vector pages
// differently.
export type PageRecipe = { step: "rasterize"; version: number; pdf: string; page: number; dpi: number; pdfjs: string };

export function pageRecipe(pdfSha256: string, page: number, dpi: number, pdfjsVersion: string): PageRecipe {
  return { step: "rasterize", version: RASTERIZE_VERSION, pdf: pdfSha256, page, dpi, pdfjs: pdfjsVersion };
}

// The stage key (§5.2): the step, its version and libraries, the resolved config, and the input's content: the PDF.
export function stageKey(config: RasterizeConfig, pdfSha256: string, pdfjsVersion: string): Promise<string> {
  return keyOf({
    step: "rasterize",
    version: RASTERIZE_VERSION,
    libraries: { pdfjs: pdfjsVersion },
    config,
    inputs: [pdfSha256],
  });
}

export function pageItem(page: number): string {
  return `p${page}`;
}

export function pageOfItem(item: string): number | null {
  const match = /^p(\d+)$/.exec(item);
  return match ? Number(match[1]) : null;
}
