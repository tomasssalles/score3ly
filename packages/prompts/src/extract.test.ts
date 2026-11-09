import { test } from "node:test";
import assert from "node:assert/strict";
import { COMMAND_WORDS, GRADED_DYNAMICS, parseVoice } from "@score3ly/notation/symbolic";
import { EXTRACT_SCHEMA, LENS_PITFALLS, MUSIC } from "./extract.ts";
import { lensFromExtract } from "./lensForm.ts";

// docs/notation.md, "The token list": the prompt and the parser can't drift apart.
test("every command the prompt shows is one the parser knows, and every one it knows is shown", () => {
  const shown = new Set([...MUSIC.matchAll(/\\([a-zA-Z]+)/g)].map((m) => m[1]));
  // The graded dynamics are shown as a range, softest … loudest.
  const [softest, loudest] = [GRADED_DYNAMICS[0], GRADED_DYNAMICS[GRADED_DYNAMICS.length - 1]];
  if (MUSIC.includes(`\\${softest}\` … \`\\${loudest}`)) for (const d of GRADED_DYNAMICS) shown.add(d);
  assert.deepEqual([...shown].filter((word) => !COMMAND_WORDS.includes(word)), []);
  assert.deepEqual(COMMAND_WORDS.filter((word) => !shown.has(word)), []);
});

test("the prompt's examples of notes and marks parse", () => {
  for (const example of ["g'4.", "<c' \\flat e' g'>4", "<c'\\=1( e'\\=2(>4", "c'4-.\\=1(", "c'4 -. \\=1(", "c'4:32", "c'4_\\p", "R1*12", "c4 \\breathe d4", '\\tempo "Allegro" 4 = 132 c4', "\\tempo 4 = 120-132 c4", '\\clef "treble_8" c4', "\\ottava #1 c''4", '\\change Staff = "3" c4', "\\tuplet 3/2 { c8 d8 e8 }", "\\repeat tremolo 4 { c'16 e'16 }", "\\grace { c'16 } d'4"]) {
    const parsed = parseVoice(example);
    assert.ok(!("problem" in parsed), `${example}: ${"problem" in parsed ? parsed.problem : ""}`);
  }
});

test("the recap's wrong examples don't parse, and its right ones do", () => {
  for (const p of LENS_PITFALLS) {
    for (const wrong of p.wrong) assert.equal("problem" in parseVoice(wrong), !p.parses, wrong);
    for (const right of p.right) {
      const parsed = parseVoice(right);
      assert.ok(!("problem" in parsed), `${right}: ${"problem" in parsed ? parsed.problem : ""}`);
    }
  }
});

test("the answer's schema has no nullable field", () => {
  assert.doesNotMatch(JSON.stringify(EXTRACT_SCHEMA), /anyOf|"null"/);
});

test("the answer becomes the lens: sentinels null, the class split, the ending an object, a reading issue's tokens null", () => {
  const stretch = (over: object) => ({
    stretch: 1,
    class: "continues",
    printedNumber: "",
    measureNumber: -1,
    changes: [{ staff: 1, key: "", time: "3/4" }],
    ending: "none",
    endingLabel: "",
    voices: [{ voice: 1, staff: 1, description: "", music: "" }],
    rightBarLine: "single",
    ...over,
  });
  const issue = { boxes: [], location: "", question: "?", answers: [], applied: "a", class: "reading", lilypond: [] };
  const lens = lensFromExtract({
    startRepeat: false,
    staves: [{ staff: 1, description: "", label: "", clef: "treble", key: "0", time: "" }],
    groups: [{ staves: [1], symbol: "brace", label: "" }],
    stretches: [
      stretch({}),
      stretch({ stretch: 2, class: "new-incomplete", printedNumber: "12", measureNumber: 12, ending: "start", endingLabel: "1." }),
      stretch({ stretch: 3, class: "new-normal", measureNumber: 0, ending: "middle" }),
      stretch({ stretch: 4, class: "none", ending: "end" }),
      stretch({ stretch: 5, class: "new-unmeasured", ending: "whole", endingLabel: "2." }),
    ],
    lastMeasureContinues: false,
    issues: [issue, { ...issue, location: "The top note", class: "format", lilypond: [] }, { ...issue, class: "format", lilypond: ["\\harmonic"] }],
  }) as { staves: object[]; groups: object[]; stretches: Record<string, unknown>[]; issues: Record<string, unknown>[] };
  assert.deepEqual(lens.staves, [{ staff: 1, description: null, label: null, clef: "treble", key: "0", time: null }]);
  assert.deepEqual(lens.groups, [{ staves: [1], symbol: "brace", label: null }]);
  assert.deepEqual(lens.stretches[0], {
    stretch: 1,
    class: "continues",
    kind: null,
    printedNumber: null,
    measureNumber: null,
    changes: [{ staff: 1, key: null, time: "3/4" }],
    ending: null,
    voices: [{ voice: 1, staff: 1, description: null, music: "" }],
    rightBarLine: "single",
  });
  const fields = (s: Record<string, unknown>) => [s.class, s.kind, s.printedNumber, s.measureNumber, s.ending];
  assert.deepEqual(fields(lens.stretches[1]), ["new", "incomplete", "12", 12, { startsHere: true, endsHere: false, label: "1." }]);
  assert.deepEqual(fields(lens.stretches[2]), ["new", "normal", null, 0, { startsHere: false, endsHere: false, label: null }]);
  assert.deepEqual(fields(lens.stretches[3]), ["none", null, null, null, { startsHere: false, endsHere: true, label: null }]);
  assert.deepEqual(fields(lens.stretches[4]), ["new", "unmeasured", null, null, { startsHere: true, endsHere: true, label: "2." }]);
  assert.deepEqual(
    lens.issues.map((i) => [i.location, i.lilypond]),
    [
      [null, null],
      ["The top note", []],
      [null, ["\\harmonic"]],
    ],
  );
});
