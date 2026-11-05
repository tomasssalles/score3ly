import { test } from "node:test";
import assert from "node:assert/strict";
import { COMMAND_WORDS, GRADED_DYNAMICS, parseVoice } from "@score3ly/notation/symbolic";
import { MUSIC } from "./extract.ts";

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
