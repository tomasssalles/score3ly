// The staves and lines of a page (skew.ts's second job, docs/stages/pages.md, "Finding the skew"): on the strips of
// line responses the angle search made, the staves at the page's angle, and each staff's top line measured on its own.
// Only used for the lines that decide whether to deskew a page, never to read music.

import { roundTo } from "@score3ly/core";
import { tanDeg } from "./image.ts";
import type { SkewLine, Strips } from "./skew.ts";

// For a strip to count as crossed by a line, the row's mean line response in it must reach this share of the
// page's strong lines (the 98th percentile of all strips' rows), within limits: ink is fainter on some pages.
const LINE_STRENGTH = 0.3;
const LINE_STRENGTH_MIN = 0.02;
const LINE_STRENGTH_MAX = 0.08;
const LINE_COVERAGE = 0.3; // share of the strips a row must cross to be a line
const STAFF_COVERAGE = 0.4; // share of the strips all five lines of a staff must cross together
const SPACING_TOLERANCE = 0.15; // how unevenly a staff's lines may be spaced, as a share of the spacing
const SPACING_AGREEMENT = 0.25; // how far a staff's spacing may be from the page's typical one, as a share

// The staves on a page skewed by `angle`: five lines, evenly spaced, that start and end together, as rows where
// they cross the page's center. Only used for the lines that decide whether to deskew the page (docs/stages/pages.md, "Finding the skew"),
// never to read music or to tell what a page is.
//
// 1. Lines: rows (along the angle) that cross enough of the strips. A strip counts when the row's mean line
//    response in it is strong enough for this page, so a staff line counts across a page even where notes
//    interrupt it, and faint staves on a faded page count too.
// 2. Staves: five lines in a row with even spacing, which cross the same strips (a staff's lines start and end
//    together; the horizontal strokes of ornaments and engravings don't).
// 3. The staves of a page share one spacing (give or take): staves with another spacing are dropped.
// Also the page's `strength`: per pixel, the mean line response at which a row counts as crossing a strip, which
// measureLine uses too.
export function findStaves(strips: Strips, angle: number): { staves: { top: number; bottom: number }[]; strength: number } {
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
  if (found.length === 0) return { staves: [], strength };

  const spacings = found.map((staff) => staff.spacing).sort((a, b) => a - b);
  const typical = spacings[spacings.length >> 1];
  return { staves: found.filter((staff) => Math.abs(staff.spacing - typical) <= SPACING_AGREEMENT * typical), strength };
}

const MAX_GAP = 2;

// At most n of the items, the first, the last and evenly in between.
export function spread<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  return Array.from({ length: n }, (_, i) => items[Math.round((i * (items.length - 1)) / (n - 1))]);
}

// One staff line, measured on its own: in every strip it crosses, the row where its response peaks (to a fraction
// of a row), and a straight line fitted through those points, stronger responses counting more. `row` is where the
// line crosses the page's center, along the page's angle. Only the longest run of strips it crosses counts (gaps of
// up to MAX_GAP strips allowed, where notes or text interrupt it): strokes beyond the staff's ends, e.g. of an
// ornamental border, would otherwise stretch the line and pull its angle. Its ends are that run's ends. `strength` is
// findStaves'.
export function measureLine(strips: Strips, strength: number, angle: number, row: number): SkewLine | null {
  const { profiles, offsets, widths, height, width } = strips;
  const tan = tanDeg(angle);
  const points: { x: number; y: number; w: number }[] = [];
  const ends: number[] = [];
  for (let s = 0; s < profiles.length; s++) {
    const expected = Math.round(row + offsets[s] * tan);
    const profile = profiles[s];
    let peak = -1;
    for (let y = expected - 2; y <= expected + 2; y++) {
      if (y >= 1 && y < height - 1 && (peak < 0 || profile[y] > profile[peak])) peak = y;
    }
    if (peak < 0 || profile[peak] < strength * widths[s]) continue;
    const around = profile[peak - 1] + profile[peak] + profile[peak + 1];
    const y = (profile[peak - 1] * (peak - 1) + profile[peak] * peak + profile[peak + 1] * (peak + 1)) / around;
    points.push({ x: offsets[s] + width / 2, y, w: profile[peak] });
    ends.push(s);
  }
  // The longest run.
  let runStart = 0;
  let best = { from: 0, to: -1 };
  for (let i = 0; i < ends.length; i++) {
    if (i > 0 && ends[i] - ends[i - 1] > MAX_GAP + 1) runStart = i;
    if (i - runStart > best.to - best.from) best = { from: runStart, to: i };
  }
  points.splice(best.to + 1);
  points.splice(0, best.from);
  ends.splice(best.to + 1);
  ends.splice(0, best.from);
  if (points.length < 2) return null;
  let sw = 0;
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sw += p.w;
    sx += p.w * p.x;
    sy += p.w * p.y;
  }
  const mx = sx / sw;
  const my = sy / sw;
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sxx += p.w * (p.x - mx) * (p.x - mx);
    sxy += p.w * (p.x - mx) * (p.y - my);
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const first = ends[0];
  const last = ends[ends.length - 1];
  const xa = offsets[first] + width / 2 - widths[first] / 2;
  const xb = offsets[last] + width / 2 + widths[last] / 2;
  return {
    x0: round(xa / width),
    y0: round((my + slope * (xa - mx)) / height),
    x1: round(xb / width),
    y1: round((my + slope * (xb - mx)) / height),
    angle: Math.round(((Math.atan(slope) * 180) / Math.PI) * 1000) / 1000,
  };
}

// Stored positions (lines, staves): 4 decimals.
const round = (fraction: number) => roundTo(fraction, 4);
