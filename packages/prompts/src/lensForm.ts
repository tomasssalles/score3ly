// The lens as the models read and write it (docs/notation.md, "The lens as the models see it"): no nullable field, for
// Anthropic's limit on schemas (docs/llm.md, "Claude's limit on schemas"). A text with no value is "", a number -1; a
// stretch's class and its measure's kind are one value ("new-normal", …, "continues", "none"); its ending is one value
// ("none", "start", "middle", "end", "whole") and its label another (`endingLabel`). Code keeps the lens as
// @score3ly/notation has it (nulls, `class` and `kind`, `ending` an object or null): `*FromModel` turn what a model
// wrote into it, before any check, and `*ForModel` turn the lens into what a model reads, so that every model sees one
// form, the one it writes.
//
// The functions from the model's form leave whatever isn't of the expected form as it is, for the checks.

import { BAR_LINES, GROUP_SYMBOLS, ISSUE_CLASSES, MEASURE_KINDS } from "@score3ly/notation/lens";
import { bool, described, enumOf, int, list, num, object, str } from "./schema.ts";

// A stretch's class and its measure's kind in one value, in this order (the schema's: part of every request).
export const STRETCH_CLASS_VALUES = [...MEASURE_KINDS.map((kind) => `new-${kind}` as const), "continues", "none"] as const;

type Obj = Record<string, unknown>;
const record = (o: unknown): o is Obj => typeof o === "object" && o !== null && !Array.isArray(o);
const each = (list: unknown, f: (o: unknown) => unknown) => (Array.isArray(list) ? list.map(f) : list);

// The keys whose "" becomes null.
export function orNull(o: unknown, keys: string[]): unknown {
  if (!record(o)) return o;
  const copy = { ...o };
  for (const k of keys) if (copy[k] === "") copy[k] = null;
  return copy;
}
// The keys whose null becomes "".
function orEmpty(o: Obj, keys: string[]): Obj {
  const copy = { ...o };
  for (const k of keys) if (k in copy && copy[k] === null) copy[k] = "";
  return copy;
}

// A stretch's ending as one value, and what it means; the values in this order (the schema's).
const ENDINGS = {
  none: null,
  start: { startsHere: true, endsHere: false },
  middle: { startsHere: false, endsHere: false },
  end: { startsHere: false, endsHere: true },
  whole: { startsHere: true, endsHere: true },
} as const;
export const ENDING_VALUES = Object.keys(ENDINGS) as (keyof typeof ENDINGS)[];
const endingOf = (value: string) => (value in ENDINGS ? ENDINGS[value as keyof typeof ENDINGS] : value);
const endingValue = (e: { startsHere: boolean; endsHere: boolean } | null) =>
  ENDING_VALUES.find((v) => (ENDINGS[v] === null ? e === null : e !== null && ENDINGS[v].startsHere === e.startsHere && ENDINGS[v].endsHere === e.endsHere))!;

// --- The schema ---

const FOUR_EDGES = object({ left: num, right: num, top: num, bottom: num });

// The parts of the lens's schema that `review` and `apply_review` share with `extract`, with their descriptions.
export const LENS_SCHEMA_PARTS = {
  startRepeat: described(bool, "Whether the system begins with a start-repeat bar line (not the line that joins the staves at the left edge)."),
  staff: described(
    object({
      staff: described(int, "Its number in the piece: from the list where the staff continues (also after systems without it), a new number for a new staff."),
      description: described(str, 'For a staff new in the piece: a short description ("piano right hand", "violin I"), never "". "" for a staff from the list.'),
      label: described(str, 'The instrument name printed at its left, as printed, or "".'),
      clef: described(str, "The clef printed at the system's start, by LilyPond's name."),
      key: described(str, 'The key signature printed at the system\'s start: "0", "1s" … "7s", "1f" … "7f".'),
      time: described(str, 'The time signature printed at the system\'s start, as printed ("3/4", "C"), or "" when none is printed there.'),
    }),
    "A staff of the system, with its clef, key and time as printed at the system's start.",
  ),
  group: described(
    object({
      staves: described(list(int), "The numbers of the staves it joins."),
      symbol: described(enumOf(GROUP_SYMBOLS), "The symbol, as printed."),
      label: described(str, 'Its label as printed ("Piano I"), or "".'),
    }),
    "A brace or bracket that joins staves, as printed.",
  ),
  class: described(
    enumOf(STRETCH_CLASS_VALUES),
    'Whether the stretch starts a measure, and of which kind ("new-…"), is part of the same measure as the stretch before it ("continues", even on the previous system), or of none ("none").',
  ),
  printedNumber: described(str, 'A measure number printed at the stretch, as printed ("12"), else "".'),
  measureNumber: described(int, "The number it gives the measure (12), or -1."),
  changes: described(
    list(
      object({
        staff: described(int, "The staff's number."),
        key: described(str, 'The new key signature ("2f"), or "" where it doesn\'t change.'),
        time: described(str, 'The new time signature ("3/4"), or "" where it doesn\'t change.'),
      }),
    ),
    "Key and time signatures printed at the stretch's start, per staff; an empty list where there are none. Never clef changes: those are \\clef in the music.",
  ),
  ending: described(enumOf(ENDING_VALUES), 'The "1." / "2." bracket over the stretch: where it starts and ends, or "none".'),
  endingLabel: described(str, 'The ending\'s label as printed where it is visible over this stretch ("1."), else "".'),
  voice: described(int, "The voice's id in the piece: from the list where it continues, a new number otherwise."),
  voiceStaff: described(int, "The staff the voice starts on in the stretch."),
  voiceDescription: described(
    str,
    'For a voice new in the piece, where it first appears: a short description ("melody", "inner alto line", "left-hand bass"), never "". "" for a voice from the list.',
  ),
  music: described(str, 'The voice\'s music in the stretch: one string, as in "The music of a voice".'),
  rightBarLine: described(enumOf(BAR_LINES), 'The bar line at the stretch\'s right; "none" for the last stretch when the system ends without one.'),
  lastMeasureContinues: described(bool, "Whether the system's last measure continues on the next system."),
  issueBoxes: described(
    list(
      object({
        image: described(str, 'The label of the image it is on: "system", "stretch 3", "previous system", "next system".'),
        box: described(FOUR_EDGES, "As fractions of that image, from 0 to 1."),
      }),
    ),
    "Where it is: one or more boxes, each on one of the images you were sent.",
  ),
  location: described(str, 'What in the box is meant, when the box alone doesn\'t say, simple and local to the box ("the middle note of the chord"); else "".'),
  question: described(str, "What the page says at this place, as a plain sentence a musician understands. Never refers to the transcription."),
  answerKey: described(str, '"a", "b", "c", …'),
  answerText: described(str, "The answer, about what the page might show; never refers to the transcription."),
  issueClass: described(enumOf(ISSUE_CLASSES), '"reading": what the page says is hard to tell; "format": the page is clear, but the format can\'t express it.'),
  lilypond: described(
    list(str),
    "For a format issue, the LilyPond tokens that would express what is printed (empty when no new token would); for a reading issue always empty.",
  ),
};

// --- From the model's form to the lens ---

export const staffFromModel = (s: unknown) => orNull(s, ["description", "label", "time"]);
export const groupFromModel = (g: unknown) => orNull(g, ["label"]);
export const voiceFromModel = (v: unknown) => orNull(v, ["description"]);

// A stretch's fields (all but `voices`, which are converted where there are any): class and kind, the printed and
// the measure number, the changes, the ending.
export function stretchFromModel(u: unknown): unknown {
  if (!record(u)) return u;
  const { endingLabel, ...s } = orNull(u, ["printedNumber"]) as Obj;
  const merged = typeof s.class === "string" && s.class.startsWith("new-");
  const ending = typeof s.ending === "string" ? endingOf(s.ending) : s.ending;
  return {
    ...s,
    class: merged ? "new" : s.class,
    kind: merged ? (s.class as string).slice("new-".length) : null,
    measureNumber: s.measureNumber === -1 ? null : s.measureNumber,
    changes: each(s.changes, (c) => orNull(c, ["key", "time"])),
    ending: record(ending) ? { ...ending, label: endingLabel === "" || endingLabel === undefined ? null : endingLabel } : ending,
    ...("voices" in s ? { voices: each(s.voices, voiceFromModel) } : {}),
  };
}

// An issue a model raised: its location, and a reading issue's empty list of tokens null.
export function issueFromModel(i: unknown): unknown {
  const issue = orNull(i, ["location"]);
  if (!record(issue)) return issue;
  return issue.class !== "format" && Array.isArray(issue.lilypond) && issue.lilypond.length === 0 ? { ...issue, lilypond: null } : issue;
}

// `extract`'s answer, as the lens (LensSystem).
export function lensFromExtract(json: unknown): unknown {
  if (!record(json)) return json;
  return {
    ...json,
    staves: each(json.staves, staffFromModel),
    groups: each(json.groups, groupFromModel),
    stretches: each(json.stretches, stretchFromModel),
    issues: each(json.issues, issueFromModel),
  };
}

// --- From the lens to the model's form ---

export const staffForModel = (s: Obj) => orEmpty(s, ["description", "label", "time"]);
export const groupForModel = (g: Obj) => orEmpty(g, ["label"]);
export const voiceForModel = (v: Obj) => orEmpty(v, ["description"]);

// A stretch (or its fields, as a patch has them), the other keys as they are (`measure`, `reason`, …), in the order of
// the model's form.
export function stretchForModel(s: Obj): Obj {
  const { class: c, kind, printedNumber, measureNumber, changes, ending, voices, ...rest } = s;
  const e = ending as { startsHere: boolean; endsHere: boolean; label: string | null } | null;
  const { stretch, system, rightBarLine, ...others } = rest;
  return {
    ...(system !== undefined ? { system } : {}),
    stretch,
    class: c === "new" ? `new-${kind}` : c,
    printedNumber: printedNumber ?? "",
    measureNumber: measureNumber ?? -1,
    changes: (changes as Obj[]).map((x) => orEmpty(x, ["key", "time"])),
    ending: endingValue(e),
    endingLabel: e?.label ?? "",
    ...(voices !== undefined ? { voices: (voices as Obj[]).map(voiceForModel) } : {}),
    rightBarLine,
    ...others,
  };
}
