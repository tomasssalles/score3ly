// The MEI file's facsimile (docs/notation.md, "MEI"): a surface per page, a zone per MEI measure and system it is on,
// in our coordinates (fractions of the straightened page) scaled to whole numbers; and how a measure divides into MEI
// measures, which the zones and the music share. Part of the builder (mei.ts).

import { stretchEdges, type Box } from "@score3ly/core";
import { el, type XmlElement } from "./xml.ts";
import type { Score, ScoreMeasure } from "./score.ts";

// Our coordinate space: fractions of the straightened page, scaled to whole numbers (MEI wants them so).
const FACS_SCALE = 10000;
const scaled = (v: number) => Math.round(v * FACS_SCALE);
export const zoneId = (system: number, stretches: number[]) => `z${system}t${stretches[0]}-${stretches[stretches.length - 1]}`;

// A surface per page ("surface 3 is page 3 of the project's PDF"), a zone per MEI measure and system it is on.
export function facsimile(score: Score): XmlElement | null {
  const pages = new Map<number, XmlElement[]>();
  for (const piece of score.pieces) {
    for (const m of piece.measures) {
      for (const segment of measureSegments(score, m, false)) {
        for (const part of segmentParts(segment)) {
          const system = score.system(part.system);
          const box = partBox(system.box, system.barLines, part.stretches);
          if (!box) continue;
          const zones = pages.get(system.page) ?? [];
          zones.push(el("zone", { "xml:id": zoneId(part.system, part.stretches), ulx: scaled(box.left), uly: scaled(box.top), lrx: scaled(box.right), lry: scaled(box.bottom) }));
          pages.set(system.page, zones);
        }
      }
    }
  }
  if (pages.size === 0) return null;
  return el(
    "facsimile",
    {},
    [...pages.entries()].sort((a, b) => a[0] - b[0]).map(([page, zones]) => el("surface", { "xml:id": `surface-${page}`, n: page, ulx: 0, uly: 0, lrx: FACS_SCALE, lry: FACS_SCALE }, zones)),
  );
}

// A measure as MEI measures (docs/notation.md, "MEI"): an MEI measure runs from bar line to bar line, so a measure is
// divided at every bar line printed inside it (a repeat after a pickup), each part `@metcon="false"` with the
// measure's number. A system break inside a measure is layout, not a bar line: the full score keeps such a measure
// whole, with the break inside it; a system alone (`atSystems`) has only its own part.
export type Segment = { system: number; stretch: number }[];

export function measureSegments(score: Score, m: ScoreMeasure, atSystems: boolean): Segment[] {
  const segments: Segment[] = [];
  let current: Segment = [];
  for (const part of m.parts) {
    for (const stretch of part.stretches) {
      const prev = current[current.length - 1];
      const divides = prev && (prev.system !== part.system ? atSystems : score.stretch(prev.system, prev.stretch).stretch.rightBarLine !== "none");
      if (divides) {
        segments.push(current);
        current = [];
      }
      current.push({ system: part.system, stretch });
    }
  }
  if (current.length) segments.push(current);
  return segments;
}

// A segment's stretches by system.
export function segmentParts(segment: Segment): { system: number; stretches: number[] }[] {
  const parts: { system: number; stretches: number[] }[] = [];
  for (const s of segment) {
    const last = parts[parts.length - 1];
    if (last && last.system === s.system) last.stretches.push(s.stretch);
    else parts.push({ system: s.system, stretches: [s.stretch] });
  }
  return parts;
}

function partBox(box: Box | null, barLines: number[], stretches: number[]): Box | null {
  if (!box) return null;
  const x = stretchEdges(box, barLines);
  const first = stretches[0];
  const last = stretches[stretches.length - 1];
  return { left: x[first - 1] ?? box.left, right: x[last] ?? box.right, top: box.top, bottom: box.bottom };
}
