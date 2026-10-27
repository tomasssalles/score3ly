// The symbolic format (docs/notation.md, "The symbolic format"): the music of one voice in one stretch, as a string in
// LilyPond's notation with our differences. The model reports the symbols printed; code works out what they mean.
// This file lexes and parses a string into events, and rejects anything that isn't one of our tokens or breaks a
// rule of the format. Durations, marks left open and the rest are worked out from the events (durations.ts,
// spans.ts).

// Raise whenever the format changes: what the prompt describes, what the parser accepts.
export const LENS_VERSION = 3;

export const ACCIDENTALS = ["flat", "sharp", "natural", "doubleflat", "doublesharp"] as const;
export type Accidental = (typeof ACCIDENTALS)[number];

export const DYNAMICS = ["ppp", "pp", "p", "mp", "mf", "f", "ff", "fff", "sf", "sfz", "fz", "fp", "sfp", "rfz"] as const;

// Marks after the note, rest or chord they belong to, by their command's name.
export const POST_COMMANDS = [
  ...DYNAMICS,
  "fermata",
  "trill",
  "mordent",
  "prall",
  "turn",
  "arpeggio",
  "glissando",
  "laissezVibrer",
  "startTrillSpan",
  "stopTrillSpan",
  "sustainOn",
  "sustainOff",
  "unaCorda",
  "treCorde",
] as const;

// Events of their own, between notes, at their point in time.
export const EVENT_COMMANDS = ["breathe", "caesura", "segnoMark", "codaMark", "fine"] as const;

// LilyPond's clefs (decided, §6), with the synonyms code normalizes.
export const CLEFS = ["treble", "bass", "alto", "tenor", "soprano", "mezzosoprano", "baritone", "varbaritone", "subbass", "french"] as const;
const CLEF_SYNONYMS: Record<string, string> = { G: "treble", violin: "treble", F: "bass", C: "alto" };
const CLEF_SUFFIXES = ["_8", "^8", "_15", "^15"];

// The jump instructions, as quoted text from this list (§6, "Navigation marks").
export const JUMPS = ["D.C.", "D.C. al Fine", "D.C. al Coda", "D.S.", "D.S. al Fine", "D.S. al Coda", "To Coda"] as const;

// The articulations written with a placement prefix: `-.` `-!` `->` `-^` `--` `-_`.
const ARTICULATIONS: Record<string, string> = { ".": "staccato", "!": "staccatissimo", ">": "accent", "^": "marcato", "-": "tenuto", _: "portato" };

export type Placement = "-" | "^" | "_" | null;

// A note's place on the staff: its letter and its octave, LilyPond's absolute octaves (c is octave 3, c' middle C).
export type Pitch = { letter: "a" | "b" | "c" | "d" | "e" | "f" | "g"; octave: number };

// A note value: 1 (whole) to 128, or 0.5 for a breve; with its dots.
export type Duration = { base: number; dots: number };

export type Mark =
  | { kind: "articulation"; name: string; placement: Placement }
  | { kind: "fingering"; finger: number; placement: Placement }
  | { kind: "command"; name: (typeof POST_COMMANDS)[number] | "<" | ">" | "!"; placement: Placement }
  | { kind: "text"; text: string; placement: Placement }
  | { kind: "jump"; text: (typeof JUMPS)[number]; placement: Placement }
  | { kind: "curve"; number: number; open: boolean; placement: Placement }
  | { kind: "beam"; open: boolean };

// One note of a chord: its own accidental, fingering and curves.
export type Head = { pitch: Pitch; accidental: Accidental | null; marks: Mark[] };

export type Event =
  | { e: "note"; head: Head; duration: Duration; tremolo: number | null; marks: Mark[] }
  | { e: "chord"; heads: Head[]; duration: Duration; tremolo: number | null; marks: Mark[] }
  | { e: "rest"; visible: boolean; duration: Duration; marks: Mark[] }
  | { e: "measureRest"; duration: Duration; count: number; marks: Mark[] }
  | { e: "clef"; clef: string } // normalized: "treble", "treble_8", …
  | { e: "ottava"; value: number }
  | { e: "changeStaff"; staff: number }
  | { e: "stem"; direction: "up" | "down" | "neutral" }
  | { e: "event"; name: (typeof EVENT_COMMANDS)[number] }
  | { e: "tempo"; tempo: Tempo }
  | { e: "tuplet"; n: number; m: number; body: Event[] } // \tuplet n/m: n notes in the time of m
  | { e: "grace"; kind: "grace" | "acciaccatura" | "appoggiatura"; body: Event[] }
  | { e: "tremolo"; count: number; body: Event[] }; // \repeat tremolo count { … }

// A tempo mark (LilyPond's \tempo): its text as printed and/or a metronome mark, a note value equal to a number of
// beats per minute or a range of them (`\tempo "Allegro" 4 = 132`, `\tempo 4. = 60`, `\tempo 4 = 120-132`,
// `\tempo "Andante"`).
export type Tempo = { text: string | null; unit: Duration | null; bpm: number | null; bpmMax: number | null };

export type Parsed = { events: Event[] } | { problem: string };

// Note symbols a metronome mark is printed with: Unicode's (♩ ♪ ♫ ♬, and the musical symbols block's notes) and SMuFL's
// metronome glyphs.
const METRONOME_IN_TEXT = /[\u2669-\u266C\u{1D15D}-\u{1D164}\uE1D0-\uE1EF]/u;

// --- Lexing -----------------------------------------------------------------------------------------------------

type Token =
  | { t: "note"; pitch: Pitch; duration: Duration | null; tremolo: number | null }
  | { t: "rest"; visible: boolean; duration: Duration | null }
  | { t: "measureRest"; duration: Duration | null; count: number }
  | { t: "chordStart" }
  | { t: "chordEnd"; duration: Duration | null; tremolo: number | null }
  | { t: "open" } // {
  | { t: "close" } // }
  | { t: "mark"; mark: Mark }
  | { t: "accidental"; name: Accidental }
  | { t: "clef"; clef: string }
  | { t: "ottava"; value: number }
  | { t: "changeStaff"; staff: number }
  | { t: "stem"; direction: "up" | "down" | "neutral" }
  | { t: "event"; name: (typeof EVENT_COMMANDS)[number] }
  | { t: "tempo"; tempo: Tempo }
  | { t: "tuplet"; n: number; m: number }
  | { t: "grace"; kind: "grace" | "acciaccatura" | "appoggiatura" }
  | { t: "tremolo"; count: number };

type Located = Token & { at: number };

class LexError extends Error {}

const DURATION = /^(\\breve|128|64|32|16|8|4|2|1)(\.*)/;
const TREMOLO = /^:(8|16|32|64|128)/;

function duration(text: string, i: number): { duration: Duration | null; length: number } {
  const m = DURATION.exec(text.slice(i));
  if (!m) return { duration: null, length: 0 };
  return { duration: { base: m[1] === "\\breve" ? 0.5 : Number(m[1]), dots: m[2].length }, length: m[0].length };
}

function tremolo(text: string, i: number): { tremolo: number | null; length: number } {
  const m = TREMOLO.exec(text.slice(i));
  return m ? { tremolo: Number(m[1]), length: m[0].length } : { tremolo: null, length: 0 };
}

// Quoted text from the quote at `i`: to the closing quote, with \" for a quote inside it.
function quoted(text: string, i: number): { value: string; length: number } {
  let value = "";
  let j = i + 1;
  while (j < text.length && text[j] !== '"') {
    if (text[j] === "\\" && text[j + 1] === '"') {
      value += '"';
      j += 2;
    } else {
      value += text[j++];
    }
  }
  if (j >= text.length) throw new LexError(`at ${i + 1}: a quoted text isn't closed`);
  return { value, length: j + 1 - i };
}

const WORD = /^\\([a-zA-Z]+)/;

function skipSpace(text: string, i: number): number {
  while (i < text.length && /\s/.test(text[i])) i++;
  return i;
}

// A clef as written ("treble", "G", "treble_8"), normalized ("treble", "treble_8"), or null if it isn't one.
export function normalizeClef(raw: string): string | null {
  const suffix = CLEF_SUFFIXES.find((s) => raw.endsWith(s)) ?? "";
  const base = raw.slice(0, raw.length - suffix.length);
  const name = CLEF_SYNONYMS[base] ?? base;
  return (CLEFS as readonly string[]).includes(name) ? name + suffix : null;
}

function clefName(raw: string, at: number): string {
  const name = normalizeClef(raw);
  if (!name) throw new LexError(`at ${at + 1}: "${raw}" isn't a clef`);
  return name;
}

// A command's token, from the backslash at `i`: its arguments read too.
function command(text: string, i: number, placement: Placement): { token: Token; length: number } {
  const src = text;
  // \< \> \! (hairpins and their end)
  if ("<>!".includes(text[i + 1] ?? "")) {
    return { token: { t: "mark", mark: { kind: "command", name: text[i + 1] as "<" | ">" | "!", placement } }, length: 2 };
  }
  // \=N( and \=N): a curve
  const curve = /^\\=(\d+)([()])/.exec(text.slice(i));
  if (curve) {
    const mark: Mark = { kind: "curve", number: Number(curve[1]), open: curve[2] === "(", placement };
    return { token: { t: "mark", mark }, length: curve[0].length };
  }
  const word = WORD.exec(text.slice(i));
  if (!word) throw new LexError(`at ${i + 1}: "\\" isn't followed by a command`);
  const name = word[1];
  let j = i + word[0].length;
  const at = i;
  if ((POST_COMMANDS as readonly string[]).includes(name)) {
    return { token: { t: "mark", mark: { kind: "command", name: name as (typeof POST_COMMANDS)[number], placement } }, length: j - i };
  }
  if (placement !== null) throw new LexError(`at ${at + 1}: "\\${name}" can't have a placement prefix`);
  if ((ACCIDENTALS as readonly string[]).includes(name)) return { token: { t: "accidental", name: name as Accidental }, length: j - i };
  if ((EVENT_COMMANDS as readonly string[]).includes(name)) {
    return { token: { t: "event", name: name as (typeof EVENT_COMMANDS)[number] }, length: j - i };
  }
  if (name === "stemUp" || name === "stemDown" || name === "stemNeutral") {
    const direction = name === "stemUp" ? "up" : name === "stemDown" ? "down" : "neutral";
    return { token: { t: "stem", direction }, length: j - i };
  }
  if (name === "grace" || name === "acciaccatura" || name === "appoggiatura") return { token: { t: "grace", kind: name }, length: j - i };
  if (name === "clef") {
    j = skipSpace(text, j);
    let raw: string;
    if (text[j] === '"') {
      const q = quoted(text, j);
      raw = q.value;
      j += q.length;
    } else {
      const m = /^[a-zA-Z]+(_8|\^8|_15|\^15)?/.exec(text.slice(j));
      if (!m) throw new LexError(`at ${at + 1}: "\\clef" needs the clef's name`);
      raw = m[0];
      j += m[0].length;
    }
    return { token: { t: "clef", clef: clefName(raw, at) }, length: j - i };
  }
  if (name === "tempo") {
    let text: string | null = null;
    j = skipSpace(src, j);
    if (src[j] === '"') {
      const q = quoted(src, j);
      text = q.value;
      j += q.length;
    }
    let unit: Duration | null = null;
    let bpm: number | null = null;
    let bpmMax: number | null = null;
    const k = skipSpace(src, j);
    const d = duration(src, k);
    if (d.duration) {
      const m = /^\s*=\s*(\d+)(?:\s*[-–]\s*(\d+))?/.exec(src.slice(k + d.length));
      if (!m) throw new LexError(`at ${at + 1}: "\\tempo": a note value is followed by "=" and a number, e.g. "\\tempo 4 = 120"`);
      unit = d.duration;
      bpm = Number(m[1]);
      bpmMax = m[2] === undefined ? null : Number(m[2]);
      if (bpm < 1 || (bpmMax !== null && bpmMax <= bpm)) throw new LexError(`at ${at + 1}: "\\tempo": ${bpm}${bpmMax === null ? "" : `-${bpmMax}`} isn't a tempo`);
      j = k + d.length + m[0].length;
    }
    if (text === null && unit === null) throw new LexError(`at ${at + 1}: "\\tempo" needs a text, a metronome mark or both, e.g. \\tempo "Allegro" 4 = 132`);
    if (text !== null && text.trim() === "") throw new LexError(`at ${at + 1}: "\\tempo": the text is empty`);
    // The metronome mark goes after the text, as a note value and a number, never inside it: code needs its numbers.
    if (text !== null && (METRONOME_IN_TEXT.test(text) || /=\s*\d/.test(text))) {
      throw new LexError(`at ${at + 1}: "\\tempo": write the metronome mark after the text, not in it, e.g. \\tempo "Allegro" 4 = 132`);
    }
    return { token: { t: "tempo", tempo: { text, unit, bpm, bpmMax } }, length: j - i };
  }
  if (name === "ottava") {
    const m = /^\s*#(-?\d+)/.exec(text.slice(j));
    if (!m) throw new LexError(`at ${at + 1}: "\\ottava" needs a number, e.g. "\\ottava #1"`);
    const value = Number(m[1]);
    if (value < -2 || value > 2) throw new LexError(`at ${at + 1}: "\\ottava #${value}": only -2 to 2`);
    return { token: { t: "ottava", value }, length: j + m[0].length - i };
  }
  if (name === "change") {
    const m = /^\s*Staff\s*=\s*(?:"(\d+)"|(\d+))/.exec(text.slice(j));
    if (!m) throw new LexError(`at ${at + 1}: "\\change" is written \\change Staff = "N", with the staff's number`);
    return { token: { t: "changeStaff", staff: Number(m[1] ?? m[2]) }, length: j + m[0].length - i };
  }
  if (name === "tuplet") {
    const m = /^\s*(\d+)\/(\d+)/.exec(text.slice(j));
    if (!m) throw new LexError(`at ${at + 1}: "\\tuplet" needs its fraction, e.g. "\\tuplet 3/2"`);
    const n = Number(m[1]);
    const d = Number(m[2]);
    if (n < 1 || d < 1) throw new LexError(`at ${at + 1}: "\\tuplet ${n}/${d}" isn't a tuplet`);
    return { token: { t: "tuplet", n, m: d }, length: j + m[0].length - i };
  }
  if (name === "repeat") {
    const m = /^\s*tremolo\s+(\d+)/.exec(text.slice(j));
    if (!m) throw new LexError(`at ${at + 1}: only "\\repeat tremolo N { … }" is allowed`);
    const count = Number(m[1]);
    if (count < 1) throw new LexError(`at ${at + 1}: a tremolo needs a count of at least 1`);
    return { token: { t: "tremolo", count }, length: j + m[0].length - i };
  }
  throw new LexError(`at ${at + 1}: "\\${name}" isn't part of the format`);
}

// The mark after a placement prefix at `i` (`-`, `^` or `_`).
function prefixed(text: string, i: number): { token: Token; length: number } {
  const placement = text[i] as "-" | "^" | "_";
  const next = text[i + 1];
  if (next === undefined) throw new LexError(`at ${i + 1}: "${placement}" isn't followed by a mark`);
  if (next in ARTICULATIONS) {
    return { token: { t: "mark", mark: { kind: "articulation", name: ARTICULATIONS[next], placement } }, length: 2 };
  }
  if (/[1-5]/.test(next) && !/\d/.test(text[i + 2] ?? "")) {
    return { token: { t: "mark", mark: { kind: "fingering", finger: Number(next), placement } }, length: 2 };
  }
  if (next === '"') {
    const q = quoted(text, i + 1);
    const jump = (JUMPS as readonly string[]).includes(q.value);
    const mark: Mark = jump ? { kind: "jump", text: q.value as (typeof JUMPS)[number], placement } : { kind: "text", text: q.value, placement };
    return { token: { t: "mark", mark }, length: 1 + q.length };
  }
  if (next === "\\") {
    const c = command(text, i + 1, placement);
    if (c.token.t !== "mark") throw new LexError(`at ${i + 1}: "${placement}" can only come before a mark`);
    return { token: c.token, length: 1 + c.length };
  }
  throw new LexError(`at ${i + 1}: "${placement}${next}" isn't a mark`);
}

function lex(text: string): Located[] {
  const tokens: Located[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const at = i;
    let token: Token;
    let length: number;
    const note = /^([a-g])('+|,+)?/.exec(text.slice(i));
    if (note && !/[a-z]/.test(text[i + note[0].length] ?? "")) {
      const marks = note[2] ?? "";
      const octave = 3 + (marks.startsWith("'") ? marks.length : -marks.length);
      let j = i + note[0].length;
      const d = duration(text, j);
      j += d.length;
      const tr = tremolo(text, j);
      j += tr.length;
      token = { t: "note", pitch: { letter: note[1] as Pitch["letter"], octave }, duration: d.duration, tremolo: tr.tremolo };
      length = j - i;
    } else if ((c === "r" || c === "s") && !/[a-z]/.test(text[i + 1] ?? "")) {
      const d = duration(text, i + 1);
      token = { t: "rest", visible: c === "r", duration: d.duration };
      length = 1 + d.length;
    } else if (c === "R") {
      const d = duration(text, i + 1);
      const m = /^\*(\d+)/.exec(text.slice(i + 1 + d.length));
      const count = m ? Number(m[1]) : 1;
      if (count < 1) throw new LexError(`at ${at + 1}: a multi-measure rest needs a count of at least 1`);
      token = { t: "measureRest", duration: d.duration, count };
      length = 1 + d.length + (m ? m[0].length : 0);
    } else if (c === "<") {
      token = { t: "chordStart" };
      length = 1;
    } else if (c === ">") {
      const d = duration(text, i + 1);
      const tr = tremolo(text, i + 1 + d.length);
      token = { t: "chordEnd", duration: d.duration, tremolo: tr.tremolo };
      length = 1 + d.length + tr.length;
    } else if (c === "{") {
      token = { t: "open" };
      length = 1;
    } else if (c === "}") {
      token = { t: "close" };
      length = 1;
    } else if (c === "[" || c === "]") {
      token = { t: "mark", mark: { kind: "beam", open: c === "[" } };
      length = 1;
    } else if (c === "-" || c === "^" || c === "_") {
      ({ token, length } = prefixed(text, i));
    } else if (c === "\\") {
      ({ token, length } = command(text, i, null));
    } else if (c === '"') {
      throw new LexError(`at ${at + 1}: a quoted text needs a placement prefix, e.g. ^"dolce"`);
    } else if (c === "~") {
      throw new LexError(`at ${at + 1}: "~" isn't part of the format: write every tie as a curve, \\=N( … \\=N)`);
    } else if (c === "(" || c === ")") {
      throw new LexError(`at ${at + 1}: "${c}" isn't part of the format: write every slur as a curve, \\=N( … \\=N)`);
    } else {
      const word = /^[a-zA-Z]+/.exec(text.slice(i));
      throw new LexError(`at ${at + 1}: "${word ? word[0] : c}" isn't part of the format`);
    }
    tokens.push({ ...token, at });
    i += length;
  }
  return tokens;
}

// --- Parsing ----------------------------------------------------------------------------------------------------

class ParseError extends Error {}

const markName = (m: Mark): string => {
  switch (m.kind) {
    case "articulation":
      return m.name;
    case "fingering":
      return `fingering ${m.finger}`;
    case "command":
      return `\\${m.name}`;
    case "text":
    case "jump":
      return `"${m.text}"`;
    case "curve":
      return `\\=${m.number}${m.open ? "(" : ")"}`;
    case "beam":
      return m.open ? "[" : "]";
  }
};

// Marks a rest may carry: no curves, articulations or fingering, which belong to notes.
function allowedOnRest(m: Mark): boolean {
  if (m.kind === "curve" || m.kind === "fingering") return false;
  if (m.kind === "articulation") return false;
  if (m.kind === "command") return !["arpeggio", "glissando", "laissezVibrer", "trill", "mordent", "prall", "turn"].includes(m.name);
  return true;
}

export function parseVoice(text: string): Parsed {
  let tokens: Located[];
  try {
    tokens = lex(text);
  } catch (err) {
    if (err instanceof LexError) return { problem: err.message };
    throw err;
  }
  let i = 0;
  const peek = () => tokens[i];
  const where = (t: Located | undefined) => (t ? `at ${t.at + 1}` : "at the end");

  // A sequence of events up to `}` (inside a group) or the end. `inTuplet` forbids nesting tuplets.
  function sequence(inGroup: boolean, inTuplet: boolean): Event[] {
    const events: Event[] = [];
    // The event post-events attach to: the last note, chord or rest, while only marks follow it.
    let last: Extract<Event, { marks: Mark[] }> | null = null;
    while (i < tokens.length) {
      const t = tokens[i];
      if (t.t === "close") {
        if (!inGroup) throw new ParseError(`${where(t)}: "}" without its "{"`);
        return events;
      }
      i++;
      switch (t.t) {
        case "mark": {
          if (!last) throw new ParseError(`${where(t)}: ${markName(t.mark)} isn't after a note, rest or chord`);
          if (last.e === "rest" || last.e === "measureRest") {
            if (!allowedOnRest(t.mark)) throw new ParseError(`${where(t)}: ${markName(t.mark)} can't be on a rest`);
            if (last.e === "measureRest" && t.mark.kind === "beam") throw new ParseError(`${where(t)}: a beam can't be on a whole-measure rest`);
          }
          last.marks.push(t.mark);
          continue;
        }
        case "accidental":
        case "note": {
          const head = noteHead(t);
          const at = tokens[i - 1];
          const n = tokens[i - 1] as Extract<Token, { t: "note" }> & { at: number };
          if (!n.duration) throw new ParseError(`${where(at)}: the note has no duration (every note has its own)`);
          const event: Event = { e: "note", head, duration: n.duration, tremolo: n.tremolo, marks: [] };
          events.push(event);
          last = event;
          continue;
        }
        case "rest": {
          if (!t.duration) throw new ParseError(`${where(t)}: the rest has no duration`);
          const event: Event = { e: "rest", visible: t.visible, duration: t.duration, marks: [] };
          events.push(event);
          last = event;
          continue;
        }
        case "measureRest": {
          if (!t.duration) throw new ParseError(`${where(t)}: the whole-measure rest has no duration (e.g. R1 in 4/4)`);
          const event: Event = { e: "measureRest", duration: t.duration, count: t.count, marks: [] };
          events.push(event);
          last = event;
          continue;
        }
        case "chordStart": {
          const heads: Head[] = [];
          while (i < tokens.length && tokens[i].t !== "chordEnd") {
            const inner = tokens[i++];
            if (inner.t === "note" || inner.t === "accidental") {
              const head = noteHead(inner);
              const n = tokens[i - 1] as Extract<Token, { t: "note" }> & { at: number };
              if (n.duration || n.tremolo) throw new ParseError(`${where(n)}: a note in a chord has no duration of its own: it goes after ">"`);
              heads.push(head);
            } else if (inner.t === "mark" && (inner.mark.kind === "fingering" || inner.mark.kind === "curve")) {
              if (heads.length === 0) throw new ParseError(`${where(inner)}: ${markName(inner.mark)} isn't after a note of the chord`);
              heads[heads.length - 1].marks.push(inner.mark);
            } else {
              throw new ParseError(`${where(inner)}: only notes, their accidentals, fingering and curves can be inside "< >"`);
            }
          }
          const end = tokens[i++] as (Located & { t: "chordEnd" }) | undefined;
          if (!end) throw new ParseError(`${where(t)}: the chord isn't closed with ">"`);
          if (heads.length === 0) throw new ParseError(`${where(t)}: the chord has no notes`);
          if (!end.duration) throw new ParseError(`${where(end)}: the chord has no duration (it goes after ">", e.g. <c' e'>4)`);
          const event: Event = { e: "chord", heads, duration: end.duration, tremolo: end.tremolo, marks: [] };
          events.push(event);
          last = event;
          continue;
        }
        case "chordEnd":
          throw new ParseError(`${where(t)}: ">" without its "<"`);
        case "open":
          throw new ParseError(`${where(t)}: "{" can only follow \\tuplet, \\repeat tremolo or a grace command`);
        case "clef":
          events.push({ e: "clef", clef: t.clef });
          break;
        case "ottava":
          events.push({ e: "ottava", value: t.value });
          break;
        case "changeStaff":
          events.push({ e: "changeStaff", staff: t.staff });
          break;
        case "stem":
          events.push({ e: "stem", direction: t.direction });
          break;
        case "event":
          events.push({ e: "event", name: t.name });
          break;
        case "tempo":
          // A tempo mark is for the music from that point on: not inside a tuplet, grace group or tremolo.
          if (inGroup) throw new ParseError(`${where(t)}: \\tempo can't be inside "{ }"`);
          events.push({ e: "tempo", tempo: t.tempo });
          break;
        case "tuplet": {
          if (inTuplet) throw new ParseError(`${where(t)}: tuplets can't be nested`);
          events.push({ e: "tuplet", n: t.n, m: t.m, body: group(t, true) });
          break;
        }
        case "tremolo": {
          const body = group(t, inTuplet);
          if (!body.some((e) => e.e === "note" || e.e === "chord")) throw new ParseError(`${where(t)}: the tremolo has no notes`);
          events.push({ e: "tremolo", count: t.count, body });
          break;
        }
        case "grace": {
          // One note or chord, or a group in braces.
          if (peek()?.t === "open") {
            events.push({ e: "grace", kind: t.kind, body: group(t, inTuplet) });
          } else {
            const next = peek();
            if (!next || (next.t !== "note" && next.t !== "accidental" && next.t !== "chordStart")) {
              throw new ParseError(`${where(t)}: \\${t.kind} needs a note, a chord or "{ … }" after it`);
            }
            const body = singleNote();
            events.push({ e: "grace", kind: t.kind, body });
          }
          break;
        }
      }
      last = null;
    }
    if (inGroup) throw new ParseError(`at the end: a "{" isn't closed`);
    return events;
  }

  // The group in braces after a command: "{ … }", parsed as a sequence.
  function group(command: Located, inTuplet: boolean): Event[] {
    const open = tokens[i];
    if (!open || open.t !== "open") throw new ParseError(`${where(command)}: "{" is missing after the command`);
    i++;
    const body = sequence(true, inTuplet);
    i++; // the "}"
    return body;
  }

  // A single grace note or chord, with its marks: parsed as a sequence of one.
  function singleNote(): Event[] {
    const start = i;
    // Find where the note or chord ends: the chord's ">", or the note itself, then its marks.
    if (tokens[i].t === "chordStart") {
      while (i < tokens.length && tokens[i].t !== "chordEnd") i++;
      i++;
    } else {
      if (tokens[i].t === "accidental") i++;
      i++;
    }
    while (i < tokens.length && tokens[i].t === "mark") i++;
    const end = i;
    const saved = tokens;
    tokens = tokens.slice(start, end);
    const keep = i;
    i = 0;
    try {
      return sequence(false, false);
    } finally {
      tokens = saved;
      i = keep;
    }
  }

  // A note's head from an accidental or a note token at i - 1; an accidental takes the note right after it.
  function noteHead(t: Located): Head {
    let accidental: Accidental | null = null;
    let note = t;
    if (t.t === "accidental") {
      accidental = t.name;
      const next = tokens[i];
      if (!next || next.t !== "note") throw new ParseError(`${where(t)}: \\${t.name} must come right before its note`);
      i++;
      note = next;
    }
    const n = note as Extract<Token, { t: "note" }>;
    return { pitch: n.pitch, accidental, marks: [] };
  }

  try {
    const events = sequence(false, false);
    const beams = beamProblem(events);
    if (beams) return { problem: beams };
    return { events };
  } catch (err) {
    if (err instanceof ParseError) return { problem: err.message };
    throw err;
  }
}

// Beams open and close in the same string, one at a time (§6: brackets close in the stretch where they open).
function beamProblem(events: Event[]): string | null {
  let open = false;
  for (const event of walk(events)) {
    if (!("marks" in event)) continue;
    for (const m of event.marks) {
      if (m.kind !== "beam") continue;
      if (m.open && open) return 'a beam opens with "[" while another is open';
      if (!m.open && !open) return 'a beam closes with "]" without its "["';
      open = m.open;
    }
  }
  return open ? 'a beam opened with "[" isn\'t closed in this stretch: split it here and raise a format issue' : null;
}

// Every event, groups' bodies included, in order.
export function* walk(events: Event[]): Generator<Event> {
  for (const event of events) {
    yield event;
    if (event.e === "tuplet" || event.e === "grace" || event.e === "tremolo") yield* walk(event.body);
  }
}
