// The lens (DESIGN.md §6, "The lens"): what `extract` answers for one system, as JSON with strings in the symbolic
// format, and the checks code runs on it as soon as it arrives. Code also carries what one system leaves to the next
// (the staves and voices so far, the signatures in effect, the marks left open, a measure that continues, an ending
// that runs on), and finds what is a question about the page (issues raised by code) or a problem of the extraction
// (warnings).

import { add, equal, less, show, ZERO, type Fraction } from "./fraction.ts";
import { eventsDuration, durationValue, measureLength, parseKey, parseTime, type TimeSignature } from "./durations.ts";
import { SpanTracker, type OpenMark } from "./spans.ts";
import { normalizeClef, parseVoice, walk, type Event } from "./symbolic.ts";

export const STRETCH_CLASSES = ["none", "new", "continues"] as const;
export const MEASURE_KINDS = ["normal", "incomplete", "unmeasured"] as const;
export const BAR_LINES = ["single", "double", "final", "startRepeat", "endRepeat", "bothRepeats", "dashed", "none"] as const;
export const GROUP_SYMBOLS = ["brace", "bracket", "bracketsq", "line"] as const;
export const ISSUE_CLASSES = ["reading", "format"] as const;

export type Box = { left: number; right: number; top: number; bottom: number };

export type LensStaff = { staff: number; description: string | null; label: string | null; clef: string; key: string; time: string | null };
export type LensGroup = { staves: number[]; symbol: (typeof GROUP_SYMBOLS)[number]; label: string | null };
export type LensVoice = { voice: number; staff: number; description: string | null; music: string };
export type LensChange = { staff: number; key: string | null; time: string | null };
export type LensEnding = { startsHere: boolean; endsHere: boolean; label: string | null };
export type LensStretch = {
  stretch: number;
  class: (typeof STRETCH_CLASSES)[number];
  kind: (typeof MEASURE_KINDS)[number] | null;
  printedNumber: string | null;
  measureNumber: number | null;
  changes: LensChange[];
  ending: LensEnding | null;
  voices: LensVoice[];
  rightBarLine: (typeof BAR_LINES)[number];
};
export type LensAnswer = { key: string; text: string };
// A model's issue: its boxes are on the images it was sent, named by their labels ("system", "stretch 3", …).
export type LensIssue = {
  boxes: { image: string; box: Box }[];
  location: string | null;
  question: string;
  answers: LensAnswer[];
  applied: string;
  class: (typeof ISSUE_CLASSES)[number];
  lilypond: string[] | null;
};
export type LensSystem = {
  startRepeat: boolean;
  staves: LensStaff[];
  groups: LensGroup[];
  stretches: LensStretch[];
  lastMeasureContinues: boolean;
  issues: LensIssue[];
};

// A place in the score: a stretch of a system (systems numbered in the whole score).
export type StretchPlace = { system: number; stretch: number };

// A question code asks about the page (§6, "Bar lines, stretches and measures", "Loose ends across systems").
export type CodeIssue = { question: string; answers: LensAnswer[]; applied: string | null; places: StretchPlace[] };
// A problem of the extraction itself (§6, "Warnings").
export type Warning = { message: string; places: StretchPlace[] };

// What code carries from one system to the next, within a piece: everything starts again at a piece's first system.
export type ScoreState = {
  staves: { staff: number; description: string; lastSeen: number }[]; // the piece's staves so far
  voices: { voice: number; description: string; lastSeen: number }[]; // the piece's voices so far
  // The signatures in effect at the end of the previous system, per staff; clefs as the strings last changed them.
  signatures: { staff: number; clef: string; key: string; time: string | null }[];
  staffOrder: number[]; // the previous system's staves, top to bottom
  open: OpenMark[];
  measureContinues: boolean; // the previous system said its last measure continues here
  measure: OpenMeasure | null; // that measure, so far
  ending: { labelled: boolean } | null; // an ending left open at the end of the previous system
  count: number; // measures counted in the piece so far
  offset: { value: number; at: StretchPlace } | null; // printed minus counted measure numbers, where last seen
  last: StretchPlace | null; // the previous system's last stretch
};

type OpenMeasure = { length: Fraction; kind: (typeof MEASURE_KINDS)[number] | null; time: string | null; places: StretchPlace[] };

export function pieceStart(): ScoreState {
  return { staves: [], voices: [], signatures: [], staffOrder: [], open: [], measureContinues: false, measure: null, ending: null, count: 0, offset: null, last: null };
}

export type SystemContext = {
  system: number; // its number in the whole score
  stretches: number; // how many stretches it has (its bar lines + 1)
  firstOfPiece: boolean;
  images: string[]; // the labels of the images sent, which issue boxes name
};

export type CheckedSystem = {
  answer: LensSystem;
  voices: Map<string, Event[]>; // parsed, by `${stretch}/${voice}`
  codeIssues: CodeIssue[];
  warnings: Warning[];
  state: ScoreState; // what the next system starts from
};

// Checks an answer against the system it is for and what came before it. A structural problem (§6, "Code checks
// the structure") makes the answer unusable: the reason comes back, the answer isn't stored. Everything else is
// stored, with the issues and warnings code found.
export function checkSystem(json: unknown, context: SystemContext, before: ScoreState): CheckedSystem | { problem: string } {
  try {
    return check(json, context, before);
  } catch (err) {
    if (err instanceof Unusable) return { problem: err.message };
    throw err;
  }
}

class Unusable extends Error {}
const fail = (message: string): never => {
  throw new Unusable(message);
};

function check(json: unknown, context: SystemContext, before: ScoreState): CheckedSystem {
  const answer = json as LensSystem;
  if (typeof answer !== "object" || answer === null || !Array.isArray(answer.stretches) || !Array.isArray(answer.staves)) {
    fail("the answer doesn't have the expected form");
  }
  const { system } = context;
  const here = (stretch: number): StretchPlace => ({ system, stretch });
  const codeIssues: CodeIssue[] = [];
  const warnings: Warning[] = [];

  // The stretches: exactly the ones asked for, in order.
  if (answer.stretches.length !== context.stretches || answer.stretches.some((s, i) => s.stretch !== i + 1)) {
    fail(`the answer must have exactly the stretches 1 to ${context.stretches}, in order, and has ${answer.stretches.map((s) => s.stretch).join(", ") || "none"}`);
  }

  // The staves: each number once, a new one with a description, a clef and a key each, a time on every staff at a
  // piece's start.
  if (answer.staves.length === 0) fail("the system has no staves");
  const known = new Map(before.staves.map((s) => [s.staff, s]));
  const onSystem = new Set<number>();
  for (const s of answer.staves) {
    if (!Number.isInteger(s.staff) || s.staff < 1) fail(`a staff's number must be a whole number from 1, not ${s.staff}`);
    if (onSystem.has(s.staff)) fail(`staff ${s.staff} is on the system twice`);
    onSystem.add(s.staff);
    if (!known.has(s.staff) && !s.description?.trim()) fail(`staff ${s.staff} is new and needs a description`);
    if (!normalizeClef(s.clef)) fail(`staff ${s.staff}: "${s.clef}" isn't a clef`);
    if (!parseKey(s.key)) fail(`staff ${s.staff}: "${s.key}" isn't a key signature (e.g. "0", "2s", "3f")`);
    if (s.time !== null && !parseTime(s.time)) fail(`staff ${s.staff}: "${s.time}" isn't a time signature (e.g. "3/4", "C", "C|")`);
    if (context.firstOfPiece && s.time === null) fail(`staff ${s.staff}: the first system of a piece needs a time signature on every staff`);
  }
  for (const g of answer.groups ?? []) {
    const missing = g.staves.find((n) => !onSystem.has(n));
    if (missing !== undefined) fail(`a group names staff ${missing}, which isn't on the system`);
  }

  // The stretches' fields.
  for (const s of answer.stretches) {
    if (s.class === "new" && s.kind === null) fail(`stretch ${s.stretch} starts a measure and needs its kind`);
    if (s.class !== "new" && s.kind !== null) fail(`stretch ${s.stretch} doesn't start a measure, so it has no kind (null)`);
    if (s.measureNumber !== null && !Number.isInteger(s.measureNumber)) fail(`stretch ${s.stretch}: the measure number must be a whole number`);
    for (const c of s.changes) {
      if (!onSystem.has(c.staff)) fail(`stretch ${s.stretch}: a change names staff ${c.staff}, which isn't on the system`);
      if (c.key === null && c.time === null) fail(`stretch ${s.stretch}: a change on staff ${c.staff} changes nothing`);
      if (c.key !== null && !parseKey(c.key)) fail(`stretch ${s.stretch}: "${c.key}" isn't a key signature`);
      if (c.time !== null && !parseTime(c.time)) fail(`stretch ${s.stretch}: "${c.time}" isn't a time signature`);
    }
  }

  // The voices: each parsed, each id once per stretch, a reused one without a description, a new one with one where
  // it first appears, every staff with a voice in every stretch that is part of a measure.
  const knownVoices = new Map(before.voices.map((v) => [v.voice, v]));
  const newVoices = new Map<number, string>();
  const voices = new Map<string, Event[]>();
  for (const s of answer.stretches) {
    const ids = new Set<number>();
    for (const v of s.voices) {
      if (!Number.isInteger(v.voice) || v.voice < 1) fail(`stretch ${s.stretch}: a voice's id must be a whole number from 1, not ${v.voice}`);
      if (ids.has(v.voice)) fail(`stretch ${s.stretch} has voice ${v.voice} twice`);
      ids.add(v.voice);
      if (!onSystem.has(v.staff)) fail(`stretch ${s.stretch}: voice ${v.voice} starts on staff ${v.staff}, which isn't on the system`);
      if (knownVoices.has(v.voice)) {
        if (v.description !== null) fail(`voice ${v.voice} is already known: its description must be null`);
      } else if (!newVoices.has(v.voice)) {
        if (!v.description?.trim()) fail(`voice ${v.voice} is new and needs a description where it first appears`);
        newVoices.set(v.voice, v.description!);
      }
      const parsed = parseVoice(v.music);
      if ("problem" in parsed) fail(`stretch ${s.stretch}, voice ${v.voice}: the music doesn't parse: ${parsed.problem}`);
      const events = (parsed as { events: Event[] }).events;
      for (const e of walk(events)) {
        if (e.e === "changeStaff" && !onSystem.has(e.staff)) fail(`stretch ${s.stretch}, voice ${v.voice}: \\change Staff = "${e.staff}" names a staff that isn't on the system`);
      }
      voices.set(`${s.stretch}/${v.voice}`, events);
    }
    if (s.class !== "none") {
      for (const staff of onSystem) {
        if (!s.voices.some((v) => v.staff === staff)) fail(`stretch ${s.stretch}: staff ${staff} has no voice (write "s" or "R" where it has no notes)`);
      }
    }
  }

  // Multi-measure rests: every voice of the stretch is one, with the same count, and the next stretch doesn't
  // continue the stretch's measures.
  for (const s of answer.stretches) {
    const rests = s.voices.map((v) => voices.get(`${s.stretch}/${v.voice}`)!.filter((e) => e.e !== "clef" && e.e !== "ottava" && e.e !== "stem"));
    const counts = rests.map((events) => (events.length === 1 && events[0].e === "measureRest" ? events[0].count : null));
    const multi = counts.some((c) => c !== null && c > 1);
    if (!multi) continue;
    if (counts.some((c) => c !== counts[0])) fail(`stretch ${s.stretch}: with a multi-measure rest, every voice must be one, with the same count`);
    if (s.class !== "new") fail(`stretch ${s.stretch}: a multi-measure rest starts new measures`);
    const next = answer.stretches[s.stretch];
    if ((next && next.class === "continues") || (!next && answer.lastMeasureContinues)) fail(`stretch ${s.stretch}: a multi-measure rest's last measure can't continue`);
  }

  // Endings: each contiguous, labelled somewhere, an ending left open by the previous system continued on the first
  // stretch.
  let ending = before.ending;
  for (const s of answer.stretches) {
    const e = s.ending;
    if (ending && !e) fail(`stretch ${s.stretch}: the ending from the stretch before it must continue (it didn't end there)`);
    if (e) {
      if (!e.startsHere && !ending) fail(`stretch ${s.stretch}: its ending doesn't start here, but no ending runs on from the stretch before`);
      if (e.startsHere && ending) fail(`stretch ${s.stretch}: an ending starts here while the one before hasn't ended`);
      const labelled = (ending?.labelled ?? false) || (e.label !== null && e.label.trim() !== "");
      if (e.endsHere) {
        if (!labelled) fail(`stretch ${s.stretch}: an ending ends here, but none of its stretches has its label`);
        ending = null;
      } else {
        ending = { labelled };
      }
    }
  }

  // Issues: boxes on the images sent, answers with unique letters, `applied` one of them, a format issue with its
  // tokens.
  for (const [n, issue] of (answer.issues ?? []).entries()) {
    const what = `issue ${n + 1}`;
    if (issue.boxes.length === 0) fail(`${what} has no boxes`);
    for (const b of issue.boxes) {
      if (!context.images.includes(b.image)) fail(`${what}: a box is on "${b.image}", which isn't one of the images (${context.images.join(", ")})`);
      const { left, right, top, bottom } = b.box;
      if (![left, right, top, bottom].every((v) => typeof v === "number" && v >= 0 && v <= 1) || left >= right || top >= bottom) {
        fail(`${what}: a box isn't within its image (fractions from 0 to 1, left < right, top < bottom)`);
      }
    }
    if (issue.answers.length === 0) fail(`${what} has no answers`);
    const keys = issue.answers.map((a) => a.key);
    if (keys.some((k) => !/^[a-z]$/.test(k))) fail(`${what}: answers' keys are single letters, a, b, c, …`);
    if (new Set(keys).size !== keys.length) fail(`${what}: two answers have the same key`);
    if (!keys.includes(issue.applied)) fail(`${what}: "applied" is "${issue.applied}", which isn't one of its answers' keys`);
    if (issue.class === "format" && (!issue.lilypond || issue.lilypond.length === 0)) fail(`${what} is a format issue and needs the LilyPond tokens that would express it`);
    if (issue.class !== "format" && issue.lilypond !== null) fail(`${what} isn't a format issue, so its "lilypond" is null`);
  }

  // --- Usable. Now the questions about the page, and the problems of the extraction. ---

  const first = answer.stretches[0];
  if (context.firstOfPiece && first.class === "continues") {
    codeIssues.push({
      question: `The first stretch of a piece is read as continuing a measure. What part of a measure is it?`,
      answers: stretchAnswers(),
      applied: "b",
      places: [here(1)],
    });
  } else if (!context.firstOfPiece && before.measureContinues !== (first.class === "continues")) {
    codeIssues.push({
      question: `Is the first stretch of system ${system} a continuation of the measure that ends system ${system - 1}?`,
      answers: [
        { key: "a", text: "yes" },
        { key: "b", text: "no" },
      ],
      applied: first.class === "continues" ? "a" : "b",
      places: [...(before.last ? [before.last] : []), here(1)],
    });
  }
  for (const [i, s] of answer.stretches.entries()) {
    const later = answer.stretches.slice(i + 1);
    if (s.class === "none" && later.some((t) => t.class !== "none")) {
      codeIssues.push({ question: `Stretch ${s.stretch} is read as part of no measure, but stretches after it are. What part of a measure is it?`, answers: stretchAnswers(), applied: "c", places: [here(s.stretch)] });
    }
    if (s.printedNumber !== null && s.class !== "new") {
      codeIssues.push({
        question: `Stretch ${s.stretch} has a printed measure number ("${s.printedNumber}") but isn't read as the start of a measure. What part of a measure is it?`,
        answers: [
          { key: "a", text: "the start of a measure, because there is a printed measure number next to it" },
          { key: "b", text: "the continuation of a measure" },
          { key: "c", text: "not part of a measure" },
        ],
        applied: s.class === "continues" ? "b" : "c",
        places: [here(s.stretch)],
      });
    }
  }

  // The marks with two ends, voice by voice through the stretches.
  const spans = new SpanTracker(system, before.open);
  for (const s of answer.stretches) {
    for (const v of s.voices) spans.voice(s.stretch, v.voice, v.staff, voices.get(`${s.stretch}/${v.voice}`)!);
  }
  for (const p of spans.finish()) {
    codeIssues.push({ question: `Where does this end? Code found that ${p.message}.`, answers: [], applied: null, places: p.places });
  }

  // Durations and measures.
  const signatures = new Map<number, { clef: string; key: string; time: string | null }>();
  for (const s of answer.staves) {
    const carried = before.signatures.find((x) => x.staff === s.staff)?.time ?? null;
    signatures.set(s.staff, { clef: normalizeClef(s.clef)!, key: s.key, time: s.time ?? carried });
  }
  const topStaff = answer.staves[0].staff;
  let measure: OpenMeasure | null = before.measure;
  let count = before.count;
  let offset = before.offset;
  const closeMeasure = () => {
    if (!measure) return;
    const time = measure.time ? parseTime(measure.time) : null;
    measureWarning(measure, time, warnings);
    measure = null;
  };
  for (const s of answer.stretches) {
    for (const c of s.changes) {
      const sig = signatures.get(c.staff)!;
      signatures.set(c.staff, { ...sig, key: c.key ?? sig.key, time: c.time ?? sig.time });
    }
    // Every voice of a stretch spans the same time.
    const lengths = s.voices.map((v) => ({ voice: v.voice, length: eventsDuration(voices.get(`${s.stretch}/${v.voice}`)!) }));
    let length = lengths.reduce((max, l) => (less(max, l.length) ? l.length : max), ZERO);
    if (lengths.some((l) => !equal(l.length, length))) {
      warnings.push({
        message: `The voices of stretch ${s.stretch} don't last the same: ${lengths.map((l) => `voice ${l.voice} ${show(l.length)}`).join(", ")} (in whole notes).`,
        places: [here(s.stretch)],
      });
    }
    if (s.class === "none") {
      if (!equal(length, ZERO)) warnings.push({ message: `Stretch ${s.stretch} is part of no measure, but has notes or rests (${show(length)} of a whole note).`, places: [here(s.stretch)] });
      continue;
    }
    const time = signatures.get(topStaff)!.time;
    const multi = s.voices.map((v) => voices.get(`${s.stretch}/${v.voice}`)!).flatMap((events) => events.filter((e) => e.e === "measureRest"))[0];
    if (s.class === "new") {
      closeMeasure();
      // The printed measure number, against code's count: a warning only where the offset changes.
      const counted = count + 1;
      if (s.measureNumber !== null) {
        const value = s.measureNumber - counted;
        if (offset && offset.value !== value) {
          warnings.push({
            message: `The printed measure numbers don't match the count: measure ${s.measureNumber} is printed where code counts measure ${counted + offset.value} (a measure may be missing, extra or wrongly classified since the last printed number).`,
            places: [offset.at, here(s.stretch)],
          });
        }
        offset = { value, at: here(s.stretch) };
      }
      if (multi && multi.e === "measureRest" && multi.count > 1) {
        count += multi.count;
        const parsedTime = time ? parseTime(time) : null;
        if (parsedTime && !equal(durationValue(multi.duration), measureLength(parsedTime))) {
          warnings.push({ message: `Stretch ${s.stretch}: the multi-measure rest's measures don't last a measure of ${time}.`, places: [here(s.stretch)] });
        }
        length = ZERO;
        continue;
      }
      count += 1;
      measure = { length, kind: s.kind, time, places: [here(s.stretch)] };
    } else if (measure) {
      measure.length = add(measure.length, length);
      measure.places.push(here(s.stretch));
    } else {
      // Continues a measure that was never started (a mismatch, raised above): counted as a measure of unknown kind.
      count += 1;
      measure = { length, kind: null, time, places: [here(s.stretch)] };
    }
  }
  if (!answer.lastMeasureContinues) closeMeasure();

  // The clefs in effect at the end: the last \clef on each staff, wherever a voice writes it.
  for (const s of answer.stretches) {
    for (const v of s.voices) {
      let staff = v.staff;
      for (const e of walk(voices.get(`${s.stretch}/${v.voice}`)!)) {
        if (e.e === "changeStaff") staff = e.staff;
        if (e.e === "clef" && signatures.has(staff)) signatures.set(staff, { ...signatures.get(staff)!, clef: e.clef });
      }
    }
  }

  // A change in the order of the staves is rare: a warning.
  const order = answer.staves.map((s) => s.staff);
  const common = order.filter((n) => before.staffOrder.includes(n));
  const previous = before.staffOrder.filter((n) => order.includes(n));
  if (common.join() !== previous.join()) {
    warnings.push({ message: `The staves are in another order than on the previous system: ${order.join(", ")} after ${before.staffOrder.join(", ")}.`, places: [here(1)] });
  }

  const staves = [...before.staves];
  for (const s of answer.staves) {
    const at = staves.findIndex((x) => x.staff === s.staff);
    if (at >= 0) staves[at] = { ...staves[at], lastSeen: system };
    else staves.push({ staff: s.staff, description: s.description!.trim(), lastSeen: system });
  }
  const voiceList = [...before.voices];
  for (const s of answer.stretches) {
    for (const v of s.voices) {
      const at = voiceList.findIndex((x) => x.voice === v.voice);
      if (at >= 0) voiceList[at] = { ...voiceList[at], lastSeen: system };
      else voiceList.push({ voice: v.voice, description: newVoices.get(v.voice)!.trim(), lastSeen: system });
    }
  }

  return {
    answer,
    voices,
    codeIssues,
    warnings,
    state: {
      staves,
      voices: voiceList,
      signatures: [
        ...before.signatures.filter((x) => !signatures.has(x.staff)),
        ...[...signatures.entries()].map(([staff, sig]) => ({ staff, ...sig })),
      ].sort((a, b) => a.staff - b.staff),
      staffOrder: order,
      open: spans.open,
      measureContinues: answer.lastMeasureContinues,
      measure: answer.lastMeasureContinues ? measure : null,
      ending,
      count,
      offset,
      last: here(context.stretches),
    },
  };
}

function stretchAnswers(): LensAnswer[] {
  return [
    { key: "a", text: "the start of a measure" },
    { key: "b", text: "the continuation of a measure" },
    { key: "c", text: "not part of a measure" },
  ];
}

// A measure's length against its kind and time: a normal one fills the time, an incomplete one is shorter.
function measureWarning(measure: OpenMeasure, time: TimeSignature | null, warnings: Warning[]) {
  if (!time || measure.kind === "unmeasured" || measure.kind === null) return;
  const full = measureLength(time);
  const where = measure.places.length === 1 ? `stretch ${measure.places[0].stretch} of system ${measure.places[0].system}` : `the measure from stretch ${measure.places[0].stretch} of system ${measure.places[0].system}`;
  if (measure.kind === "normal" && !equal(measure.length, full)) {
    warnings.push({ message: `The durations don't add up: ${where} lasts ${show(measure.length)} of a whole note, a measure of ${measure.time} ${show(full)}.`, places: measure.places });
  }
  if (measure.kind === "incomplete" && !less(measure.length, full)) {
    warnings.push({ message: `${where} is read as an incomplete measure, but lasts ${show(measure.length)} of a whole note, a full measure of ${measure.time} or more.`, places: measure.places });
  }
}
