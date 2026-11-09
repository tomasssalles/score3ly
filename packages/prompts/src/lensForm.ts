// The lens as the models read and write it (docs/notation.md, "The lens as the models see it"): no nullable field, for
// Anthropic's limit on schemas (docs/llm.md, "Claude's limit on schemas"). A text with no value is "", a number -1; a
// stretch's class and its measure's kind are one value ("new-normal", …, "continues", "none"); its ending is one value
// ("none", "start", "middle", "end", "whole") and its label another (`endingLabel`). Code keeps the lens as
// @score3ly/notation has it (nulls, `class` and `kind`, `ending` an object or null): `*FromModel` turn what a model
// wrote into it, before any check, and `*ForModel` turn the lens into what a model reads, so that every model sees one
// form, the one it writes.
//
// The functions from the model's form leave whatever isn't of the expected form as it is, for the checks.

export const STRETCH_CLASS_VALUES = ["new-normal", "new-incomplete", "new-unmeasured", "continues", "none"] as const;
export const ENDING_VALUES = ["none", "start", "middle", "end", "whole"] as const;
export const RIGHT_BAR_LINES = ["single", "double", "final", "startRepeat", "endRepeat", "bothRepeats", "dashed", "none"] as const;
export const GROUP_SYMBOL_VALUES = ["brace", "bracket", "bracketsq", "line"] as const;

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

const ENDINGS: Record<string, { startsHere: boolean; endsHere: boolean } | null> = {
  none: null,
  start: { startsHere: true, endsHere: false },
  middle: { startsHere: false, endsHere: false },
  end: { startsHere: false, endsHere: true },
  whole: { startsHere: true, endsHere: true },
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
  const ending = typeof s.ending === "string" && s.ending in ENDINGS ? ENDINGS[s.ending] : s.ending;
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
  const endingValue = !e ? "none" : e.startsHere ? (e.endsHere ? "whole" : "start") : e.endsHere ? "end" : "middle";
  const { stretch, system, rightBarLine, ...others } = rest;
  return {
    ...(system !== undefined ? { system } : {}),
    stretch,
    class: c === "new" ? `new-${kind}` : c,
    printedNumber: printedNumber ?? "",
    measureNumber: measureNumber ?? -1,
    changes: (changes as Obj[]).map((x) => orEmpty(x, ["key", "time"])),
    ending: endingValue,
    endingLabel: e?.label ?? "",
    ...(voices !== undefined ? { voices: (voices as Obj[]).map(voiceForModel) } : {}),
    rightBarLine,
    ...others,
  };
}
