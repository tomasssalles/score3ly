// The `skew_analysis` step (docs/stages/pages.md, and "Finding the skew" there): per page, the lines that should be horizontal, measured on the
// page images, not rotated. It measures and doesn't decide: whether to deskew is a function of the lines
// (deskewAngle), computed by the stage that makes straightened pages. This module has what doesn't need the browser.

import { keyOf } from "@score3ly/core";
import { FIND_SKEW_VERSION } from "@score3ly/imaging";

export const SKEW_ANALYSIS_VERSION = 1;

export type SkewConfig = { maxAngle: number }; // degrees searched either way

const DEFAULT_SKEW_CONFIG: SkewConfig = { maxAngle: 5 };

export const MIN_MAX_ANGLE = 0.5;
export const MAX_MAX_ANGLE = 45;

export function skewConfigOf(stored: Record<string, unknown> | null): SkewConfig {
  return { maxAngle: typeof stored?.maxAngle === "number" ? stored.maxAngle : DEFAULT_SKEW_CONFIG.maxAngle };
}

export function skewConfigError(config: SkewConfig): string | null {
  const { maxAngle } = config;
  if (!Number.isFinite(maxAngle) || maxAngle < MIN_MAX_ANGLE || maxAngle > MAX_MAX_ANGLE) {
    return `The maximum angle must be from ${MIN_MAX_ANGLE}° to ${MAX_MAX_ANGLE}°.`;
  }
  if (Math.round(maxAngle * 10) !== maxAngle * 10) return "The maximum angle has at most one decimal.";
  return null;
}

// The stage key (§5.2): the step, its version, findSkew's, the config, and the inputs' content: the page images'
// recipe keys.
export function skewStageKey(config: SkewConfig, pageImageKeys: string[]): Promise<string> {
  return keyOf({ step: "skew_analysis", version: SKEW_ANALYSIS_VERSION, findSkew: FIND_SKEW_VERSION, config, inputs: pageImageKeys });
}

// The card's short result, e.g. "lines on 10 of 12 pages", and how many pages had their angle at the limit of the
// search (no lines reported, docs/stages/pages.md): "lines on 9 of 10 pages · 1 at the angle limit".
export function skewNote(pagesWithLines: number, pages: number, atLimit = 0): string {
  const text = pages === 1 ? (pagesWithLines === 1 ? "lines found" : "no lines found") : `lines on ${pagesWithLines} of ${pages} pages`;
  if (atLimit === 0) return text;
  return pages === 1 ? `${text} · at the angle limit` : `${text} · ${atLimit} at the angle limit`;
}

// A line's angle as its label shows it: "+0.42°", "−1.30°", "0.00°".
export function angleLabel(angle: number): string {
  const rounded = Math.round(angle * 100) / 100;
  const text = Math.abs(rounded).toFixed(2);
  return rounded > 0 ? `+${text}°` : rounded < 0 ? `−${text}°` : `${text}°`;
}
