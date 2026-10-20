import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSystem, pieceStart, type CheckedSystem, type LensStretch, type LensSystem, type ScoreState, type SystemContext } from "./lens.ts";

// A piano system of two staves in 4/4, one voice per staff, `n` measures of whole-measure rests.
function system(n: number, over: Partial<LensSystem> = {}, first = true): LensSystem {
  return {
    startRepeat: false,
    staves: [
      { staff: 1, description: first ? "piano right hand" : null, label: null, clef: "treble", key: "0", time: first ? "4/4" : null },
      { staff: 2, description: first ? "piano left hand" : null, label: null, clef: "bass", key: "0", time: first ? "4/4" : null },
    ],
    groups: [{ staves: [1, 2], symbol: "brace", label: null }],
    stretches: Array.from({ length: n }, (_, i) => stretch(i + 1, first && i === 0)),
    lastMeasureContinues: false,
    issues: [],
    ...over,
  };
}

function stretch(i: number, describe: boolean, over: Partial<LensStretch> = {}): LensStretch {
  return {
    stretch: i,
    class: "new",
    kind: "normal",
    printedNumber: null,
    measureNumber: null,
    changes: [],
    ending: null,
    voices: [
      { voice: 1, staff: 1, description: describe ? "melody" : null, music: "c''4 d''4 e''4 f''4" },
      { voice: 2, staff: 2, description: describe ? "bass" : null, music: "c2 g,2" },
    ],
    rightBarLine: "single",
    ...over,
  };
}

const context = (n: number, over: Partial<SystemContext> = {}): SystemContext => ({
  system: 1,
  stretches: n,
  firstOfPiece: true,
  images: ["system", ...Array.from({ length: n }, (_, i) => `stretch ${i + 1}`), "next system"],
  ...over,
});

function ok(json: unknown, ctx: SystemContext, before: ScoreState = pieceStart()): CheckedSystem {
  const result = checkSystem(json, ctx, before);
  if ("problem" in result) assert.fail(result.problem);
  return result;
}

function unusable(json: unknown, ctx: SystemContext, before: ScoreState = pieceStart()): string {
  const result = checkSystem(json, ctx, before);
  assert.ok("problem" in result, "the answer was accepted");
  return result.problem;
}

test("a clean system is accepted, with no issues or warnings, and its state carried", () => {
  const checked = ok(system(3), context(3));
  assert.deepEqual(checked.codeIssues, []);
  assert.deepEqual(checked.warnings, []);
  assert.deepEqual(checked.state.staves.map((s) => [s.staff, s.description]), [[1, "piano right hand"], [2, "piano left hand"]]);
  assert.deepEqual(checked.state.voices.map((v) => [v.voice, v.description]), [[1, "melody"], [2, "bass"]]);
  assert.equal(checked.state.count, 3);
  assert.deepEqual(checked.state.signatures.map((s) => [s.staff, s.clef, s.time]), [[1, "treble", "4/4"], [2, "bass", "4/4"]]);
});

test("exactly the stretches asked for", () => {
  assert.match(unusable(system(2), context(3)), /exactly the stretches 1 to 3/);
});

test("staves: unique, described when new, clef, key, time at a piece's start", () => {
  const twice = system(1);
  twice.staves[1].staff = 1;
  assert.match(unusable(twice, context(1)), /twice/);
  const undescribed = system(1);
  undescribed.staves[0].description = null;
  assert.match(unusable(undescribed, context(1)), /new and needs a description/);
  const clef = system(1);
  clef.staves[0].clef = "viola";
  assert.match(unusable(clef, context(1)), /isn't a clef/);
  const key = system(1);
  key.staves[0].key = "G major";
  assert.match(unusable(key, context(1)), /isn't a key signature/);
  const time = system(1);
  time.staves[0].time = null;
  assert.match(unusable(time, context(1)), /needs a time signature on every staff/);
});

test("the next system reuses staves and voices without descriptions, and carries the time", () => {
  const first = ok(system(2), context(2));
  const second = ok(system(2, {}, false), context(2, { system: 2, firstOfPiece: false }), first.state);
  assert.deepEqual(second.warnings, []);
  assert.deepEqual(second.codeIssues, []);
  assert.equal(second.state.count, 4);
  const described = system(2, {}, false);
  described.stretches[0].voices[0].description = "melody again";
  assert.match(unusable(described, context(2, { system: 2, firstOfPiece: false }), first.state), /already known/);
});

test("voices: parsed, once per stretch, a voice on every staff", () => {
  const bad = system(1);
  bad.stretches[0].voices[0].music = "c''4 fis''4";
  assert.match(unusable(bad, context(1)), /stretch 1, voice 1: the music doesn't parse: at 6/);
  const twice = system(1);
  twice.stretches[0].voices[1].voice = 1;
  assert.match(unusable(twice, context(1)), /voice 1 twice/);
  const missing = system(1);
  missing.stretches[0].voices.pop();
  assert.match(unusable(missing, context(1)), /staff 2 has no voice/);
  const change = system(1);
  change.stretches[0].voices[0].music = 'c\'\'2 \\change Staff = "3" c2';
  assert.match(unusable(change, context(1)), /names a staff that isn't on the system/);
});

test("durations that don't add up are warnings, not reasons to reject", () => {
  const short = system(2);
  short.stretches[1].voices[0].music = "c''4 d''4 e''4";
  short.stretches[1].voices[1].music = "c2.";
  const checked = ok(short, context(2));
  assert.equal(checked.warnings.length, 1);
  assert.match(checked.warnings[0].message, /durations don't add up: stretch 2 of system 1 lasts 3\/4/);
  const uneven = system(1);
  uneven.stretches[0].voices[1].music = "c1 c4";
  assert.match(ok(uneven, context(1)).warnings[0].message, /don't last the same: voice 1 1, voice 2 5\/4/);
});

test("a measure split across a bar line in its middle and across systems is checked joined", () => {
  const first = system(2, { lastMeasureContinues: true });
  first.stretches[1].voices[0].music = "c''4 d''4";
  first.stretches[1].voices[1].music = "c2";
  const a = ok(first, context(2));
  assert.deepEqual(a.warnings, []);
  assert.equal(a.state.measureContinues, true);
  const next = system(1, {}, false);
  next.stretches[0] = stretch(1, false, { class: "continues", kind: null });
  next.stretches[0].voices[0].music = "e''4 f''4";
  next.stretches[0].voices[1].music = "g,2";
  const b = ok(next, context(1, { system: 2, firstOfPiece: false }), a.state);
  assert.deepEqual(b.warnings, []);
  assert.deepEqual(b.codeIssues, []);
  assert.equal(b.state.count, 2);
});

test("an incomplete measure: a pickup shorter than the time", () => {
  const pickup = system(2);
  pickup.stretches[0] = stretch(1, true, { kind: "incomplete" });
  pickup.stretches[0].voices[0].music = "g'4";
  pickup.stretches[0].voices[1].music = "r4";
  assert.deepEqual(ok(pickup, context(2)).warnings, []);
  pickup.stretches[0].voices[0].music = "g'1";
  pickup.stretches[0].voices[1].music = "r1";
  assert.match(ok(pickup, context(2)).warnings[0].message, /incomplete measure, but lasts 1/);
});

test("both sides of a system break: a mismatch is an issue raised by code", () => {
  const a = ok(system(1, { lastMeasureContinues: true }), context(1));
  const b = ok(system(1, {}, false), context(1, { system: 2, firstOfPiece: false }), a.state);
  assert.equal(b.codeIssues.length, 1);
  assert.match(b.codeIssues[0].question, /Is the first stretch of system 2 a continuation of the measure that ends system 1\?/);
  assert.equal(b.codeIssues[0].applied, "b");
  assert.deepEqual(b.codeIssues[0].places, [{ system: 1, stretch: 1 }, { system: 2, stretch: 1 }]);
});

test("a printed number on a stretch that doesn't start a measure, and a stretch of no measure in the middle", () => {
  const s = system(3);
  s.stretches[1] = stretch(2, true, { class: "continues", kind: null, printedNumber: "5" });
  s.stretches[0] = stretch(1, true, { class: "none", kind: null });
  s.stretches[0].voices = [];
  const checked = ok(s, context(3));
  assert.deepEqual(checked.codeIssues.map((i) => i.question.slice(0, 30)), ["Stretch 1 is read as part of n", "Stretch 2 has a printed measur"]);
});

test("printed measure numbers: a warning only where the offset changes", () => {
  const s = system(4);
  s.stretches[0].printedNumber = "1";
  s.stretches[0].measureNumber = 1;
  s.stretches[3].printedNumber = "5";
  s.stretches[3].measureNumber = 5; // code counts 4 there: one measure missing
  const checked = ok(s, context(4));
  assert.equal(checked.warnings.length, 1);
  assert.match(checked.warnings[0].message, /measure 5 is printed where code counts measure 4/);
});

test("curves left open continue on the next system, and must end there", () => {
  const a = system(1);
  a.stretches[0].voices[0].music = "c''4 d''4 e''4 f''4\\=1(";
  const first = ok(a, context(1));
  assert.deepEqual(first.state.open, [{ kind: "curve", voice: 1, number: 1, from: 1 }]);
  const closed = system(1, {}, false);
  closed.stretches[0].voices[0].music = "g''1\\=1)";
  assert.deepEqual(ok(closed, context(1, { system: 2, firstOfPiece: false }), first.state).codeIssues, []);
  const unclosed = system(1, {}, false);
  const issues = ok(unclosed, context(1, { system: 2, firstOfPiece: false }), first.state).codeIssues;
  assert.match(issues[0].question, /curve 1 in voice 1 continues from the previous system, but doesn't end on this one/);
  const stray = system(1);
  stray.stretches[0].voices[0].music = "c''1\\=2)";
  assert.match(ok(stray, context(1)).codeIssues[0].question, /curve 2 in voice 1 ends, but no curve 2 is open/);
});

test("ottavas and pedal belong to the staff and may run on", () => {
  const a = system(1);
  a.stretches[0].voices[0].music = "\\ottava #1 c''4 d''4 e''4 f''4";
  a.stretches[0].voices[1].music = "c2\\sustainOn g,2";
  const first = ok(a, context(1));
  assert.deepEqual(first.state.open.map((m) => m.kind), ["ottava", "pedal"]);
  const b = ok(system(1, {}, false), context(1, { system: 2, firstOfPiece: false }), first.state);
  assert.deepEqual(b.codeIssues, []);
  assert.equal(b.state.open.length, 2);
});

test("multi-measure rests: every voice one, with the same count", () => {
  const s = system(1);
  s.stretches[0].voices[0].music = "R1*12";
  s.stretches[0].voices[1].music = "R1*12";
  const checked = ok(s, context(1));
  assert.equal(checked.state.count, 12);
  s.stretches[0].voices[1].music = "R1*11";
  assert.match(unusable(s, context(1)), /every voice must be one, with the same count/);
});

test("endings: contiguous and labelled, across systems too", () => {
  const s = system(2);
  s.stretches[0].ending = { startsHere: true, endsHere: false, label: "1." };
  s.stretches[1].ending = { startsHere: false, endsHere: true, label: null };
  ok(s, context(2));
  const gap = system(2);
  gap.stretches[0].ending = { startsHere: true, endsHere: false, label: "1." };
  assert.match(unusable(gap, context(2)), /must continue/);
  const unlabelled = system(1);
  unlabelled.stretches[0].ending = { startsHere: true, endsHere: true, label: null };
  assert.match(unusable(unlabelled, context(1)), /none of its stretches has its label/);
  const open = system(1);
  open.stretches[0].ending = { startsHere: true, endsHere: false, label: "2." };
  const first = ok(open, context(1));
  const next = system(1, {}, false);
  assert.match(unusable(next, context(1, { system: 2, firstOfPiece: false }), first.state), /must continue/);
  next.stretches[0].ending = { startsHere: false, endsHere: true, label: null };
  ok(next, context(1, { system: 2, firstOfPiece: false }), first.state);
});

test("issues: boxes on the images sent, answers by letter, format issues with tokens", () => {
  const issue = {
    boxes: [{ image: "stretch 1", box: { left: 0.1, right: 0.3, top: 0.2, bottom: 0.4 } }],
    location: null,
    question: "staccato or smudge?",
    answers: [
      { key: "a", text: "staccato" },
      { key: "b", text: "smudge" },
    ],
    applied: "a",
    class: "reading" as const,
    lilypond: null,
  };
  ok(system(1, { issues: [issue] }), context(1));
  assert.match(unusable(system(1, { issues: [{ ...issue, applied: "c" }] }), context(1)), /isn't one of its answers' keys/);
  assert.match(unusable(system(1, { issues: [{ ...issue, boxes: [{ ...issue.boxes[0], image: "page" }] }] }), context(1)), /isn't one of the images/);
  assert.match(unusable(system(1, { issues: [{ ...issue, class: "format" }] }), context(1)), /needs the LilyPond tokens/);
  ok(system(1, { issues: [{ ...issue, class: "format", lilypond: ["\\harmonic"] }] }), context(1));
});

test("a change in the order of the staves is a warning", () => {
  const first = ok(system(1), context(1));
  const swapped = system(1, {}, false);
  swapped.staves.reverse();
  swapped.groups = [];
  const checked = ok(swapped, context(1, { system: 2, firstOfPiece: false }), first.state);
  assert.match(checked.warnings[0].message, /another order/);
});

test("clef changes in the strings are carried to the next system", () => {
  const s = system(1);
  s.stretches[0].voices[1].music = "c2 \\clef treble g'2";
  assert.equal(ok(s, context(1)).state.signatures.find((x) => x.staff === 2)?.clef, "treble");
});
