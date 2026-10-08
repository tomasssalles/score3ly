import { luminance, type RgbaImage, tanDeg } from "./image.ts";

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
};

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
export function findSkew(image: RgbaImage, options: SkewOptions = {}): Skew {
  const maxAngle = options.maxAngle ?? 5;
  const margin = options.margin ?? 0.04;
  const work = shrinkForWork(image);
  const response = lineResponse(work);
  const strips = stripProfiles(response, work.width, work.height, margin);
  if (strips.total === 0) return { angle: 0, confidence: 0, atLimit: false, staves: [] };

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

  return {
    angle: Math.round(angle * 1000) / 1000,
    confidence: Math.round(confidence * 1000) / 1000,
    atLimit: Math.abs(angle) > maxAngle - 0.1,
    staves: findStaves(strips, angle),
  };
}

// Whether to straighten a page, by the rule of DESIGN.md §8.4: best effort, low risk. A wrong "no" leaves a music
// page a little skewed; a wrong "yes" rotates a page that didn't need it. So only pages with staves, and only
// angles that are trustworthy and large enough to matter.
export function shouldDeskew(skew: Skew, width: number): { deskew: boolean; reason: string } {
  if (skew.staves.length === 0) return { deskew: false, reason: "no staves found" };
  if (skew.atLimit) return { deskew: false, reason: "the angle is at the limit of the search" };
  // Rotation blurs a little: not worth it if the lines drift by less than a pixel across the page.
  if (Math.abs(tanDeg(skew.angle)) * width < 1) return { deskew: false, reason: "the angle is too small to matter" };
  return { deskew: true, reason: `${skew.staves.length} staves, skewed by ${skew.angle}°` };
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

const STRIPS = 48;

type Strips = {
  profiles: Float64Array[]; // per strip: the sum of line responses per row
  offsets: number[]; // per strip: its center's horizontal distance from the inner region's center, in pixels
  widths: number[]; // per strip: its width in pixels
  height: number;
  total: number;
};

function stripProfiles(response: Float32Array, width: number, height: number, margin: number): Strips {
  const x0 = Math.round(width * margin);
  const x1 = width - x0;
  const y0 = Math.round(height * margin);
  const y1 = height - y0;
  const stripWidth = (x1 - x0) / STRIPS;
  const profiles: Float64Array[] = [];
  const offsets: number[] = [];
  const widths: number[] = [];
  let total = 0;
  for (let s = 0; s < STRIPS; s++) {
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
  return { profiles, offsets, widths, height, total };
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

// For a strip to count as crossed by a line, the row's mean line response in it must reach this share of the
// page's strong lines (the 98th percentile of all strips' rows), within limits: ink is fainter on some pages.
const LINE_STRENGTH = 0.3;
const LINE_STRENGTH_MIN = 0.02;
const LINE_STRENGTH_MAX = 0.08;
const LINE_COVERAGE = 0.3; // share of the strips a row must cross to be a line
const STAFF_COVERAGE = 0.4; // share of the strips all five lines of a staff must cross together
const SPACING_TOLERANCE = 0.15; // how unevenly a staff's lines may be spaced, as a share of the spacing
const SPACING_AGREEMENT = 0.25; // how far a staff's spacing may be from the page's typical one, as a share

// The staves on a page skewed by `angle`: five lines, evenly spaced, that start and end together. Only used to
// decide whether to deskew the page (DESIGN.md §8.4), never to read music or to tell what a page is.
//
// 1. Lines: rows (along the angle) that cross enough of the strips. A strip counts when the row's mean line
//    response in it is strong enough for this page, so a staff line counts across a page even where notes
//    interrupt it, and faint staves on a faded page count too.
// 2. Staves: five lines in a row with even spacing, which cross the same strips (a staff's lines start and end
//    together; the horizontal strokes of ornaments and engravings don't).
// 3. The staves of a page share one spacing (give or take): staves with another spacing are dropped.
function findStaves(strips: Strips, angle: number): Staff[] {
  const { profiles, offsets, widths, height } = strips;
  const tan = tanDeg(angle);
  const shifts = offsets.map((offset) => Math.round(offset * tan));
  const means: number[] = [];
  for (let s = 0; s < profiles.length; s++) {
    for (let y = 0; y < height; y++) if (profiles[s][y] > 0) means.push(profiles[s][y] / widths[s]);
  }
  means.sort((a, b) => a - b);
  const strong = means[Math.floor(means.length * 0.98)] ?? 0;
  const strength = Math.min(LINE_STRENGTH_MAX, Math.max(LINE_STRENGTH_MIN, LINE_STRENGTH * strong));
  // Whether a row (as at the page's center line) crosses strip s with a line. A line may fall between rows: the
  // strongest of three neighbouring rows counts.
  const crosses = (s: number, y: number) => {
    const a = Math.round(y) + shifts[s];
    if (a < 1 || a >= height - 1) return false;
    const profile = profiles[s];
    return Math.max(profile[a - 1], profile[a], profile[a + 1]) >= strength * widths[s];
  };
  const coverage = new Float64Array(height);
  for (let y = 0; y < height; y++) {
    let crossed = 0;
    for (let s = 0; s < profiles.length; s++) if (crosses(s, y)) crossed++;
    coverage[y] = crossed / profiles.length;
  }

  // Runs of rows crossing enough strips are lines; each line's position is its run's weighted center.
  const lines: number[] = [];
  for (let y = 0; y < height; y++) {
    if (coverage[y] < LINE_COVERAGE) continue;
    let weight = 0;
    let sum = 0;
    while (y < height && coverage[y] >= LINE_COVERAGE) {
      weight += coverage[y];
      sum += coverage[y] * y;
      y++;
    }
    lines.push(sum / weight);
  }

  // The share of strips that all the given lines cross.
  const together = (rows: number[]) => {
    let crossed = 0;
    for (let s = 0; s < profiles.length; s++) if (rows.every((y) => crosses(s, y))) crossed++;
    return crossed / profiles.length;
  };

  // Five lines with even spacing. Spacings below 3 pixels are noise; above 1.5% of the page, not a staff.
  const minSpacing = 3;
  const maxSpacing = height * 0.015;
  const near = (target: number, from: number, tolerance: number) => {
    for (let k = from; k < lines.length && lines[k] <= target + tolerance; k++) {
      if (Math.abs(lines[k] - target) <= tolerance) return k;
    }
    return -1;
  };
  const found: { top: number; bottom: number; spacing: number }[] = [];
  let i = 0;
  while (i < lines.length) {
    let last = -1;
    for (let j = i + 1; j < lines.length && last < 0; j++) {
      const spacing = lines[j] - lines[i];
      if (spacing < minSpacing) continue;
      if (spacing > maxSpacing) break;
      const tolerance = Math.max(1.2, SPACING_TOLERANCE * spacing);
      const members = [i, j];
      for (let n = 2; n <= 4 && members.length === n; n++) {
        const k = near(lines[i] + n * spacing, members[n - 1] + 1, tolerance);
        if (k >= 0) members.push(k);
      }
      if (members.length === 5 && together(members.map((m) => lines[m])) >= STAFF_COVERAGE) last = members[4];
    }
    if (last < 0) {
      i++;
      continue;
    }
    found.push({ top: lines[i], bottom: lines[last], spacing: (lines[last] - lines[i]) / 4 });
    i = last + 1;
  }
  if (found.length === 0) return [];

  const spacings = found.map((staff) => staff.spacing).sort((a, b) => a - b);
  const typical = spacings[spacings.length >> 1];
  return found
    .filter((staff) => Math.abs(staff.spacing - typical) <= SPACING_AGREEMENT * typical)
    .map((staff) => ({ top: round(staff.top / height), bottom: round(staff.bottom / height) }));
}

function round(fraction: number): number {
  return Math.round(fraction * 10000) / 10000;
}
