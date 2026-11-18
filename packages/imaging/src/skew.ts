// The skew of a page (docs/stages/pages.md, "Finding the skew"): the angle search, on strips of line responses. The
// staves and lines at that angle are staves.ts's.

import { roundTo } from "@score3ly/core";
import { cosDeg, grayToRgba, luminance, type RgbaImage, sinDeg, tanDeg } from "./image.ts";
import { paperColor, rotate } from "./rotate.ts";
import { findStaves, measureLine, spread } from "./staves.ts";

export type SkewOptions = {
  maxAngle?: number; // degrees searched either way; default 5
  margin?: number; // fraction of each side ignored, where scanner borders and page edges are; default 0.04
};

export type Skew = {
  // Degrees the content is rotated clockwise as seen on screen: positive when horizontal lines descend to the
  // right. deskew(image, angle) straightens it.
  angle: number;
  // From 0 to 1: how clearly one angle stands out. Near 0 means there were no lines to go by (e.g. an empty page).
  confidence: number;
  // The angle is at the edge of the searched range: the true one is probably outside it.
  atLimit: boolean;
  // The staves found at that angle, top to bottom (see findStaves).
  staves: Staff[];
  // The lines that should be horizontal (docs/stages/pages.md, "Finding the skew"): at most 5, the top lines of staves spread over the page,
  // each measured on its own. None when no staves were found or the angle is at the limit of the search.
  lines: SkewLine[];
};

// A line that should be horizontal, from (x0, y0) to (x1, y1) in fractions of the page's width and height, with
// its own angle in degrees (positive when it descends to the right). Found by findSkew, or drawn by a person.
export type SkewLine = { x0: number; y0: number; x1: number; y1: number; angle: number };

export const MAX_LINES = 5;

// A staff: five evenly spaced lines. Positions are fractions of the page's height, where the staff crosses the
// page's vertical center line (the page is skewed, so elsewhere they differ a little).
export type Staff = { top: number; bottom: number };

// The skew of a page of music, from its horizontal lines (staff lines above all).
//
// 1. A line filter keeps thin, dark, horizontal-ish structures: a pixel counts as much as it is darker than both
//    the pixels a few rows above and below it, relative to them. Large dark areas (scanner borders, a shadow at
//    the spine, beams, noteheads) and vertical strokes give nothing. Being relative, faded ink still counts.
//    Strong responses are capped, so a few very dark lines don't outweigh the many faint ones.
// 2. The page is cut into vertical strips, each with its row profile of line responses. For a candidate angle,
//    the strips' profiles are shifted by how far a line at that angle would have moved, and added up. At the
//    right angle, all strips of a staff line fall onto the same rows: the summed profile has its sharpest peaks,
//    and the sum of its squares is largest.
// 3. A coarse search (0.1°) then a fine one (0.01°) around the best, then a parabola through the best three.
//
// Outliers such as hairpins or long slurs are lines at other angles, but much less ink than the staves, so they
// only add a little to every candidate.
//
// Two passes (docs/stages/pages.md, "Finding the skew"): the strips treat a line as flat within each strip, which holds for small angles
// only. So the first pass finds the page's angle over the whole range (with more strips the larger the range), and
// if it is more than TWO_PASS_ABOVE, the working image is straightened by that angle and measured again near 0°,
// where the staves and lines are found as on any page; they are then turned back onto the page.
export function findSkew(image: RgbaImage, options: SkewOptions = {}): Skew {
  const maxAngle = options.maxAngle ?? 5;
  const margin = options.margin ?? 0.04;
  const work = shrinkForWork(image);
  const first = measure(work, maxAngle, margin);
  if (first.atLimit || Math.abs(first.angle) <= TWO_PASS_ABOVE) return first;

  const straight = rotateGray(work, -first.angle);
  const second = measure(straight, TWO_PASS_ABOVE, margin);
  const { width, height } = work;
  const cx = width / 2;
  const cy = height / 2;
  const cos = cosDeg(first.angle);
  const sin = sinDeg(first.angle);
  // A point of the straightened image, as fractions, back onto the page: turned clockwise by the first angle.
  const back = (x: number, y: number) => {
    const dx = x * width - cx;
    const dy = y * height - cy;
    return [round((cx + dx * cos - dy * sin) / width), round((cy + dx * sin + dy * cos) / height)];
  };
  // A staff's row where it crosses the center line: the line through the turned point, at the page's angle,
  // crosses the center line at cy + d / cos.
  const row = (y: number) => round((cy + (y * height - cy) / cos) / height);
  return {
    angle: Math.round((first.angle + second.angle) * 1000) / 1000,
    confidence: first.confidence,
    atLimit: false,
    staves: second.staves.map((staff) => ({ top: row(staff.top), bottom: row(staff.bottom) })),
    lines: second.lines.map((line) => {
      const [x0, y0] = back(line.x0, line.y0);
      const [x1, y1] = back(line.x1, line.y1);
      return { x0, y0, x1, y1, angle: Math.round((line.angle + first.angle) * 1000) / 1000 };
    }),
  };
}

// Above this angle (degrees), findSkew measures a second time on the straightened working image.
const TWO_PASS_ABOVE = 2;

// The working image turned by `degrees`, its uncovered corners filled with the paper's gray, by our own rotation
// (docs/images.md §8.2).
function rotateGray(gray: Gray, degrees: number): Gray {
  const image = { width: gray.width, height: gray.height, data: grayToRgba(gray.data, gray.width, gray.height) };
  const turned = rotate(image, degrees, paperColor(image));
  const data = new Uint8Array(gray.data.length);
  for (let i = 0; i < data.length; i++) data[i] = turned.data[4 * i];
  return { width: gray.width, height: gray.height, data };
}

// One pass over the working image: the angle within ±maxAngle, the staves and the lines at that angle.
function measure(work: Gray, maxAngle: number, margin: number): Skew {
  const response = lineResponse(work);
  // A line drops by width × tan(angle) across a strip; strips narrow enough to keep that under about 3.5 pixels
  // over the whole range, and never fewer than 48.
  const count = Math.max(MIN_STRIPS, Math.ceil((work.width * tanDeg(maxAngle)) / MAX_DROP));
  const strips = stripProfiles(response, work.width, work.height, margin, count);
  if (strips.total === 0) return { angle: 0, confidence: 0, atLimit: false, staves: [], lines: [] };

  const score = (angle: number) => profileEnergy(strips, angle);

  // Coarse search over the whole range.
  const coarse: { angle: number; value: number }[] = [];
  const coarseSteps = Math.round(maxAngle / 0.1);
  for (let i = -coarseSteps; i <= coarseSteps; i++) {
    const angle = i / 10;
    coarse.push({ angle, value: score(angle) });
  }
  const best = coarse.reduce((a, b) => (b.value > a.value ? b : a));

  // Fine search around the best coarse angle.
  let fineBest = { angle: best.angle, value: best.value };
  for (let i = -15; i <= 15; i++) {
    const angle = Math.round(best.angle * 100 + i) / 100;
    if (Math.abs(angle) > maxAngle) continue;
    const value = score(angle);
    if (value > fineBest.value) fineBest = { angle, value };
  }

  // Sub-step refinement: the vertex of the parabola through the best fine value and its neighbours.
  const left = score(fineBest.angle - 0.01);
  const right = score(fineBest.angle + 0.01);
  const curvature = left - 2 * fineBest.value + right;
  let angle = fineBest.angle;
  if (curvature < 0) {
    const offset = (0.5 * (left - right)) / curvature;
    if (Math.abs(offset) <= 1) angle += offset * 0.01;
  }

  // How much the best angle stands out from the typical one.
  const values = coarse.map((c) => c.value).sort((a, b) => a - b);
  const median = values[values.length >> 1];
  const confidence = fineBest.value > 0 ? Math.max(0, Math.min(1, 1 - median / fineBest.value)) : 0;

  const atLimit = Math.abs(angle) > maxAngle - 0.1;
  const { staves: found, strength } = findStaves(strips, angle);
  return {
    angle: Math.round(angle * 1000) / 1000,
    confidence: Math.round(confidence * 1000) / 1000,
    atLimit,
    staves: found.map((staff) => ({ top: round(staff.top / strips.height), bottom: round(staff.bottom / strips.height) })),
    lines: atLimit ? [] : spread(found, MAX_LINES).flatMap((staff) => measureLine(strips, strength, angle, staff.top) ?? []),
  };
}

// The version of the deskew decision (deskewAngle). Part of the recipe of straightened pages (docs/images.md §8.6):
// changing the rule changes them, and nothing before them.
export const DESKEW_VERSION = 1;

// Whether and by how much to straighten a page, from its lines (docs/stages/pages.md, "Finding the skew"): best effort, low risk. No lines,
// no deskewing. Otherwise the angle that fits all lines best, longer lines counting more, unless it is too small to
// matter: rotation blurs a little, so not if the lines drift by less than a pixel across the page. Null: leave the
// page as it is.
export function deskewAngle(lines: SkewLine[], width: number): number | null {
  let weight = 0;
  let sum = 0;
  for (const line of lines) {
    const length = Math.abs(line.x1 - line.x0);
    weight += length;
    sum += length * tanDeg(line.angle);
  }
  if (weight === 0) return null;
  const tan = sum / weight;
  if (Math.abs(tan) * width < 1) return null;
  return Math.round(((Math.atan(tan) * 180) / Math.PI) * 1000) / 1000;
}

const WORK_WIDTH = 1800;

type Gray = { width: number; height: number; data: Uint8Array };

// Large scans are shrunk by an integer factor, keeping the darkest pixel of each block, so thin lines survive.
function shrinkForWork(image: RgbaImage): Gray {
  const gray = luminance(image);
  const factor = Math.max(1, Math.round(image.width / WORK_WIDTH));
  if (factor === 1) return { width: image.width, height: image.height, data: gray };
  const width = Math.floor(image.width / factor);
  const height = Math.floor(image.height / factor);
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let darkest = 255;
      for (let dy = 0; dy < factor; dy++) {
        const row = (y * factor + dy) * image.width + x * factor;
        for (let dx = 0; dx < factor; dx++) {
          const v = gray[row + dx];
          if (v < darkest) darkest = v;
        }
      }
      data[y * width + x] = darkest;
    }
  }
  return { width, height, data };
}

const NOISE = 0.08; // relative contrast below this is paper texture
const CAP = 0.5; // relative contrast above this counts as this

// Per pixel: how much darker it is than both the pixels k rows above and below, relative to the lighter of
// those, for two distances k (lines of different thickness). From 0 to CAP - NOISE.
function lineResponse(gray: Gray): Float32Array {
  const { width, height, data } = gray;
  const out = new Float32Array(width * height);
  const k1 = Math.max(2, Math.round(height / 1000));
  for (const k of [k1, 2 * k1]) {
    for (let y = k; y < height - k; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const around = Math.min(data[i - k * width], data[i + k * width]);
        if (around <= data[i]) continue;
        const contrast = Math.min(CAP, (around - data[i]) / Math.max(around, 1)) - NOISE;
        if (contrast > out[i]) out[i] = contrast;
      }
    }
  }
  return out;
}

const MIN_STRIPS = 48;
const MAX_DROP = 3.5; // pixels a line at the largest angle searched may drop across a strip

// The working image cut into vertical strips, each with its row profile of line responses (findSkew, step 2).
export type Strips = {
  profiles: Float64Array[]; // per strip: the sum of line responses per row
  offsets: number[]; // per strip: its center's horizontal distance from the inner region's center, in pixels
  widths: number[]; // per strip: its width in pixels
  width: number;
  height: number;
  total: number;
};

function stripProfiles(response: Float32Array, width: number, height: number, margin: number, count: number): Strips {
  const x0 = Math.round(width * margin);
  const x1 = width - x0;
  const y0 = Math.round(height * margin);
  const y1 = height - y0;
  const stripWidth = (x1 - x0) / count;
  const profiles: Float64Array[] = [];
  const offsets: number[] = [];
  const widths: number[] = [];
  let total = 0;
  for (let s = 0; s < count; s++) {
    const from = x0 + Math.round(s * stripWidth);
    const to = x0 + Math.round((s + 1) * stripWidth);
    const profile = new Float64Array(height);
    for (let y = y0; y < y1; y++) {
      let sum = 0;
      for (let x = from; x < to; x++) sum += response[y * width + x];
      profile[y] = sum;
      total += sum;
    }
    profiles.push(profile);
    offsets.push((from + to) / 2 - width / 2);
    widths.push(to - from);
  }
  return { profiles, offsets, widths, width, height, total };
}

// The sum of squares of the strips' profiles added up along lines at `angle`. Shifts are fractional, so each
// strip's row is split between the two nearest rows of the sum.
function profileEnergy(strips: Strips, angle: number): number {
  const { profiles, offsets, height } = strips;
  const tan = tanDeg(angle);
  const sum = new Float64Array(height + 2);
  for (let s = 0; s < profiles.length; s++) {
    // A line through the center row y descends to y + offset * tan in this strip: read the strip there.
    const shift = offsets[s] * tan;
    const whole = Math.floor(shift);
    const frac = shift - whole;
    const profile = profiles[s];
    for (let y = 0; y < height; y++) {
      const a = y + whole;
      if (a < 0 || a + 1 >= height) continue;
      sum[y] += profile[a] * (1 - frac) + profile[a + 1] * frac;
    }
  }
  let energy = 0;
  for (let y = 0; y < height; y++) energy += sum[y] * sum[y];
  return energy;
}

// Stored positions (lines, staves): 4 decimals.
const round = (fraction: number) => roundTo(fraction, 4);
