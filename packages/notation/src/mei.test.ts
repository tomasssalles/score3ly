import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateXML } from "xmllint-wasm";
import type { LensStretch, LensSystem, LensVoice } from "./lens.ts";
import { BEYOND_BASIC, buildMei, withoutBeyondBasic, type MeiMetadata } from "./mei.ts";
import { buildScore, type ScoreSystemInput } from "./score.ts";
import { elements, serialize, type XmlElement } from "./xml.ts";

const schema = (name: string) => readFileSync(new URL(`../schemas/${name}.rng`, import.meta.url), "utf8");
const SCHEMAS = { all: schema("mei-all"), basic: schema("mei-basic") };

async function problems(xml: string, which: keyof typeof SCHEMAS): Promise<string[]> {
  const result = await validateXML({ xml: [{ fileName: "score.mei", contents: xml }], schema: [{ fileName: `${which}.rng`, contents: SCHEMAS[which] }], extension: "relaxng" });
  return result.errors.map((e) => e.rawMessage);
}

// Every MEI file is checked twice (§6, "MEI"): against full MEI 5, and, with what BEYOND_BASIC lists removed, against
// MEI Basic.
async function assertValid(root: XmlElement) {
  assert.deepEqual(await problems(serialize(root), "all"), [], "not valid MEI 5");
  assert.deepEqual(await problems(serialize(withoutBeyondBasic(root)), "basic"), [], "not valid MEI Basic once BEYOND_BASIC is removed");
}

const voice = (v: number, staff: number, music: string, description: string | null = null): LensVoice => ({ voice: v, staff, description, music });

function stretch(i: number, voices: LensVoice[], over: Partial<LensStretch> = {}): LensStretch {
  return { stretch: i, class: "new", kind: "normal", printedNumber: null, measureNumber: null, changes: [], ending: null, voices, rightBarLine: "single", ...over };
}

function system(stretches: LensStretch[], over: Partial<LensSystem> = {}, first = false): LensSystem {
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

const box = (top: number) => ({ left: 0.1, right: 0.9, top, bottom: top + 0.2 });

// A score with most of the format: two pieces, accidentals, chords with their own curves, ties across a bar line and a
// system break, a measure split across systems, an ottava, tuplets, grace notes, tremolos, cross-staff notes, beams,
// dynamics between the staves, hairpins, pedal, texts, navigation, endings and repeats, a multi-measure rest, key and
// time changes, a clef change, a third staff added for a passage.
function richScore(): ScoreSystemInput[] {
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
      stretch(1, [voice(3, 3, "R2.", "singer"), voice(1, 1, "\\grace { c''16 d''16 } e''2.\\arpeggio"), voice(2, 2, "<c e g>2.\\glissando")], { rightBarLine: "endRepeat" }),
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
      stretch(1, [voice(1, 1, "c''4\\mordent d''4\\prall e''4\\turn\\startTrillSpan f''4\\stopTrillSpan", "melody"), voice(2, 2, "c1\\unaCorda", "bass")]),
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

const METADATA: MeiMetadata = {
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

const APP = { name: "score3ly", version: "0.1.0", url: "https://github.com/tomasssalles/score3ly" };

const find = (root: XmlElement, id: string) => [...elements(root)].find((e) => e.attrs.some(([k, v]) => k === "xml:id" && v === id));
const attrOf = (e: XmlElement | undefined, name: string) => e?.attrs.find(([k]) => k === name)?.[1];
const named = (root: XmlElement, name: string) => [...elements(root)].filter((e) => e.name === name);

test("the full score is valid MEI 5, and valid MEI Basic without what we use beyond it", async () => {
  const score = buildScore(richScore(), [1, 4]);
  await assertValid(buildMei(score, { metadata: METADATA, application: APP }));
});

test("each system on its own is valid MEI 5 and MEI Basic too", async () => {
  const score = buildScore(richScore(), [1, 4]);
  for (const n of [1, 2, 3, 4]) await assertValid(buildMei(score, { systems: [n] }));
});

test("without metadata the file is still valid", async () => {
  await assertValid(buildMei(buildScore(richScore(), [1])));
});

test("only the elements listed beyond MEI Basic are removed", () => {
  const root = buildMei(buildScore(richScore(), [1, 4]), { metadata: METADATA, application: APP });
  const stripped = withoutBeyondBasic(root);
  const names = new Set(named(stripped, "").length ? [] : [...elements(stripped)].map((e) => e.name));
  for (const e of BEYOND_BASIC.elements) assert.ok(!names.has(e));
  assert.ok(names.has("measure") && names.has("note"));
  assert.equal(named(root, "facsimile").length, 1);
});

test("pitches: printed accidentals hold to the end of the measure in their voice and octave; the key gives the rest", () => {
  const root = buildMei(buildScore(richScore(), [1, 4]));
  // Key of one flat: b' is B♭ unless something says otherwise. The sharp on the first f' holds for the second.
  const f2 = find(root, "s1t1v1e1");
  assert.equal(attrOf(f2, "accid.ges"), "s");
  assert.equal(attrOf(find(root, "s1t1v1e0"), "accid.ges"), undefined); // printed: <accid accid="s"/>
  assert.equal(named(find(root, "s1t1v1e0")!, "accid")[0] && attrOf(named(find(root, "s1t1v1e0")!, "accid")[0], "accid"), "s");
  // The b' in stretch 2 (no accidental printed) sounds B♭ from the key.
  assert.equal(attrOf(find(root, "s1t2v1e2"), "accid.ges"), "f");
});

test("an ottava raises the sounding octave of the notes under it, by time on its staff", () => {
  const root = buildMei(buildScore(richScore(), [1, 4]));
  assert.equal(attrOf(find(root, "s1t3v1e1"), "oct"), "6");
  assert.equal(attrOf(find(root, "s1t3v1e1"), "oct.ges"), "7");
  assert.equal(attrOf(find(root, "s1t3v1e4"), "oct.ges"), undefined); // after \ottava #0
  const octave = named(root, "octave")[0];
  assert.equal(attrOf(octave, "startid"), "#s1t3v1e1");
  assert.equal(attrOf(octave, "endid"), "#s1t3v1e2");
});

test("curves: a tie between notes of the same pitch, also across a system break; a slur otherwise", () => {
  const root = buildMei(buildScore(richScore(), [1, 4]));
  const ties = named(root, "tie").map((t) => `${attrOf(t, "startid")}>${attrOf(t, "endid")}`);
  const slurs = named(root, "slur").map((t) => `${attrOf(t, "startid")}>${attrOf(t, "endid")}`);
  assert.ok(ties.includes("#s1t3v1e4>#s1t4v1e0"), `ties: ${ties}`); // e''2 tied over the bar line
  assert.ok(ties.includes("#s2t1v1e0>#s2t1v1e1"), `ties: ${ties}`);
  assert.ok(ties.includes("#s1t1v1e4h1>#s1t2v1e0h1"), `ties: ${ties}`); // the chord's e'' to the next chord's e''
  assert.ok(slurs.includes("#s1t1v1e0>#s1t1v1e3"), `slurs: ${slurs}`);
  // The tied e'' in the next chord keeps the flat over the bar line.
  assert.equal(attrOf(find(root, "s1t2v1e0h1"), "accid.ges"), "f");
});

test("a measure split across systems is one measure in the full score, half a measure on each system alone", () => {
  const score = buildScore(richScore(), [1, 4]);
  const full = buildMei(score);
  const split = find(full, "p1m4-s1t4")!;
  assert.equal(attrOf(split, "facs"), "#z1t4-4 #z2t1-1");
  assert.ok(named(split, "sb").length > 0);
  const alone = buildMei(score, { systems: [2] });
  assert.equal(attrOf(find(alone, "p1m4-s2t1"), "metcon"), "false");
  // Nothing in a system alone points outside it.
  const ids = new Set([...elements(alone)].flatMap((e) => e.attrs.filter(([k]) => k === "xml:id").map(([, v]) => v)));
  for (const e of elements(alone)) {
    for (const [k, v] of e.attrs) if (k === "startid" || k === "endid") assert.ok(ids.has(v.slice(1)), `${e.name} ${k}=${v}`);
  }
});

test("measures are numbered per piece, a pickup 0 when the printed numbers say so; a multi-measure rest counts its measures", () => {
  const root = buildMei(buildScore(richScore(), [1, 4]));
  const numbers = named(named(root, "mdiv")[0], "measure").map((m) => attrOf(m, "n"));
  assert.deepEqual(numbers, ["0", "1", "2", "3", "4", "5", "6", "7", "8–11"]);
  assert.deepEqual(named(named(root, "mdiv")[1], "measure").map((m) => attrOf(m, "n")), ["1", "2", "2"]);
});

test("dynamics printed between braced staves apply to both; texts are dynamics or directions by their words", () => {
  const root = buildMei(buildScore(richScore(), [1, 4]));
  const p = named(root, "dynam").find((d) => d.children[0] === "p");
  assert.equal(attrOf(p, "staff"), "1 2");
  assert.ok(named(root, "dynam").some((d) => d.children[0] === "cresc."));
  assert.ok(named(root, "dir").some((d) => d.children[0] === "dolce"));
});

test("text from users and models is escaped", () => {
  const xml = serialize(buildMei(buildScore(richScore(), [1, 4]), { metadata: METADATA }));
  assert.ok(xml.includes("Scènes d'enfants &lt;&amp; \"more\"&gt;"));
});

test("a bar line inside a measure divides it into MEI measures, incomplete, with its number; a tie crosses it", () => {
  const root = buildMei(buildScore(richScore(), [1, 4]));
  const first = find(root, "p2m2-s4t2")!;
  const second = find(root, "p2m2-s4t3")!;
  assert.deepEqual([attrOf(first, "n"), attrOf(first, "metcon"), attrOf(first, "right")], ["2", "false", undefined]);
  assert.deepEqual([attrOf(second, "n"), attrOf(second, "metcon"), attrOf(second, "left")], ["2", "false", "rptstart"]);
  assert.equal(named(root, "barLine").length, 0);
  assert.ok(named(root, "tie").some((t) => attrOf(t, "startid") === "#s4t2v1e0" && attrOf(t, "endid") === "#s4t3v1e0"));
  // The caesura's beat counts from the start of its own MEI measure.
  assert.equal(attrOf(named(second, "caesura")[0], "tstamp"), "2");
});

test("engrave's rendering copy divides a measure at its system break, with the break between the two", async () => {
  const score = buildScore(richScore(), [1, 4]);
  const root = buildMei(score, { divideAtSystemBreaks: true });
  await assertValid(root);
  const first = find(root, "p1m4-s1t4")!;
  const second = find(root, "p1m4-s2t1")!;
  assert.deepEqual([attrOf(first, "metcon"), attrOf(first, "right"), attrOf(second, "metcon")], ["false", "invis", "false"]);
  const section = named(root, "section")[0];
  const order = section.children.flatMap((c) => (typeof c === "string" ? [] : [c.name === "measure" ? attrOf(c, "xml:id") : c.name]));
  assert.equal(order[order.indexOf("p1m4-s1t4") + 1], "sb");
  assert.equal(named(first, "sb").length, 0);
});

test("tremolos on chords: two chords alternating (fTrem), and a chord repeated (bTrem)", async () => {
  const s = system(
    [
      stretch(1, [voice(1, 1, "\\repeat tremolo 4 { <c' e'>16 <g' c''>16 } <e' g'>2:32", "melody"), voice(2, 2, "c1", "bass")]),
      stretch(2, [voice(1, 1, "\\repeat tremolo 8 { <c' e'>32 <d' f'>32 } r2"), voice(2, 2, "c1")], { rightBarLine: "final" }),
    ],
    {},
    true,
  );
  const root = buildMei(buildScore([{ number: 1, page: 1, box: box(0.1), barLines: [0.5], answer: s }], [1]));
  await assertValid(root);
  const [fTrem] = named(root, "fTrem");
  assert.equal(attrOf(fTrem, "unitdur"), "16");
  // Two chords, each written with half of the tremolo's length: 4 × (1/16 + 1/16) = 1/2, so a quarter each.
  assert.deepEqual(fTrem.children.map((c) => (typeof c === "string" ? c : `${c.name}:${attrOf(c, "dur")}`)), ["chord:4", "chord:4"]);
  assert.equal(named(fTrem, "note").length, 4);
  const [bTrem] = named(root, "bTrem");
  assert.equal(attrOf(bTrem, "unitdur"), "32");
  assert.equal(named(bTrem, "chord").length, 1);
  // 8 × (1/32 + 1/32) = 1/2 again: quarter-note chords.
  assert.deepEqual(named(root, "fTrem")[1].children.map((c) => (typeof c === "string" ? c : attrOf(c, "dur"))), ["4", "4"]);
});
