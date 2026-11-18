// A score for tests (`mei.test.ts`, and the web's request snapshots): the lens of four systems with most of the format,
// and the metadata of a real edition. Not part of the package's main entry.

import type { LensStretch, LensSystem, LensVoice } from "./lens.ts";
import type { MeiMetadata } from "./mei.ts";
import type { ScoreSystemInput } from "./score.ts";

export const voice = (v: number, staff: number, music: string, description: string | null = null): LensVoice => ({ voice: v, staff, description, music });

export function stretch(i: number, voices: LensVoice[], over: Partial<LensStretch> = {}): LensStretch {
  return { stretch: i, class: "new", kind: "normal", printedNumber: null, measureNumber: null, changes: [], ending: null, voices, rightBarLine: "single", ...over };
}

export function system(stretches: LensStretch[], over: Partial<LensSystem> = {}, first = false): LensSystem {
  return {
    startRepeat: false,
    staves: [
      { staff: 1, description: first ? "piano right hand" : null, label: first ? "Piano" : null, clef: "treble", key: "1f", time: first ? "4/4" : null },
      { staff: 2, description: first ? "piano left hand" : null, label: null, clef: "bass", key: "1f", time: first ? "4/4" : null },
    ],
    groups: [{ staves: [1, 2], symbol: "brace", label: null }],
    stretches,
    lastMeasureContinues: false,
    issues: [],
    ...over,
  };
}

export const box = (top: number) => ({ left: 0.1, right: 0.9, top, bottom: top + 0.2 });

// A score with most of the format: two pieces, accidentals, chords with their own curves, ties across a bar line and a
// system break, a measure split across systems, an ottava, tuplets, grace notes, tremolos, cross-staff notes, beams,
// dynamics between the staves, hairpins, pedal, texts, navigation, endings and repeats, a multi-measure rest, key and
// time changes, a clef change, a third staff added for a passage, tempo marks.
export function richScore(): ScoreSystemInput[] {
  const s1 = system(
    [
      stretch(1, [voice(1, 1, "\\sharp f'4-.\\=1( f'8[ g'8] a'4\\=1) <c'' \\flat e''\\=2( g''>4_\\p\\<", "melody"), voice(2, 2, "c4-1 \\clef treble g4 \\clef bass c2\\sustainOn", "bass")], { kind: "incomplete", printedNumber: null }),
      stretch(2, [voice(1, 1, "<c'' e''\\=2) g''>4\\! \\tuplet 3/2 { b'8 c''8 d''8 } \\acciaccatura e''8 d''2\\fermata"), voice(2, 2, "c2\\sustainOff \\change Staff = \"1\" e'4 \\change Staff = \"2\" c4")], { measureNumber: 1, printedNumber: "1" }),
      stretch(3, [voice(1, 1, "\\ottava #1 c'''4 d'''4 \\ottava #0 e''2\\=3("), voice(2, 2, "c4:16 r4 \\repeat tremolo 4 { c16 e16 }")], { rightBarLine: "double" }),
      stretch(4, [voice(1, 1, "e''2\\=3) f''4 \\breathe g''4"), voice(2, 2, "R1")], { class: "new", rightBarLine: "none" }),
    ],
    { lastMeasureContinues: true },
    true,
  );
  // The measure that started at the end of system 1 continues here, with a tie across the break.
  const s2 = system(
    [
      stretch(1, [voice(1, 1, "\\flat b'4\\=1( b'4\\=1) r2"), voice(2, 2, "s1")], { class: "continues", kind: null, rightBarLine: "single" }),
      stretch(2, [voice(1, 1, "b'1^\"dolce\""), voice(2, 2, "c1_\"cresc.\"")], { ending: { startsHere: true, endsHere: true, label: "1." }, rightBarLine: "endRepeat", changes: [] }),
      stretch(3, [voice(1, 1, "c''1\\trill"), voice(2, 2, "c1")], { ending: { startsHere: true, endsHere: true, label: "2." }, rightBarLine: "startRepeat" }),
      stretch(4, [voice(1, 1, "c''2 \\segnoMark d''2^\"D.S. al Fine\""), voice(2, 2, "c1\\laissezVibrer")], { changes: [{ staff: 1, key: "2s", time: "3/4" }, { staff: 2, key: "2s", time: "3/4" }], rightBarLine: "single" }),
    ],
  );
  s2.stretches[3].voices = [voice(1, 1, "c''2 \\segnoMark d''4^\"D.S. al Fine\""), voice(2, 2, "c2.\\laissezVibrer")];
  s2.stretches[2].rightBarLine = "startRepeat";
  // A third staff appears above, for a voice.
  const s3: LensSystem = {
    ...system([
      stretch(1, [voice(3, 3, "\\tempo 4. = 60 R2.", "singer"), voice(1, 1, "\\grace { c''16 d''16 } e''2.\\arpeggio"), voice(2, 2, "<c e g>2.\\glissando")], { rightBarLine: "endRepeat" }),
      stretch(2, [voice(3, 3, "R2.*4"), voice(1, 1, "R2.*4"), voice(2, 2, "R2.*4")], { measureNumber: 8, printedNumber: "8–11", rightBarLine: "final" }),
    ]),
    startRepeat: true,
    staves: [
      { staff: 3, description: "voice", label: "Voice", clef: "\"treble_8\"".replace(/"/g, ""), key: "2s", time: null },
      { staff: 1, description: null, label: "Pno.", clef: "treble", key: "2s", time: null },
      { staff: 2, description: null, label: null, clef: "bass", key: "2s", time: null },
    ],
  };
  // A second piece.
  // A second piece, with a measure divided by a start repeat after its first half (stretches 2 and 3).
  const s4 = system(
    [
      stretch(1, [voice(1, 1, "\\tempo \"Allegro\" 4 = 120-132 c''4\\mordent d''4\\prall e''4\\turn\\startTrillSpan f''4\\stopTrillSpan", "melody"), voice(2, 2, "c1\\unaCorda", "bass")]),
      stretch(2, [voice(1, 1, "g''2\\=1("), voice(2, 2, "c2\\treCorde")], { rightBarLine: "startRepeat" }),
      stretch(3, [voice(1, 1, "g''4\\=1) \\caesura a''4"), voice(2, 2, "c2")], { class: "continues", kind: null, rightBarLine: "final" }),
    ],
    {},
    true,
  );
  return [
    { number: 1, page: 1, box: box(0.1), barLines: [0.3, 0.5, 0.7], answer: s1 },
    { number: 2, page: 1, box: box(0.5), barLines: [0.3, 0.5, 0.7], answer: s2 },
    { number: 3, page: 2, box: box(0.1), barLines: [0.5], answer: s3 },
    { number: 4, page: 2, box: box(0.5), barLines: [0.4, 0.7], answer: s4 },
  ];
}

export const METADATA: MeiMetadata = {
  titles: [
    { text: "Kinderscenen", type: "main" },
    { text: "Scènes d'enfants <& \"more\">", type: "translated" },
  ],
  people: [
    { name: "Robert Schumann", role: "composer" },
    { name: "Clara Schumann", role: "editor" },
    { name: "J. Schmidt (Stecher)", role: "other" },
    { name: "A. Poet", role: "lyricist" },
  ],
  pieces: [
    { title: "Von fremden Ländern", system: 1 },
    { title: "Kuriose Geschichte", system: 4 },
  ],
  catalogueNumbers: [{ text: "Op. 15" }],
  dedications: [{ text: "To C." }],
  instrumentation: [{ text: "für Klavier" }],
  compositionDates: [{ text: "1838" }],
  publishers: [{ text: "Breitkopf & Härtel" }],
  places: [{ text: "Leipzig" }],
  dates: [{ text: "1839" }],
  plateNumbers: [{ text: "5948" }],
  notices: [{ text: "Eigenthum des Verlegers" }],
  comments: [{ text: "Transcribed from a stained copy." }],
};
