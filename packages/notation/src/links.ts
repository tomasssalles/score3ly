// Links between the parts of a transcription that belong together (docs/stages/music.md, `review`, "Linking from the
// current extraction"): an end repeat and where it goes back to, the endings of a repeat, a mark with two ends across
// a system break. One piece of code for every stage that needs them: the checks of the whole score (scoreChecks.ts)
// warn from the repeat structure, `review` gives each call the links of its system. Code links when the links are
// needed; nothing here is stored.

import type { CheckedScoreSystem } from "./scoreChecks.ts";
import { describeMark, sameMark, type ClosedMark, type OpenMark } from "./spans.ts";
import type { LensSystem, StretchPlace, Warning } from "./lens.ts";

// An end repeat (the bar line at the right of `end`) and where it goes back to: a start repeat, the stretch after an
// earlier end repeat (`|: A :| B :|` plays A A B B), or the piece's start.
export type GoBack = { end: StretchPlace; to: StretchPlace; via: "startRepeat" | "endRepeat" | "pieceStart" };

// An ending ("1.", "2."): where it starts and ends, the bar line it ends with, and the endings right before and after
// it, if any.
export type EndingSpan = {
  label: string | null;
  start: StretchPlace;
  end: StretchPlace;
  endBarLine: string;
  previous: EndingSpan | null;
  next: EndingSpan | null;
};

// The repeat structure of one piece, and what is wrong with it (warnings, for the checks of the whole score).
export function repeatStructure(piece: { number: number; answer: LensSystem }[]): { goBacks: GoBack[]; endings: EndingSpan[]; warnings: Warning[] } {
  const warnings: Warning[] = [];
  const goBacks: GoBack[] = [];
  const stretches = piece.flatMap((s) => s.answer.stretches.filter((t) => t.class !== "none").map((t) => ({ system: s, stretch: t })));
  const placeOf = (i: number): StretchPlace => ({ system: stretches[i].system.number, stretch: stretches[i].stretch.stretch });
  if (stretches.length === 0) return { goBacks, endings: [], warnings };
  let open: StretchPlace | null = null; // a start repeat waiting for its end repeat
  let back: { to: StretchPlace; via: GoBack["via"] } = { to: placeOf(0), via: "pieceStart" };
  const start = (at: StretchPlace) => {
    if (open) warnings.push({ message: `Two start repeats without an end repeat between them (system ${open.system} and system ${at.system}): repeats don't nest.`, places: [open, at] });
    open = at;
    back = { to: at, via: "startRepeat" };
  };
  type Building = { label: string | null; start: StretchPlace; end: StretchPlace; endBarLine: string; next: number };
  const building: Building[] = [];
  let current: Building | null = null;
  for (const [i, { system, stretch }] of stretches.entries()) {
    const at = placeOf(i);
    if (stretch.stretch === firstMeasureStretch(system.answer) && system.answer.startRepeat) start(at);
    if (stretch.ending) {
      if (stretch.ending.startsHere || !current) {
        current = { label: stretch.ending.label, start: at, end: at, endBarLine: stretch.rightBarLine, next: -1 };
        building.push(current);
      }
      current.label = current.label ?? stretch.ending.label;
      current.end = at;
      current.endBarLine = stretch.rightBarLine;
      if (stretch.ending.endsHere) {
        current.next = i + 1;
        current = null;
      }
    }
    if (stretch.rightBarLine === "endRepeat" || stretch.rightBarLine === "bothRepeats") {
      goBacks.push({ end: at, ...back });
      open = null;
      if (i + 1 < stretches.length) back = { to: placeOf(i + 1), via: "endRepeat" };
    }
    if (stretch.rightBarLine === "startRepeat" || stretch.rightBarLine === "bothRepeats") start(i + 1 < stretches.length ? placeOf(i + 1) : at);
  }
  if (open) {
    const at: StretchPlace = open;
    warnings.push({ message: `The start repeat on system ${at.system} has no end repeat after it in its piece.`, places: [at] });
  }

  // Endings, with their neighbours: one that starts right where another ended follows it.
  const same = (a: StretchPlace, i: number) => i >= 0 && i < stretches.length && a.system === placeOf(i).system && a.stretch === placeOf(i).stretch;
  const endings: EndingSpan[] = building.map((b) => ({ label: b.label, start: b.start, end: b.end, endBarLine: b.endBarLine, previous: null, next: null }));
  for (const [k, b] of building.entries()) {
    if (k + 1 < building.length && same(building[k + 1].start, b.next)) {
      endings[k].next = endings[k + 1];
      endings[k + 1].previous = endings[k];
    }
  }
  const name = (e: EndingSpan) => (e.label ? `The ending "${e.label}"` : "An ending");
  for (const e of endings) {
    if (e.next && e.endBarLine !== "endRepeat" && e.endBarLine !== "bothRepeats") {
      warnings.push({ message: `${name(e)} is followed by another ending, but doesn't end with an end repeat.`, places: endingPlaces(e) });
    }
    if (!e.next && !e.previous) warnings.push({ message: `${name(e)} stands alone: no other ending comes right before or after it.`, places: endingPlaces(e) });
  }
  return { goBacks, endings, warnings };
}

export const endingPlaces = (e: EndingSpan): StretchPlace[] => (e.start.system === e.end.system && e.start.stretch === e.end.stretch ? [e.start] : [e.start, e.end]);

function firstMeasureStretch(answer: LensSystem): number {
  return answer.stretches.find((s) => s.class !== "none")?.stretch ?? 1;
}

// A system checked on its own (lens.ts), with what it leaves and the marks from earlier systems it closed.
export type LinkedSystem = CheckedScoreSystem & { closed: ClosedMark[] };

// What links each system to the rest of its piece, as sentences a request can give a model: the end repeats on it
// and where they go back to, the start repeats that are gone back to, the endings on it with their neighbours, and
// the marks crossing into or out of it with where they open or close on the other side.
export function systemLinks(systems: LinkedSystem[], pieceStarts: number[]): Map<number, string[]> {
  const links = new Map<number, string[]>();
  const add = (system: number, text: string) => links.set(system, [...(links.get(system) ?? []), text]);
  const where = (p: StretchPlace) => `system ${p.system}, stretch ${p.stretch}`;
  const sorted = [...systems].sort((a, b) => a.number - b.number);
  const pieces: LinkedSystem[][] = [];
  for (const s of sorted) {
    if (pieces.length === 0 || pieceStarts.includes(s.number)) pieces.push([]);
    pieces[pieces.length - 1].push(s);
  }
  for (const piece of pieces) {
    const { goBacks, endings } = repeatStructure(piece);
    for (const g of goBacks) {
      const to = g.via === "startRepeat" ? `the start repeat at ${where(g.to)}` : g.via === "endRepeat" ? `${where(g.to)}, after the previous end repeat` : `the piece's start (${where(g.to)})`;
      add(g.end.system, `The end repeat at the right of ${where(g.end)} goes back to ${to}.`);
      if (g.via === "startRepeat" && g.to.system !== g.end.system) add(g.to.system, `The start repeat at ${where(g.to)} is gone back to from the end repeat at the right of ${where(g.end)}.`);
    }
    for (const e of endings) {
      const name = e.label ? `The ending "${e.label}"` : "An ending";
      const before = e.previous ? `; it follows the ending ${e.previous.label ? `"${e.previous.label}" ` : ""}from ${where(e.previous.start)}` : "";
      const after = e.next ? `; the ending ${e.next.label ? `"${e.next.label}" ` : ""}follows it at ${where(e.next.start)}` : "";
      const text = `${name} runs from ${where(e.start)} to ${where(e.end)}${before}${after}.`;
      for (let n = e.start.system; n <= e.end.system; n++) add(n, text);
    }
    // Marks with two ends across system breaks: each mark that closes on a later system than it opened, or never
    // closes in the piece, is told to every system it is open on.
    const closures = piece.flatMap((s) => s.closed);
    const closing = (m: OpenMark) => closures.find((c) => sameMark(c.mark, m) && c.mark.from === m.from && c.mark.fromStretch === m.fromStretch);
    const crossing = new Map<string, OpenMark>();
    for (const s of piece) for (const m of s.state.open) crossing.set(`${m.kind}/${JSON.stringify(m)}`, m);
    for (const m of crossing.values()) {
      const closed = closing(m);
      const opened = { system: m.from, stretch: m.fromStretch };
      const last = closed ? closed.at.system : piece[piece.length - 1].number;
      const text = closed
        ? `${capitalize(describeMark(m))} opens at ${where(opened)} and closes at ${where(closed.at)}.`
        : `${capitalize(describeMark(m))} opens at ${where(opened)} and is still open where the piece ends.`;
      for (let n = m.from; n <= last; n++) if (piece.some((s) => s.number === n)) add(n, text);
    }
  }
  return links;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
