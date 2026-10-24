import { test } from "node:test";
import assert from "node:assert/strict";
import { eventsDuration } from "./durations.ts";
import { show } from "./fraction.ts";
import { parseVoice, type Event } from "./symbolic.ts";

function events(text: string): Event[] {
  const parsed = parseVoice(text);
  if ("problem" in parsed) assert.fail(`"${text}" didn't parse: ${parsed.problem}`);
  return parsed.events;
}

function problem(text: string): string {
  const parsed = parseVoice(text);
  assert.ok("problem" in parsed, `"${text}" parsed, but shouldn't`);
  return parsed.problem;
}

const length = (text: string) => show(eventsDuration(events(text)));

test("notes, with absolute octaves, durations and dots", () => {
  const [a, b, c] = events("c'4 g,,8. b''16");
  assert.deepEqual(a, { e: "note", head: { pitch: { letter: "c", octave: 4 }, accidental: null, marks: [] }, duration: { base: 4, dots: 0 }, tremolo: null, marks: [] });
  assert.equal(b.e === "note" && b.head.pitch.octave, 1);
  assert.deepEqual(b.e === "note" && b.duration, { base: 8, dots: 1 });
  assert.equal(c.e === "note" && c.head.pitch.octave, 5);
});

test("whitespace follows LilyPond's rules: optional around marks", () => {
  assert.deepEqual(events("c'4-.\\=1("), events("c'4 -. \\=1("));
  assert.deepEqual(events("<c' e'>4"), events("< c' e' >4"));
});

test("accidentals are tokens right before their note, also in a chord", () => {
  const [n] = events("\\flat a'2");
  assert.equal(n.e === "note" && n.head.accidental, "flat");
  const [chord] = events("<c' \\sharp f' a'>4");
  assert.deepEqual(chord.e === "chord" && chord.heads.map((h) => h.accidental), [null, "sharp", null]);
  assert.match(problem("\\flat r4"), /right before its note/);
  assert.match(problem("\\flat"), /right before its note/);
});

test("LilyPond's pitch names with accidentals are rejected", () => {
  assert.match(problem("fis'4"), /"fis" isn't part of the format/);
  assert.match(problem("bes4"), /isn't part of the format/);
});

test("every note and rest has its own duration; a chord's comes after >", () => {
  assert.match(problem("c'4 d'"), /has no duration/);
  assert.match(problem("r"), /has no duration/);
  assert.match(problem("<c' e'>"), /no duration/);
  assert.match(problem("<c'4 e'>4"), /no duration of its own/);
});

test("rests: printed, invisible, whole-measure and multi-measure", () => {
  const [r, s, R, many] = events("r4 s8 R1 R2.*12");
  assert.equal(r.e === "rest" && r.visible, true);
  assert.equal(s.e === "rest" && s.visible, false);
  assert.equal(R.e === "measureRest" && R.count, 1);
  assert.deepEqual(many.e === "measureRest" && [many.count, many.duration], [12, { base: 2, dots: 1 }]);
});

test("marks after notes, with placement prefixes, and fingering", () => {
  const [n] = events("c'4-.^>_\\p-3^\"dolce\"");
  assert.deepEqual(n.e === "note" && n.marks, [
    { kind: "articulation", name: "staccato", placement: "-" },
    { kind: "articulation", name: "accent", placement: "^" },
    { kind: "command", name: "p", placement: "_" },
    { kind: "fingering", finger: 3, placement: "-" },
    { kind: "text", text: "dolce", placement: "^" },
  ]);
  const [m] = events("c'4--\\fermata\\sfz");
  assert.deepEqual(m.e === "note" && m.marks.map((x) => (x.kind === "command" ? x.name : x.kind === "articulation" ? x.name : "")), ["tenuto", "fermata", "sfz"]);
});

test("> after a note is an accent or a hairpin, never the end of a chord", () => {
  const [n] = events("c'4->\\>");
  assert.deepEqual(n.e === "note" && n.marks.map((m) => (m.kind === "command" || m.kind === "articulation" ? m.name : "")), ["accent", ">"]);
  assert.match(problem("c'4 >"), /without its "<"/);
});

test("quoted text runs to its closing quote, with \\\" inside", () => {
  const [n] = events('c\'4^"poco \\"rit.\\" a poco"');
  assert.deepEqual(n.e === "note" && n.marks[0], { kind: "text", text: 'poco "rit." a poco', placement: "^" });
  assert.match(problem('c\'4^"open'), /isn't closed/);
  assert.match(problem('c\'4 "dolce"'), /needs a placement prefix/);
});

test("jump instructions from the fixed list are navigation", () => {
  const [n] = events('c\'4^"D.C. al Fine"');
  assert.equal(n.e === "note" && n.marks[0].kind, "jump");
  const [m] = events('c\'4^"D.C. al Segno"');
  assert.equal(m.e === "note" && m.marks[0].kind, "text");
});

test("curves are numbered, on notes and on single notes of a chord", () => {
  const [a, chord] = events("e''4\\=1( <c'\\=1) e'\\=2(>4");
  assert.deepEqual(a.e === "note" && a.marks, [{ kind: "curve", number: 1, open: true, placement: null }]);
  assert.deepEqual(chord.e === "chord" && chord.heads.map((h) => h.marks), [[{ kind: "curve", number: 1, open: false, placement: null }], [{ kind: "curve", number: 2, open: true, placement: null }]]);
  assert.match(problem("r4\\=1("), /can't be on a rest/);
  assert.match(problem("c4~ c4"), /"~" isn't part of the format/);
  assert.match(problem("c4( d4)"), /isn't part of the format/);
});

test("marks need something to belong to", () => {
  assert.match(problem("-. c4"), /isn't after a note/);
  assert.match(problem("\\clef bass -."), /isn't after a note/);
});

test("commands before notes: clefs, ottavas, staff changes, stems", () => {
  const evs = events('\\clef bass \\clef "treble_8" \\clef G \\ottava #-1 \\change Staff = "3" \\stemUp c4');
  assert.deepEqual(
    evs.slice(0, 6).map((e) => (e.e === "clef" ? e.clef : e.e === "ottava" ? e.value : e.e === "changeStaff" ? e.staff : e.e === "stem" ? e.direction : e.e)),
    ["bass", "treble_8", "treble", -1, 3, "up"],
  );
  assert.match(problem("\\clef viola"), /isn't a clef/);
  assert.match(problem("\\ottava #3"), /only -2 to 2/);
  assert.match(problem("\\change Voice = \"2\""), /\\change Staff/);
  assert.match(problem("\\override Stem.color = #red"), /isn't part of the format/);
});

test("events between notes", () => {
  const evs = events("c4 \\breathe d4 \\caesura \\segnoMark \\fine");
  assert.deepEqual(evs.filter((e) => e.e === "event").map((e) => e.e === "event" && e.name), ["breathe", "caesura", "segnoMark", "fine"]);
});

test("beams close in the same string, one at a time", () => {
  events("c8[ d8 e8 f8]");
  assert.match(problem("c8[ d8"), /isn't closed in this stretch/);
  assert.match(problem("c8] d8"), /without its "\["/);
  assert.match(problem("c8[ d8[ e8] f8]"), /while another is open/);
});

test("tuplets, not nested; grace notes; tremolos", () => {
  assert.equal(length("\\tuplet 3/2 { c8 d8 e8 } f4"), "1/2");
  assert.match(problem("\\tuplet 3/2 { \\tuplet 3/2 { c8 d8 e8 } }"), /can't be nested/);
  assert.match(problem("\\tuplet 3/2 { c8 d8"), /isn't closed/);
  assert.equal(length("\\grace d16 c4 \\acciaccatura { e16 f16 } g4 \\appoggiatura <c' e'>8 d'4"), "3/4");
  assert.equal(length("\\repeat tremolo 4 { c16 e16 } c'4:32"), "3/4");
  assert.match(problem("\\repeat tremolo 4 { r16 }"), /has no notes/);
  assert.match(problem("{ c4 }"), /can only follow/);
});

test("durations: dots, breves, multi-measure rests", () => {
  assert.equal(length("c'4."), "3/8");
  assert.equal(length("c'4.."), "7/16");
  assert.equal(length("c'\\breve"), "2");
  assert.equal(length("R2.*4"), "3");
  assert.equal(length("\\clef bass s2 r4 r8 r16 r32 r64 r128"), "127/128");
});

test("errors say where", () => {
  assert.match(problem("c4 d4 h4"), /^at 7: "h"/);
});

test("tempo marks: LilyPond's \\tempo, with a text, a metronome mark or both", () => {
  const tempo = (text: string) => {
    const e = events(text).find((x) => x.e === "tempo");
    return e && e.e === "tempo" ? e.tempo : null;
  };
  assert.deepEqual(tempo('\\tempo "Allegro" 4 = 132 c4'), { text: "Allegro", unit: { base: 4, dots: 0 }, bpm: 132, bpmMax: null });
  assert.deepEqual(tempo("\\tempo 4. = 60 c4"), { text: null, unit: { base: 4, dots: 1 }, bpm: 60, bpmMax: null });
  assert.deepEqual(tempo("\\tempo 4 = 120-132 c4"), { text: null, unit: { base: 4, dots: 0 }, bpm: 120, bpmMax: 132 });
  assert.deepEqual(tempo("\\tempo 2 = 60 - 66 c4"), { text: null, unit: { base: 2, dots: 0 }, bpm: 60, bpmMax: 66 });
  assert.deepEqual(tempo('\\tempo "Andante con moto" c4'), { text: "Andante con moto", unit: null, bpm: null, bpmMax: null });
  assert.equal(length('\\tempo "Allegro" 4 = 132 c4 \\tempo "a tempo" d4'), "1/2"); // takes no time
  assert.match(problem("\\tempo c4"), /needs a text, a metronome mark or both/);
  assert.match(problem('\\tempo "Allegro" 4 c4'), /followed by "="/);
  assert.match(problem("\\tempo 4 = 132-120 c4"), /isn't a tempo/);
  assert.match(problem("\\tuplet 3/2 { c8 \\tempo 4 = 60 d8 e8 }"), /can't be inside/);
  // The metronome mark inside the text: its numbers would be lost.
  for (const text of ["Allegro ♩ = 132", "Allegro (♩. = 60)", "Lento 4 = 52", "\uE1D5 = 60"]) {
    assert.match(problem(`\\tempo "${text}" c4`), /after the text, not in it/);
  }
  assert.ok(events('\\tempo "Tempo I" c4').length === 2);
  assert.ok(events('\\tempo "ca. M.M." 4 = 60 c4').length === 2);
  assert.match(problem('c4^\\tempo "Allegro"'), /placement prefix/);
});
