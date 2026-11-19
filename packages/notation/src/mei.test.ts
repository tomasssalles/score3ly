import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateXML } from "xmllint-wasm";
import { BEYOND_BASIC, buildMei, measureNumberText, measureRange, withoutBeyondBasic } from "./mei.ts";
import { box, METADATA, richScore, stretch, system, voice } from "./testScore.ts";
import { buildScore } from "./score.ts";
import { DYNAMICS, EVENT_COMMANDS } from "./symbolic.ts";
import { elements, escapeAttr, serialize, unescapeAttr, type XmlElement } from "./xml.ts";

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

test("a system alone divides a measure split by its system break: each part incomplete", async () => {
  const score = buildScore(richScore(), [1, 4]);
  const first = find(buildMei(score, { systems: [1] }), "p1m4-s1t4")!;
  const second = find(buildMei(score, { systems: [2] }), "p1m4-s2t1")!;
  assert.deepEqual([attrOf(first, "metcon"), attrOf(first, "right"), attrOf(second, "metcon")], ["false", "invis", "false"]);
  // In the whole score, the measure is one, with the system break inside it.
  const whole = find(buildMei(score), "p1m4-s1t4")!;
  assert.equal(attrOf(whole, "metcon"), undefined);
  assert.ok(named(whole, "sb").length > 0);
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

const content = (e: XmlElement) => /<tempo[^>]*>([\s\S]*)<\/tempo>/.exec(serialize(e))![1];

test("tempo marks: the printed text and the metronome mark as content, the lower bound and note value as attributes", () => {
  const root = buildMei(buildScore(richScore(), [1, 4]));
  const tempos = named(root, "tempo");
  assert.equal(tempos.length, 2);
  const [sixty, allegro] = tempos;
  assert.deepEqual([attrOf(allegro, "mm"), attrOf(allegro, "mm.unit"), attrOf(allegro, "mm.dots"), attrOf(allegro, "tstamp"), attrOf(allegro, "staff")], ["120", "4", undefined, "1", "1"]);
  assert.equal(content(allegro), 'Allegro (<rend glyph.auth="smufl">\uE1D5</rend> = 120–132)');
  assert.deepEqual([attrOf(sixty, "mm"), attrOf(sixty, "mm.unit"), attrOf(sixty, "mm.dots"), attrOf(sixty, "tstamp"), attrOf(sixty, "staff")], ["60", "4", "1", "1", "3"]);
  assert.equal(content(sixty), '<rend glyph.auth="smufl">\uE1D5\uE1E7</rend> = 60');
});

test("every dynamic, pause and navigation sign the format has gets its MEI element", () => {
  const built = (music: string) => buildMei(buildScore([{ number: 1, page: 1, box: box(0.1), barLines: [], answer: system([stretch(1, [voice(1, 1, music), voice(2, 2, "R1")])], {}, true) }], [1]));
  for (const dynamic of DYNAMICS) {
    assert.deepEqual(named(built(`c'1\\${dynamic}`), "dynam").map((d) => d.children[0]), [dynamic], dynamic);
  }
  const expected: Record<(typeof EVENT_COMMANDS)[number], [string, string | undefined, string | undefined]> = {
    breathe: ["breath", undefined, undefined],
    caesura: ["caesura", undefined, undefined],
    segnoMark: ["repeatMark", "segno", undefined],
    codaMark: ["repeatMark", "coda", undefined],
    fine: ["repeatMark", "fine", "Fine"],
  };
  for (const name of EVENT_COMMANDS) {
    const [element, func, text] = expected[name];
    const found = named(built(`c'2 \\${name} c'2`), element);
    assert.equal(found.length, 1, name);
    assert.equal(attrOf(found[0], "func"), func, name);
    assert.equal(found[0].children[0], text, name);
  }
});

// A tempo mark beside a multi-measure rest (D4 of the code review): the rest stays one `multiRest` for its four measures,
// with the tempo mark as a control event.
test("a multi-measure rest with a tempo mark in its voice is written as one, with the tempo", async () => {
  const answer = system([stretch(1, [voice(1, 1, '\\tempo "Allegro" R1*4'), voice(2, 2, "R1*4")])], {}, true);
  const root = buildMei(buildScore([{ number: 1, page: 1, box: box(0.1), barLines: [], answer }], [1]));
  await assertValid(root);
  assert.deepEqual(named(root, "multiRest").map((m) => attrOf(m, "num")), ["4", "4"]);
  assert.deepEqual(named(root, "measure").map((m) => attrOf(m, "n")), ["1–4"]);
  assert.equal(named(root, "tempo").length, 1);
});

// Code review, D10: the header's `work` took the last title of a system with two, the `mdiv` the first.
test("a piece's title is one in the header and the music, the first where a system has two", () => {
  const metadata = { ...METADATA, pieces: [{ title: "No. 2", system: 4 }, { title: " Kuriose Geschichte ", system: 4 }] };
  const root = buildMei(buildScore(richScore(), [1, 4]), { metadata });
  assert.deepEqual(named(find(root, "work-piece-2")!, "title")[0].children, ["No. 2"]);
  assert.equal(attrOf(find(root, "piece-2"), "label"), "No. 2");
  // Without one: "Piece n" in the header, no label in the music.
  assert.deepEqual(named(find(root, "work-piece-1")!, "title")[0].children, ["Piece 1"]);
  assert.equal(attrOf(find(root, "piece-1"), "label"), undefined);
});

// Code review, group 21 #8: the file format's small contracts, written and read by one pair each.
test("a measure's number reads back, a multi-measure rest's range too", () => {
  assert.deepEqual(measureRange(measureNumberText(7, 1)), { from: 7, to: 7 });
  assert.deepEqual(measureRange(measureNumberText(12, 4)), { from: 12, to: 15 });
  assert.equal(measureNumberText(12, 4), "12–15");
  assert.equal(measureRange("x"), null);
  assert.equal(measureRange(""), null);
});

test("an attribute's text reads back as it was escaped", () => {
  for (const text of ['a "quote" <tag> & more', "tab\there\r\nand a new line", "&amp; written by a person", "ü, ♩ and 𝄞"]) {
    assert.equal(unescapeAttr(escapeAttr(text)), text);
  }
  assert.equal(unescapeAttr("&apos;&#65;&#x42;"), "'AB");
});
