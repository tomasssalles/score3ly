// The MEI builder (DESIGN.md §6, "MEI"): code builds the whole file from the lens (score.ts) and the metadata. Models
// never write MEI. Full MEI 5, close to MEI Basic: the music uses only what MEI Basic allows, apart from the few
// constructs listed in BEYOND_BASIC, the single source of truth that the tests check against.
//
// One pass through each piece interprets the symbolic format as the format says: the pitches from the printed
// accidentals, the key and the measure (per voice, octave by octave, an ottava ending them), ottavas by time on their
// staff, curves as ties or slurs, marks with two ends matched. The same pass gives the full score (`engrave`) and, for
// the Transcription, each system on its own (`systems`): then every part of a measure is a measure of its own, a
// measure split across a system break half a measure on each (`@metcon="false"`), and what points outside the system
// is left out.

import { add, equal, fraction, less, mul, ZERO, type Fraction } from "./fraction.ts";
import { durationValue, eventsDuration, parseKey, parseTime } from "./durations.ts";
import type { Box, LensEnding, LensStretch, LensSystem } from "./lens.ts";
import { stretchOffsets, tstamp, type Run, type Score, type ScoreMeasure, type ScorePiece } from "./score.ts";
import { JUMPS, type Accidental, type Duration, type Event, type Head, type Mark, type Pitch } from "./symbolic.ts";
import { el, elements, serialize, type XmlElement, type XmlNode } from "./xml.ts";

export const MEI_VERSION = "5.1";
export const MEI_NS = "http://www.music-encoding.org/ns/mei";

// What we use beyond MEI Basic, on purpose (DESIGN.md §6, "So we go beyond MEI Basic"): the header's work, pieces and
// edition, how the file was made, the user's comment, the facsimile with the measures' zones, a bar line in the middle
// of a measure, the sounding accidental on the note, and the link from a piece to its entry in the header.
export const BEYOND_BASIC = {
  elements: ["workList", "manifestationList", "encodingDesc", "notesStmt", "facsimile", "barLine"],
  attributes: [
    { element: "note", attribute: "accid.ges" },
    { element: "measure", attribute: "facs" },
    { element: "mdiv", attribute: "corresp" },
  ],
};

// The metadata as the header needs it (`analyze`'s or `fix_metadata`'s, without pages and confidences).
export type MeiMetadata = {
  titles: { text: string; type: "main" | "subtitle" | "alternative" | "translated" }[];
  people: { name: string; role: "composer" | "arranger" | "editor" | "lyricist" | "librettist" | "translator" | "other" }[];
  pieces: { title: string; system: number }[];
  catalogueNumbers?: { text: string }[];
  dedications?: { text: string }[];
  instrumentation?: { text: string }[];
  compositionDates?: { text: string }[];
  publishers?: { text: string }[];
  places?: { text: string }[];
  dates?: { text: string }[];
  plateNumbers?: { text: string }[];
  notices?: { text: string }[];
  comments?: { text: string }[];
};

// How the file was made (`encodingDesc/appInfo`).
export type MeiApplication = { name: string; version: string; url: string };

export type MeiOptions = {
  metadata?: MeiMetadata | null;
  application?: MeiApplication | null;
  systems?: number[]; // only these systems, each on its own (the Transcription); else the whole score
};

export function buildMei(score: Score, options: MeiOptions = {}): XmlElement {
  const only = options.systems ? new Set(options.systems) : null;
  const pieces = score.pieces.filter((p) => !only || p.systems.some((s) => only.has(s.number)));
  const music = pieces.map((piece) => new PieceWriter(score, piece, only, options.metadata ?? null).mdiv());
  const header = header_(score, options.metadata ?? null, options.application ?? null, !only);
  const body = el("music", {}, [!only ? facsimile(score) : null, el("body", {}, music)]);
  return el("mei", { xmlns: MEI_NS, meiversion: MEI_VERSION }, [header, body]);
}

export const meiString = (score: Score, options: MeiOptions = {}): string => serialize(buildMei(score, options));

// The file with exactly what BEYOND_BASIC lists removed: what the tests validate against MEI Basic.
export function withoutBeyondBasic(root: XmlElement): XmlElement {
  const strip = (e: XmlElement): XmlElement => ({
    name: e.name,
    attrs: e.attrs.filter(([k]) => !BEYOND_BASIC.attributes.some((a) => a.element === e.name && a.attribute === k)),
    children: e.children.flatMap((c): XmlNode[] => (typeof c === "string" ? [c] : BEYOND_BASIC.elements.includes(c.name) ? [] : [strip(c)])),
  });
  return strip(root);
}

// --- The header --------------------------------------------------------------------------------------------------

const TITLE_TYPES: Record<MeiMetadata["titles"][number]["type"], string> = { main: "main", subtitle: "subordinate", alternative: "alternative", translated: "translated" };

function header_(score: Score, m: MeiMetadata | null, app: MeiApplication | null, full: boolean): XmlElement {
  const texts = (list: { text: string }[] | undefined) => (list ?? []).map((t) => t.text.trim()).filter(Boolean);
  const titles = (m?.titles ?? []).filter((t) => t.text.trim());
  const titleEls = () =>
    titles.length > 0 ? titles.map((t) => el("title", { type: TITLE_TYPES[t.type] }, [t.text.trim()])) : [el("title", {}, ["Untitled"])];
  const people = (m?.people ?? []).filter((p) => p.name.trim());
  const named = (role: string) => people.filter((p) => p.role === role).map((p) => p.name.trim());
  const respStmt = (roles: string[]) => {
    const list = people.filter((p) => roles.includes(p.role));
    return list.length ? el("respStmt", {}, list.map((p) => el("persName", { role: p.role }, [p.name.trim()]))) : null;
  };
  const fileDesc = el("fileDesc", {}, [
    el("titleStmt", {}, [
      ...titleEls(),
      ...named("composer").map((n) => el("composer", {}, [n])),
      ...named("lyricist").map((n) => el("lyricist", {}, [n])),
      ...named("arranger").map((n) => el("arranger", {}, [n])),
      respStmt(["librettist", "translator", "editor", "other"]),
    ]),
    el("pubStmt"),
    full && texts(m?.comments).length ? el("notesStmt", {}, texts(m?.comments).map((t) => el("annot", {}, [t]))) : null,
  ]);
  if (!full) return el("meiHead", {}, [fileDesc]);

  const encodingDesc = app
    ? el("encodingDesc", {}, [el("appInfo", {}, [el("application", { version: app.version }, [el("name", {}, [app.name]), el("ptr", { target: app.url })])])])
    : null;
  const pieceTitles = new Map((m?.pieces ?? []).map((p) => [p.system, p.title.trim()]));
  const creation = [...texts(m?.dedications).map((t) => el("dedication", {}, [t])), ...texts(m?.compositionDates).map((t) => el("date", {}, [t]))];
  const work = el("work", { "xml:id": "work" }, [
    ...texts(m?.catalogueNumbers).map((t) => el("identifier", {}, [t])),
    ...titleEls(),
    ...named("composer").map((n) => el("composer", {}, [n])),
    ...named("lyricist").map((n) => el("lyricist", {}, [n])),
    ...named("librettist").map((n) => el("librettist", {}, [n])),
    ...named("arranger").map((n) => el("arranger", {}, [n])),
    ...named("translator").map((n) => el("contributor", { role: "translator" }, [n])),
    creation.length ? el("creation", {}, creation) : null,
    texts(m?.instrumentation).length ? el("perfMedium", {}, [el("perfResList", {}, texts(m?.instrumentation).map((t) => el("perfRes", {}, [t])))]) : null,
    score.pieces.length > 1 || pieceTitles.size > 0
      ? el(
          "componentList",
          {},
          score.pieces.map((p) => el("work", { "xml:id": `work-piece-${p.index + 1}` }, [el("title", {}, [pieceTitles.get(p.systems[0].number) || `Piece ${p.index + 1}`])])),
        )
      : null,
  ]);
  const plate = texts(m?.plateNumbers);
  const pub = [...texts(m?.publishers).map((t) => el("publisher", {}, [t])), ...texts(m?.places).map((t) => el("pubPlace", {}, [t])), ...texts(m?.dates).map((t) => el("date", {}, [t]))];
  const notices = texts(m?.notices);
  const manifestation = el("manifestation", {}, [
    el("titleStmt", {}, [...titleEls(), respStmt(["editor", "other"])]),
    pub.length ? el("pubStmt", {}, pub) : null,
    notices.length ? el("availability", {}, notices.map((t) => el("useRestrict", {}, [t]))) : null,
    plate.length ? el("physDesc", {}, plate.map((t) => el("plateNum", {}, [t]))) : null,
  ]);
  return el("meiHead", {}, [fileDesc, encodingDesc, el("workList", {}, [work]), el("manifestationList", {}, [manifestation])]);
}

// --- The facsimile -----------------------------------------------------------------------------------------------

// Our coordinate space: fractions of the straightened page, scaled to whole numbers (MEI wants them so).
const FACS_SCALE = 10000;
const scaled = (v: number) => Math.round(v * FACS_SCALE);
export const zoneId = (system: number, stretches: number[]) => `z${system}t${stretches[0]}-${stretches[stretches.length - 1]}`;

// A surface per page ("surface 3 is page 3 of the project's PDF"), a zone per part of a measure.
function facsimile(score: Score): XmlElement | null {
  const pages = new Map<number, XmlElement[]>();
  for (const piece of score.pieces) {
    for (const m of piece.measures) {
      for (const part of m.parts) {
        const system = score.system(part.system);
        const box = partBox(system.box, system.barLines, part.stretches);
        if (!box) continue;
        const zones = pages.get(system.page) ?? [];
        zones.push(el("zone", { "xml:id": zoneId(part.system, part.stretches), ulx: scaled(box.left), uly: scaled(box.top), lrx: scaled(box.right), lry: scaled(box.bottom) }));
        pages.set(system.page, zones);
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

function partBox(box: Box | null, barLines: number[], stretches: number[]): Box | null {
  if (!box) return null;
  const x = [box.left, ...barLines, box.right];
  const first = stretches[0];
  const last = stretches[stretches.length - 1];
  return { left: x[first - 1] ?? box.left, right: x[last] ?? box.right, top: box.top, bottom: box.bottom };
}

// --- Values ------------------------------------------------------------------------------------------------------

const CLEF_SHAPES: Record<string, [string, number]> = {
  treble: ["G", 2],
  bass: ["F", 4],
  alto: ["C", 3],
  tenor: ["C", 4],
  soprano: ["C", 1],
  mezzosoprano: ["C", 2],
  baritone: ["C", 5],
  varbaritone: ["F", 3],
  subbass: ["F", 5],
  french: ["G", 1],
};

export function clefAttrs(clef: string, prefix: "clef." | ""): Record<string, string | number> {
  const m = /^([a-z]+)(?:([_^])(8|15))?$/.exec(clef);
  const [shape, line] = CLEF_SHAPES[m?.[1] ?? "treble"] ?? CLEF_SHAPES.treble;
  const attrs: Record<string, string | number> = { [`${prefix}shape`]: shape, [`${prefix}line`]: line };
  if (m?.[2]) {
    attrs[`${prefix}dis`] = Number(m[3]);
    attrs[`${prefix}dis.place`] = m[2] === "_" ? "below" : "above";
  }
  return attrs;
}

function meterAttrs(time: string | null): Record<string, string | number> {
  const t = time ? parseTime(time) : null;
  if (!t) return {};
  return { "meter.count": t.count.join("+"), "meter.unit": t.unit, ...(t.symbol ? { "meter.sym": t.symbol } : {}) };
}

const ALTER: Record<Accidental, number> = { flat: -1, sharp: 1, natural: 0, doubleflat: -2, doublesharp: 2 };
const WRITTEN: Record<Accidental, string> = { flat: "f", sharp: "s", natural: "n", doubleflat: "ff", doublesharp: "x" };
const GESTURAL: Record<number, string> = { [-2]: "ff", [-1]: "f", 0: "n", 1: "s", 2: "ss" };
const SHARPS = ["f", "c", "g", "d", "a", "e", "b"];
const FLATS = ["b", "e", "a", "d", "g", "c", "f"];

// The alteration a key signature gives a letter.
export function keyAlteration(key: string, letter: string): number {
  const k = parseKey(key);
  if (!k || k.count === 0) return 0;
  return (k.accidental === "s" ? SHARPS : FLATS).slice(0, k.count).includes(letter) ? (k.accidental === "s" ? 1 : -1) : 0;
}

const ARTICS: Record<string, string> = { staccato: "stacc", staccatissimo: "stacciss", accent: "acc", marcato: "marc", tenuto: "ten", portato: "ten-stacc" };

// Words that make a quoted text a dynamic (`<dynam>`) rather than a direction (`<dir>`): code's business, not the
// model's (§6, "Which quoted texts are dynamics").
const DYNAMIC_WORDS = /(^|[\s.(])(p+|f+|mp|mf|sf+z?|sfp|fz|fp|rfz?|cresc|crescendo|decresc|decrescendo|dim|diminuendo|smorz|smorzando|morendo|calando|perdendosi)(?=$|[\s.,)])/i;
export const isDynamicText = (text: string) => DYNAMIC_WORDS.test(text.trim());

const JUMP_FUNC: Record<(typeof JUMPS)[number], string> = {
  "D.C.": "daCapo",
  "D.C. al Fine": "daCapo",
  "D.C. al Coda": "daCapo",
  "D.S.": "dalSegno",
  "D.S. al Fine": "dalSegno",
  "D.S. al Coda": "dalSegno",
  "To Coda": "coda",
};

const BAR_RENDITION: Partial<Record<LensStretch["rightBarLine"], string>> = { double: "dbl", final: "end", endRepeat: "rptend", bothRepeats: "rptboth", dashed: "dashed", none: "invis", startRepeat: "rptstart" };

function durAttrs(d: Duration): Record<string, string | number> {
  return { dur: d.base === 0.5 ? "breve" : d.base, ...(d.dots ? { dots: d.dots } : {}) };
}

// A length as note values for `<space>`: the largest that fit, one after the other.
function spaceValues(length: Fraction): Duration[] {
  const out: Duration[] = [];
  let left = length;
  for (const base of [0.5, 1, 2, 4, 8, 16, 32, 64, 128]) {
    const v = durationValue({ base, dots: 0 });
    while (!less(left, v) && left.n > 0) {
      out.push({ base, dots: 0 });
      left = fraction(left.n * v.d - v.n * left.d, left.d * v.d);
    }
  }
  return out;
}

// A note value of exactly that length, if there is one (for a two-note tremolo's notes).
function valueOf(length: Fraction): Duration | null {
  for (const base of [0.5, 1, 2, 4, 8, 16, 32, 64, 128]) {
    for (let dots = 0; dots <= 3; dots++) if (equal(durationValue({ base, dots }), length)) return { base, dots };
  }
  return null;
}

// --- A piece -----------------------------------------------------------------------------------------------------

type Control = { el: XmlElement; part: number }; // a control event, and the part (system) of its measure it starts in
type Open = { el: XmlElement }; // one whose end isn't known yet
type CurveStart = { id: string; pitch: Pitch | null; alter: number | null; index: number; open: Open };
type VoiceState = {
  curves: Map<number, CurveStart>;
  hairpin: Open | null;
  trill: Open | null;
  gliss: Open | null;
  index: number; // notes, chords and rests so far in the piece: a curve over a rest is no tie
};
type OpenOttava = Open & { voice: number; staff: number; first: string | null; last: string | null };
type OttavaChange = { staff: number; measure: number; onset: Fraction; value: number };

// Where an event is: its measure, the part (system) and the stretch, and its onset within the measure and the part.
type Place = { measure: ScoreMeasure; part: number; system: LensSystem; systemNumber: number; stretch: LensStretch; offset: Fraction; partOffset: Fraction; unit: number };

class PieceWriter {
  private readonly voices = new Map<number, VoiceState>();
  private readonly ottavas: OttavaChange[] = [];
  private readonly openOttavas = new Map<number, OpenOttava>(); // by staff
  private controls: Control[] = [];
  private accidentals = new Map<string, number>(); // per measure and voice: `${voice}|${letter}${octave}|${epoch}`
  private readonly keys = new Map<string, Map<number, string>>(); // the keys in effect at each stretch, per staff

  private readonly score: Score;
  private readonly piece: ScorePiece;
  private readonly only: Set<number> | null;
  private readonly metadata: MeiMetadata | null;

  constructor(score: Score, piece: ScorePiece, only: Set<number> | null, metadata: MeiMetadata | null) {
    this.score = score;
    this.piece = piece;
    this.only = only;
    this.metadata = metadata;
    this.collectKeys();
    this.collectOttavas();
  }

  mdiv(): XmlElement {
    const { piece, score, only } = this;
    const title = this.metadata?.pieces.find((p) => p.system === piece.systems[0].number)?.title.trim();
    // The pass runs over the whole piece (accidentals, ties, ottavas need it); only the measures asked for are written.
    const measures = piece.measures.map((m) => this.measure(m));
    for (const staff of [...this.openOttavas.keys()]) this.closeOttava(staff); // an ottava never ended: to the last note under it
    const sectionChildren: XmlNode[] = [];
    let firstScoreDef: XmlElement | null = null;
    let endingRun: XmlElement | null = null;
    const push = (node: XmlNode) => (endingRun ? endingRun.children.push(node) : sectionChildren.push(node));
    let lastSystem: number | null = null;
    for (const [i, m] of piece.measures.entries()) {
      const built = measures[i];
      const parts = m.parts.map((p, j) => ({ p, j })).filter(({ p }) => !only || only.has(p.system));
      if (parts.length === 0) continue;
      const ending = this.endingOf(m);
      if (ending && (ending.startsHere || !endingRun)) {
        endingRun = el("ending", { "xml:id": `p${piece.index + 1}e${i + 1}`, label: ending.label ?? undefined });
        sectionChildren.push(endingRun);
      } else if (!ending) endingRun = null;
      if (only) {
        // Each part a measure of its own.
        for (const { p, j } of parts) {
          if (!firstScoreDef) firstScoreDef = this.scoreDefAt(p.system);
          else if (j === 0) for (const change of built.changes) push(change);
          push(this.measureElement(m, built, [j], true));
        }
      } else {
        const first = m.parts[0].system;
        if (!firstScoreDef) firstScoreDef = this.scoreDefAt(first);
        else {
          if (first !== lastSystem) push(score.system(first).page !== score.system(lastSystem!).page ? el("pb") : el("sb"));
          for (const change of built.changes) push(change);
        }
        push(this.measureElement(m, built, m.parts.map((_, j) => j), false));
        lastSystem = m.parts[m.parts.length - 1].system;
      }
      if (ending?.endsHere) endingRun = null;
    }
    const attrs: Record<string, string | number | undefined> = { "xml:id": `piece-${piece.index + 1}`, n: piece.index + 1, label: title || undefined };
    if (!only && (this.score.pieces.length > 1 || (this.metadata?.pieces.length ?? 0) > 0)) attrs.corresp = `#work-piece-${piece.index + 1}`;
    return el("mdiv", attrs, [el("score", {}, [firstScoreDef ?? this.scoreDefAt(piece.systems[0].number), el("section", {}, sectionChildren)])]);
  }

  private endingOf(m: ScoreMeasure): (LensEnding & { endsHere: boolean }) | null {
    const stretches = m.parts.flatMap((p) => p.stretches.map((s) => this.score.stretch(p.system, s).stretch));
    const first = stretches.find((s) => s.ending);
    if (!first?.ending) return null;
    const label = stretches.find((s) => s.ending?.label)?.ending?.label ?? null;
    return { startsHere: stretches[0].ending?.startsHere ?? false, endsHere: stretches.some((s) => s.ending?.endsHere), label };
  }

  // The score's definitions as they are at a system's start: the piece's staves (only the system's own, for a system
  // alone), with the clefs, keys and times in effect there, and the groups as printed on it.
  private scoreDefAt(systemNumber: number): XmlElement {
    const system = this.score.system(systemNumber);
    const state = this.stateAt(systemNumber);
    const onSystem = new Set(system.answer.staves.map((s) => s.staff));
    const staves = this.piece.staves.filter((s) => !this.only || onSystem.has(s.staff));
    const staffDef = (n: number) => {
      const s = this.piece.staves.find((x) => x.staff === n)!;
      const sig = state.get(n) ?? this.firstState(n);
      return el("staffDef", { "xml:id": this.only ? undefined : `p${this.piece.index + 1}staff${n}`, n, lines: 5, ...clefAttrs(sig?.clef ?? "treble", "clef."), keysig: sig?.key ?? "0", ...meterAttrs(sig?.time ?? null), label: s.label ?? undefined }, [
        s.abbr ? el("labelAbbr", {}, [s.abbr]) : null,
      ]);
    };
    // Groups as printed on the system; the staves not in any group, alone, in the piece's order.
    const groups = system.answer.groups.filter((g) => g.staves.length > 0);
    const inGroup = new Map<number, (typeof groups)[number]>();
    for (const g of groups) for (const n of g.staves) if (!inGroup.has(n)) inGroup.set(n, g);
    const children: XmlElement[] = [];
    const done = new Set<(typeof groups)[number]>();
    for (const s of staves) {
      const g = inGroup.get(s.staff);
      if (!g) children.push(staffDef(s.staff));
      else if (!done.has(g)) {
        done.add(g);
        const members = staves.filter((x) => g.staves.includes(x.staff));
        children.push(el("staffGrp", { symbol: g.symbol, label: g.label ?? undefined }, members.map((x) => staffDef(x.staff))));
      }
    }
    return el("scoreDef", {}, [el("staffGrp", {}, children)]);
  }

  // A staff's clef, key and time where it first appears in the piece.
  private firstState(staff: number): { clef: string; key: string; time: string | null } | undefined {
    for (const system of this.piece.systems) {
      const s = system.answer.staves.find((x) => x.staff === staff);
      if (s) return { clef: s.clef, key: s.key, time: s.time ?? this.piece.measures[0]?.time ?? null };
    }
    return undefined;
  }

  // The clefs, keys and times in effect at a system's start: as printed there, the time carried where none is.
  private stateAt(systemNumber: number): Map<number, { clef: string; key: string; time: string | null }> {
    const state = new Map<number, { clef: string; key: string; time: string | null }>();
    for (const system of this.piece.systems) {
      if (system.number > systemNumber) break;
      // A staff new here takes the time the others are in, where none is printed for it.
      const current = [...state.values()].find((x) => x.time)?.time ?? null;
      for (const s of system.answer.staves) state.set(s.staff, { clef: s.clef, key: s.key, time: s.time ?? state.get(s.staff)?.time ?? current });
      if (system.number === systemNumber) break;
      for (const st of system.answer.stretches) {
        if (st.class === "none") continue;
        for (const c of st.changes) {
          const old = state.get(c.staff);
          if (old) state.set(c.staff, { ...old, key: c.key ?? old.key, time: c.time ?? old.time });
        }
      }
    }
    return state;
  }

  private collectKeys() {
    for (const system of this.piece.systems) {
      const keys = new Map(system.answer.staves.map((s) => [s.staff, s.key]));
      for (const st of system.answer.stretches) {
        for (const c of st.changes) if (c.key) keys.set(c.staff, c.key);
        this.keys.set(`${system.number}/${st.stretch}`, new Map(keys));
      }
    }
  }

  // Every ottava command, by staff and time: an ottava applies by time to every voice on its staff (§6).
  private collectOttavas() {
    for (const m of this.piece.measures) {
      const offsets = stretchOffsets(this.score, m);
      for (const part of m.parts) {
        for (const stretch of part.stretches) {
          for (const run of this.score.stretch(part.system, stretch).runs) {
            let staff = run.staff;
            walkTimed(run.events, offsets.get(`${part.system}/${stretch}`)!, (e, onset) => {
              if (e.e === "changeStaff") staff = e.staff;
              if (e.e === "ottava") this.ottavas.push({ staff, measure: m.index, onset, value: e.value });
            });
          }
        }
      }
    }
  }

  // The ottava on a staff at a time, and which one it is (for the accidentals it ends).
  private ottavaAt(staff: number, measure: number, onset: Fraction): { value: number; epoch: number } {
    let value = 0;
    let epoch = 0;
    for (const [i, o] of this.ottavas.entries()) {
      if (o.staff !== staff) continue;
      if (o.measure < measure || (o.measure === measure && !less(onset, o.onset))) {
        value = o.value;
        epoch = i + 1;
      }
    }
    return { value, epoch };
  }

  private voice(v: number): VoiceState {
    let s = this.voices.get(v);
    if (!s) {
      s = { curves: new Map(), hairpin: null, trill: null, gliss: null, index: 0 };
      this.voices.set(v, s);
    }
    return s;
  }

  // One measure: the layers' content per part and stretch, its control events, and the definitions that change at
  // its start.
  private measure(m: ScoreMeasure): BuiltMeasure {
    this.controls = [];
    const offsets = stretchOffsets(this.score, m);
    const runs: { run: Run; part: number; offset: Fraction }[] = [];
    for (const [j, part] of m.parts.entries()) {
      for (const stretch of part.stretches) for (const run of this.score.stretch(part.system, stretch).runs) runs.push({ run, part: j, offset: offsets.get(`${part.system}/${stretch}`)! });
    }
    const content = new Map<string, XmlNode[]>(); // by `${voice}/${system}/${stretch}`
    const home = new Map<number, number>(); // each voice's layer: on the staff it starts on in the measure
    for (const { run } of runs) if (!home.has(run.voice)) home.set(run.voice, run.staff);
    const voiceIds = [...new Set(runs.map((r) => r.run.voice))].sort((a, b) => a - b);
    for (const v of voiceIds) {
      this.accidentals = new Map();
      for (const { run, part, offset } of runs.filter((r) => r.run.voice === v)) {
        const p = m.parts[part];
        const system = this.score.system(p.system);
        const stretch = this.score.stretch(p.system, run.stretch).stretch;
        const partStart = offsets.get(`${p.system}/${p.stretches[0]}`)!;
        const time = parseTime(m.time ?? "") ?? { unit: 4 };
        const place: Place = { measure: m, part, system: system.answer, systemNumber: p.system, stretch, offset, partOffset: sub(offset, partStart), unit: time.unit };
        content.set(`${v}/${p.system}/${run.stretch}`, this.run(run, place, home.get(v)!));
      }
    }
    return { content, controls: this.controls, changes: this.changesAt(m) };
  }

  // The definitions that change where a measure starts: the clefs, keys and times printed at a new system's start that
  // differ from those in effect, and the stretch's own changes.
  private changesAt(m: ScoreMeasure): XmlElement[] {
    const first = m.parts[0];
    const system = this.score.system(first.system);
    const stretch = this.score.stretch(first.system, first.stretches[0]).stretch;
    const previous = this.piece.systems[this.piece.systems.indexOf(system) - 1];
    const before = previous ? this.endState(previous.number) : null;
    const startsSystem = first.stretches[0] === firstStretch(system.answer);
    const changed = new Map<number, Record<string, string | number>>();
    const set = (staff: number, attrs: Record<string, string | number>) => changed.set(staff, { ...(changed.get(staff) ?? {}), ...attrs });
    if (startsSystem && before) {
      for (const s of system.answer.staves) {
        const old = before.get(s.staff);
        if (!old) continue;
        if (old.clef !== s.clef) set(s.staff, clefAttrs(s.clef, "clef."));
        if (old.key !== s.key) set(s.staff, { keysig: s.key });
        if (s.time && s.time !== old.time) set(s.staff, meterAttrs(s.time));
      }
    }
    if (m.index > 0 || !startsSystem) {
      for (const c of stretch.changes) {
        if (c.key) set(c.staff, { keysig: c.key });
        if (c.time) set(c.staff, meterAttrs(c.time));
      }
    }
    if (changed.size === 0) return [];
    // The same change on every staff of the system: one scoreDef; else a staffDef per staff.
    const all = system.answer.staves.map((s) => JSON.stringify(changed.get(s.staff) ?? null));
    const shared = changed.get(system.answer.staves[0].staff)!;
    const sharedKeys = Object.keys(shared);
    if (all.every((x) => x === all[0]) && sharedKeys.every((k) => k === "keysig" || k.startsWith("meter."))) return [el("scoreDef", shared)];
    return [...changed.entries()].map(([staff, attrs]) => el("staffDef", { n: staff, ...attrs }));
  }

  // The clefs, keys and times at a system's end, as its strings and changes leave them.
  private endState(systemNumber: number): Map<number, { clef: string; key: string; time: string | null }> {
    const state = this.stateAt(systemNumber);
    const system = this.score.system(systemNumber);
    for (const st of system.answer.stretches) {
      if (st.class === "none") continue;
      for (const c of st.changes) {
        const old = state.get(c.staff);
        if (old) state.set(c.staff, { ...old, key: c.key ?? old.key, time: c.time ?? old.time });
      }
      for (const run of this.score.stretch(systemNumber, st.stretch).runs) {
        let staff = run.staff;
        walkTimed(run.events, ZERO, (e) => {
          if (e.e === "changeStaff") staff = e.staff;
          if (e.e === "clef" && state.has(staff)) state.set(staff, { ...state.get(staff)!, clef: e.clef });
        });
      }
    }
    return state;
  }

  // A voice's string in one stretch, as layer content.
  private run(run: Run, place: Place, home: number): XmlNode[] {
    const ctx: RunContext = { run, place, home, staff: run.staff, stem: null, k: 0 };
    return this.events(run.events, ctx, place.offset, fraction(1), null);
  }

  private events(events: Event[], ctx: RunContext, start: Fraction, scale: Fraction, grace: "unacc" | "acc" | "unknown" | null): XmlNode[] {
    // Beams: a "[" and its "]" at the same level wrap the events between them.
    const out: XmlNode[] = [];
    const beamStack: { at: number }[] = [];
    let onset = start;
    for (const event of events) {
      const id = `${ctx.run.id}e${ctx.k++}`;
      const length = grace ? ZERO : mul(eventLength(event), scale);
      const node = this.event(event, id, ctx, onset, scale, grace);
      const opens = "marks" in event && event.marks.some((m) => m.kind === "beam" && m.open);
      const closes = "marks" in event && event.marks.some((m) => m.kind === "beam" && !m.open);
      if (opens) beamStack.push({ at: out.length });
      out.push(...node);
      if (closes && beamStack.length > 0) {
        const { at } = beamStack.pop()!;
        const inside = out.splice(at);
        out.push(el("beam", {}, inside));
      }
      onset = add(onset, length);
    }
    return out;
  }

  private event(event: Event, id: string, ctx: RunContext, onset: Fraction, scale: Fraction, grace: "unacc" | "acc" | "unknown" | null): XmlNode[] {
    const { place } = ctx;
    switch (event.e) {
      case "note":
      case "chord": {
        const heads = event.e === "note" ? [event.head] : event.heads;
        const headIds = event.e === "note" ? [id] : heads.map((_, j) => `${id}h${j}`);
        const resolved = this.notes(heads, ctx, onset, event.e === "note" ? event.marks : []);
        const attrs: Record<string, string | number | undefined> = {
          "xml:id": id,
          ...durAttrs(event.duration),
          staff: ctx.staff !== ctx.home ? ctx.staff : undefined,
          "stem.dir": ctx.stem ?? undefined,
          grace: grace ?? undefined,
          "stem.mod": grace === "unacc" ? "1slash" : undefined,
        };
        const artics = event.marks.flatMap((m) => (m.kind === "articulation" ? [el("artic", { artic: ARTICS[m.name] })] : []));
        const node =
          event.e === "note"
            ? el("note", { ...attrs, ...resolved[0].attrs }, [...resolved[0].children, ...artics])
            : el("chord", attrs, [...resolved.map((r, j) => el("note", { "xml:id": headIds[j], ...r.attrs }, r.children)), ...artics]);
        const v = this.voice(ctx.run.voice);
        // A glissando ends on the next note of its voice; an ottava runs from the first note under it to the last.
        if (v.gliss) setRef(v.gliss, "endid", id);
        v.gliss = null;
        const ottava = this.openOttavas.get(ctx.staff);
        if (ottava && ottava.voice === ctx.run.voice) {
          if (!ottava.first) {
            ottava.first = id;
            ottava.el.attrs = ottava.el.attrs.map(([k, x]) => [k, k === "startid" ? `#${id}` : x]);
          }
          ottava.last = id;
        }
        // Head marks: fingering, curves (closing first).
        for (const [j, h] of heads.entries()) this.marks(h.marks, headIds[j], ctx, event.e === "chord" ? { pitch: h.pitch, alter: resolved[j].alter } : null);
        this.marks(event.marks, id, ctx, event.e === "note" ? { pitch: event.head.pitch, alter: resolved[0].alter } : null);
        v.index++;
        if (event.tremolo) return [el("bTrem", { unitdur: event.tremolo }, [node])];
        return [node];
      }
      case "rest": {
        this.marks(event.marks, id, ctx, null);
        this.voice(ctx.run.voice).index++;
        return [el(event.visible ? "rest" : "space", { "xml:id": id, ...durAttrs(event.duration), staff: event.visible && ctx.staff !== ctx.home ? ctx.staff : undefined })];
      }
      case "measureRest": {
        this.marks(event.marks, id, ctx, null);
        this.voice(ctx.run.voice).index++;
        if (event.count > 1) return [el("multiRest", { "xml:id": id, num: event.count })];
        // A whole-measure rest: mRest when it fills its measure alone, else a rest of its length.
        if (ctx.place.measure.parts.length === 1 && ctx.place.measure.parts[0].stretches.length === 1) return [el("mRest", { "xml:id": id })];
        const values = spaceValues(durationValue(event.duration));
        return values.map((d, i) => el("rest", { "xml:id": i === 0 ? id : `${id}r${i}`, ...durAttrs(d) }));
      }
      case "clef":
        return [el("clef", clefAttrs(event.clef, ""))];
      case "ottava": {
        const staff = ctx.staff;
        this.closeOttava(staff);
        if (event.value !== 0) {
          const o = el("octave", { "xml:id": `${id}o`, dis: Math.abs(event.value) === 2 ? 15 : 8, "dis.place": event.value > 0 ? "above" : "below", staff, startid: "", endid: "" });
          this.openOttavas.set(staff, { el: o, voice: ctx.run.voice, staff, first: null, last: null });
          this.controls.push({ el: o, part: place.part });
        }
        return [];
      }
      case "changeStaff":
        ctx.staff = event.staff;
        return [];
      case "stem":
        ctx.stem = event.direction === "neutral" ? null : event.direction;
        return [];
      case "event": {
        const at = tstamp(this.partOnset(onset, place), place.unit);
        const allStaves = place.system.staves.map((s) => s.staff).join(" ");
        const top = place.system.staves[0].staff;
        const e =
          event.name === "breathe"
            ? el("breath", { tstamp: at, staff: ctx.staff })
            : event.name === "caesura"
              ? el("caesura", { tstamp: at, staff: allStaves })
              : el("repeatMark", { func: event.name === "segnoMark" ? "segno" : event.name === "codaMark" ? "coda" : "fine", tstamp: at, staff: top }, event.name === "fine" ? ["Fine"] : []);
        this.controls.push({ el: e, part: place.part });
        return [];
      }
      case "tuplet": {
        const body = this.events(event.body, ctx, onset, mul(scale, fraction(event.m, event.n)), grace);
        return [el("tuplet", { num: event.n, numbase: event.m }, body)];
      }
      case "grace": {
        const kind = event.kind === "acciaccatura" ? "unacc" : event.kind === "appoggiatura" ? "acc" : "unknown";
        return this.events(event.body, ctx, onset, scale, kind);
      }
      case "tremolo": {
        const notes = event.body.filter((e) => e.e === "note" || e.e === "chord");
        const total = mul(eventsDuration(event.body), mul(fraction(event.count), scale));
        const half = valueOf(mul(total, fraction(1, 2)));
        const unit = notes.length === 2 && "duration" in notes[0] ? notes[0].duration.base : null;
        if (notes.length === 2 && event.body.length === 2 && half && unit) {
          // Two notes, each written with half of the tremolo's length (the printed values).
          const first = this.event({ ...notes[0], duration: half, tremolo: null } as Event, `${id}a`, ctx, onset, fraction(1), grace);
          const second = this.event({ ...notes[1], duration: half, tremolo: null } as Event, `${id}b`, ctx, add(onset, mul(total, fraction(1, 2))), fraction(1), grace);
          return [el("fTrem", { unitdur: unit }, [...first, ...second])];
        }
        // Otherwise written out: the notes, count times.
        const out: XmlNode[] = [];
        let at = onset;
        for (let i = 0; i < event.count; i++) {
          out.push(...this.events(event.body, { ...ctx, run: { ...ctx.run, id: `${id}x${i}` }, k: 0 }, at, scale, grace));
          at = add(at, mul(eventsDuration(event.body), scale));
        }
        return out;
      }
    }
  }

  private partOnset(onset: Fraction, place: Place): Fraction {
    // Within the measure for the full score; within the part's own measure for a system alone.
    return this.only ? add(place.partOffset, sub(onset, place.offset)) : onset;
  }

  private closeOttava(staff: number) {
    const open = this.openOttavas.get(staff);
    if (!open) return;
    this.openOttavas.delete(staff);
    setRef(open, "endid", open.last);
  }

  // The pitches of a note's or chord's heads: written as printed, sounding from the key, the measure's accidentals in
  // this voice (in this octave, until an ottava starts or ends) and a tie from the note before.
  private notes(heads: Head[], ctx: RunContext, onset: Fraction, eventMarks: Mark[]): { attrs: Record<string, string | number>; children: XmlElement[]; alter: number }[] {
    const { place } = ctx;
    const v = this.voice(ctx.run.voice);
    const ottava = this.ottavaAt(ctx.staff, place.measure.index, onset);
    const key = this.keys.get(`${place.systemNumber}/${place.stretch.stretch}`)?.get(ctx.staff) ?? "0";
    return heads.map((h) => {
      const curveMarks = heads.length === 1 ? [...h.marks, ...eventMarks] : h.marks;
      const tie = this.tieFrom(v, curveMarks, h);
      const memory = `${ctx.run.voice}|${h.pitch.letter}${h.pitch.octave}|${ottava.epoch}`;
      let alter: number;
      if (h.accidental) {
        alter = ALTER[h.accidental];
        this.accidentals.set(memory, alter);
      } else if (tie !== null) {
        alter = tie;
      } else {
        alter = this.accidentals.get(memory) ?? keyAlteration(key, h.pitch.letter);
      }
      const attrs: Record<string, string | number> = { pname: h.pitch.letter, oct: h.pitch.octave };
      if (ottava.value !== 0) attrs["oct.ges"] = h.pitch.octave + ottava.value;
      if (!h.accidental && alter !== 0) attrs["accid.ges"] = GESTURAL[alter];
      return { attrs, children: h.accidental ? [el("accid", { accid: WRITTEN[h.accidental] })] : [], alter };
    });
  }

  // The alteration a note takes over by a tie: a curve that ends on it, opened on the note just before in its voice,
  // of the same letter and octave, without a different printed accidental (§6, "Curves").
  private tieFrom(v: VoiceState, marks: Mark[], head: Head): number | null {
    for (const m of marks) {
      if (m.kind !== "curve" || m.open) continue;
      const start = v.curves.get(m.number);
      if (!start || start.pitch === null || start.alter === null) continue;
      if (start.index !== v.index) continue; // not the note just before
      if (start.pitch.letter !== head.pitch.letter || start.pitch.octave !== head.pitch.octave) continue;
      if (head.accidental && ALTER[head.accidental] !== start.alter) continue;
      return start.alter;
    }
    return null;
  }

  // The marks after a note, rest or chord (or a chord's head), as control events. `note`: the single pitch it carries,
  // for ties.
  private marks(marks: Mark[], id: string, ctx: RunContext, note: { pitch: Pitch; alter: number } | null) {
    const { place } = ctx;
    const v = this.voice(ctx.run.voice);
    const staff = ctx.staff;
    const add = (e: XmlElement) => this.controls.push({ el: e, part: place.part });
    const between = (placement: string | null) => (placement === "_" ? this.bracedBelow(place.system, staff) : null);
    const staffOf = (placement: string | null) => {
      const below = between(placement);
      return below !== null ? `${staff} ${below}` : String(staff);
    };
    const ref = `#${id}`;
    // Curves: those that end, then those that start.
    for (const m of [...marks.filter((x) => x.kind === "curve" && !x.open), ...marks.filter((x) => !(x.kind === "curve" && !x.open))]) {
      switch (m.kind) {
        case "curve": {
          if (!m.open) {
            const start = v.curves.get(m.number);
            if (!start) break;
            v.curves.delete(m.number);
            const tie = note !== null && start.pitch !== null && start.index === v.index && start.pitch.letter === note.pitch.letter && start.pitch.octave === note.pitch.octave && start.alter === note.alter;
            start.open.el.name = tie ? "tie" : "slur";
            setRef(start.open, "endid", id);
          } else {
            const e = el("slur", { startid: ref, endid: "" });
            const open = { el: e };
            add(e);
            v.curves.set(m.number, { id, pitch: note?.pitch ?? null, alter: note?.alter ?? null, index: v.index + 1, open });
          }
          break;
        }
        case "fingering":
          add(el("fing", { startid: ref, staff }, [String(m.finger)]));
          break;
        case "articulation":
          break; // on the note itself
        case "text": {
          const dynamic = isDynamicText(m.text);
          if (dynamic) this.endHairpin(v, id);
          add(el(dynamic ? "dynam" : "dir", { startid: ref, staff: dynamic ? staffOf(m.placement) : staff }, [m.text]));
          break;
        }
        case "jump":
          add(el("repeatMark", { func: JUMP_FUNC[m.text], startid: ref, staff }, [m.text]));
          break;
        case "beam":
          break; // the layer's beams
        case "command":
          this.command(m.name, m.placement, id, ctx, staffOf, add);
          break;
      }
    }
  }

  private command(name: string, placement: string | null, id: string, ctx: RunContext, staffOf: (p: string | null) => string, add: (e: XmlElement) => void) {
    const v = this.voice(ctx.run.voice);
    const staff = ctx.staff;
    const ref = `#${id}`;
    if (name === "<" || name === ">") {
      this.endHairpin(v, id);
      const e = el("hairpin", { form: name === "<" ? "cres" : "dim", startid: ref, endid: "", staff: staffOf(placement) });
      v.hairpin = { el: e };
      add(e);
    } else if (name === "!") {
      this.endHairpin(v, id);
    } else if (["ppp", "pp", "p", "mp", "mf", "f", "ff", "fff", "sf", "sfz", "fz", "fp", "sfp", "rfz"].includes(name)) {
      this.endHairpin(v, id);
      add(el("dynam", { startid: ref, staff: staffOf(placement) }, [name]));
    } else if (name === "fermata") {
      add(el("fermata", { startid: ref, staff }));
    } else if (name === "trill") {
      add(el("trill", { startid: ref, staff }));
    } else if (name === "startTrillSpan") {
      const e = el("trill", { startid: ref, endid: "", extender: "true", staff });
      v.trill = { el: e };
      add(e);
    } else if (name === "stopTrillSpan") {
      if (v.trill) setRef(v.trill, "endid", id);
      v.trill = null;
    } else if (name === "mordent" || name === "prall") {
      add(el("mordent", { startid: ref, form: name === "prall" ? "upper" : "lower", staff }));
    } else if (name === "turn") {
      add(el("turn", { startid: ref, staff }));
    } else if (name === "arpeggio") {
      add(el("arpeg", { plist: ref, staff }));
    } else if (name === "glissando") {
      const e = el("gliss", { startid: ref, endid: "", staff });
      v.gliss = { el: e };
      add(e);
    } else if (name === "laissezVibrer") {
      add(el("lv", { startid: ref, staff }));
    } else if (name === "sustainOn" || name === "sustainOff") {
      add(el("pedal", { dir: name === "sustainOn" ? "down" : "up", startid: ref, staff }));
    } else if (name === "unaCorda" || name === "treCorde") {
      add(el("pedal", { dir: name === "unaCorda" ? "down" : "up", func: "soft", startid: ref, staff }));
    }
  }

  private endHairpin(v: VoiceState, id: string) {
    if (!v.hairpin) return;
    setRef(v.hairpin, "endid", id);
    v.hairpin = null;
  }

  // The staff below a staff in the same brace on the system (§6, "Dynamics between staves"), or null.
  private bracedBelow(system: LensSystem, staff: number): number | null {
    const order = system.staves.map((s) => s.staff);
    for (const g of system.groups) {
      if (g.symbol !== "brace") continue;
      const inOrder = order.filter((n) => g.staves.includes(n));
      const at = inOrder.indexOf(staff);
      if (at >= 0 && at + 1 < inOrder.length) return inOrder[at + 1];
    }
    return null;
  }

  // The measure element: its staves and layers from the parts asked for, its bar lines, its control events.
  private measureElement(m: ScoreMeasure, built: BuiltMeasure, parts: number[], alone: boolean): XmlElement {
    const { score, piece } = this;
    const partsOf = parts.map((j) => m.parts[j]);
    const stretches = partsOf.flatMap((p) => p.stretches.map((s) => ({ system: p.system, stretch: s, data: score.stretch(p.system, s) })));
    // A glissando closes on the next note of its voice: done here, after the measure's notes are known.
    const lastStretch = stretches[stretches.length - 1].data.stretch;
    const systemStaves = new Set(partsOf.flatMap((p) => score.system(p.system).answer.staves.map((s) => s.staff)));
    const staffOrder = piece.staves.map((s) => s.staff).filter((n) => systemStaves.has(n));
    // Each voice's home: the staff it starts on in the measure.
    const home = new Map<number, number>();
    for (const s of stretches) for (const r of s.data.runs) if (!home.has(r.voice)) home.set(r.voice, r.staff);
    const staffEls = staffOrder.map((staff) => {
      const voices = [...home.entries()].filter(([, h]) => h === staff).map(([v]) => v).sort((a, b) => a - b);
      const layers = (voices.length ? voices : [null]).map((v, li) => {
        const children: XmlNode[] = [];
        for (const [i, s] of stretches.entries()) {
          const prev = stretches[i - 1];
          if (prev && prev.system !== s.system) children.push(el("sb"));
          const nodes = v === null ? null : built.content.get(`${v}/${s.system}/${s.stretch}`);
          if (nodes) children.push(...nodes);
          else if (s.data.length.n > 0) children.push(...spaceValues(s.data.length).map((d) => el("space", durAttrs(d))));
          // A bar line inside the measure (not at a system's end, where the system break is).
          const next = stretches[i + 1];
          if (next && next.system === s.system && s.data.stretch.rightBarLine !== "none") {
            children.push(el("barLine", { form: s.data.stretch.rightBarLine === "single" ? "single" : BAR_FORMS[s.data.stretch.rightBarLine] }));
          }
        }
        const description = v === null ? undefined : piece.voices.find((x) => x.voice === v)?.description;
        return el("layer", { n: li + 1, label: description }, children);
      });
      return el("staff", { n: staff }, layers);
    });
    const ids = new Set<string>();
    for (const s of staffEls) for (const e of elements(s)) {
      const id = e.attrs.find(([k]) => k === "xml:id")?.[1];
      if (id) ids.add(id);
    }
    const controls = built.controls
      .filter((c) => parts.includes(c.part) || !alone)
      .filter((c) => {
        const refs = refsOf(c.el);
        if (refs.some((r) => r === "")) return false; // never closed
        return !alone || refs.every((r) => ids.has(r));
      })
      .map((c) => c.el);
    const isFirstPart = parts[0] === 0;
    const system = score.system(partsOf[0].system);
    const startRepeat = isFirstPart && ((stretches[0].stretch === firstStretch(system.answer) && system.answer.startRepeat) || this.previousStartsRepeat(m));
    const attrs: Record<string, string | number | undefined> = {
      "xml:id": alone ? `p${piece.index + 1}m${m.index + 1}${m.parts.length > 1 ? `-${parts[0] + 1}` : ""}` : `p${piece.index + 1}m${m.index + 1}`,
      n: m.count > 1 ? `${m.n}–${m.n + m.count - 1}` : m.n,
      metcon: m.kind === "incomplete" || (alone && m.parts.length > 1) ? "false" : undefined,
      left: startRepeat ? "rptstart" : undefined,
      // A start repeat between two measures is the next one's left bar line.
      right: lastStretch.rightBarLine === "startRepeat" ? undefined : BAR_RENDITION[lastStretch.rightBarLine],
      facs: !alone && m.parts.every((p) => score.system(p.system).box) ? m.parts.map((p) => `#${zoneId(p.system, p.stretches)}`).join(" ") : undefined,
    };
    return el("measure", attrs, [...staffEls, ...controls]);
  }

  // A start-repeat bar line at the end of the measure before it.
  private previousStartsRepeat(m: ScoreMeasure): boolean {
    const prev = this.piece.measures[m.index - 1];
    if (!prev) return false;
    const last = prev.parts[prev.parts.length - 1];
    const s = this.score.stretch(last.system, last.stretches[last.stretches.length - 1]).stretch;
    return s.rightBarLine === "startRepeat";
  }
}

const BAR_FORMS: Partial<Record<LensStretch["rightBarLine"], string>> = { double: "dbl", final: "end", startRepeat: "rptstart", endRepeat: "rptend", bothRepeats: "rptboth", dashed: "dashed" };

type RunContext = { run: Run; place: Place; home: number; staff: number; stem: "up" | "down" | null; k: number };
type BuiltMeasure = { content: Map<string, XmlNode[]>; controls: Control[]; changes: XmlElement[] };

function firstStretch(answer: LensSystem): number {
  return answer.stretches.find((s) => s.class !== "none")?.stretch ?? 1;
}

function sub(a: Fraction, b: Fraction): Fraction {
  return fraction(a.n * b.d - b.n * a.d, a.d * b.d);
}

function eventLength(event: Event): Fraction {
  return eventsDuration([event]);
}

function setRef(open: Open, attr: "endid", id: string | null) {
  if (!id) return;
  open.el.attrs = open.el.attrs.map(([k, v]) => [k, k === attr ? `#${id}` : v]);
}

function refsOf(e: XmlElement): string[] {
  return e.attrs.filter(([k]) => k === "startid" || k === "endid" || k === "plist").flatMap(([, v]) => (v === "" ? [""] : v.split(/\s+/).map((x) => x.replace(/^#/, ""))));
}

// Every event with its onset (grace notes take no time, tuplets scale their notes, a tremolo lasts its count).
function walkTimed(events: Event[], start: Fraction, visit: (e: Event, onset: Fraction) => void, scale = fraction(1)): Fraction {
  let onset = start;
  for (const e of events) {
    visit(e, onset);
    if (e.e === "tuplet") walkTimed(e.body, onset, visit, mul(scale, fraction(e.m, e.n)));
    else if (e.e === "grace") walkTimed(e.body, onset, visit, ZERO);
    else if (e.e === "tremolo") walkTimed(e.body, onset, visit, mul(scale, fraction(e.count)));
    onset = add(onset, mul(eventLength(e), scale));
  }
  return onset;
}

