import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildScore, meiString } from "@score3ly/notation";
import { changesNote, checkMei, idProblems, linesChanged } from "./meiChecks.ts";
import { meiValidator } from "./meiSchema.ts";

test("ids: one used twice, and references to ids nothing has", () => {
  const element = (line: number, attrs: Record<string, string>) => ({ line, attrs: Object.entries(attrs).map(([name, value]) => ({ name, value })) });
  const elements = [
    element(1, { "xml:id": "m1" }),
    element(2, { "xml:id": "n1" }),
    element(3, { "xml:id": "n1" }),
    element(4, { startid: "#n1", endid: "#n2" }),
    element(5, { target: "https://example.org/#top" }),
    element(6, { color: "#ff0000", label: "#1" }),
  ];
  assert.deepEqual(idProblems(elements), [
    { line: 3, message: 'The id "n1" is already used on line 2.' },
    { line: 4, message: '@endid points to "#n2", but no element has that id.' },
  ]);
});

test("lines changed: a changed line counts once, added and removed lines each", () => {
  const before = ["a", "b", "c", "d", "e"].join("\n");
  assert.equal(linesChanged(before, before), 0);
  assert.equal(linesChanged(before, ["a", "B", "c", "d", "e"].join("\n")), 1);
  assert.equal(linesChanged(before, ["a", "b", "x", "y", "c", "d", "e"].join("\n")), 2);
  assert.equal(linesChanged(before, ["a", "e"].join("\n")), 3);
  assert.equal(linesChanged(before, ["b", "a", "c", "D", "e", "f"].join("\n")), 3);
  assert.equal(changesNote(0), "no changes");
  assert.equal(changesNote(1), "1 line changed");
  assert.equal(changesNote(14), "14 lines changed");
});

const validator = meiValidator(readFileSync(new URL("../../../packages/notation/schemas/mei-all.rng", import.meta.url), "utf8"));
const validate = async (text: string) => validator(text);

const SYSTEM = {
  startRepeat: false,
  staves: [{ staff: 1, description: null, label: null, clef: "treble", key: "0", time: "4/4" }],
  groups: [],
  stretches: [{ stretch: 1, class: "new", kind: "normal", printedNumber: null, measureNumber: null, changes: [], ending: null, rightBarLine: "single", voices: [{ voice: 1, staff: 1, description: null, music: "c'4 d'4\\=1( e'4\\=1) f'4" }] }],
  lastMeasureContinues: false,
  issues: [],
};

test("a file the builder wrote passes; a broken one says where", async () => {
  const mei = meiString(buildScore([{ number: 1, page: 1, box: null, barLines: [], answer: SYSTEM as never }], [1]));
  assert.deepEqual(await checkMei(mei, validate), []);
  const lines = mei.split("\n");
  const note = lines.findIndex((l) => l.includes("<note "));
  const unknown = [...lines];
  unknown[note] = unknown[note].replace("<note ", "<nota ");
  const problems = await checkMei(unknown.join("\n"), validate);
  assert.ok(problems.length > 0);
  assert.ok(problems.some((p) => p.line === note + 1), JSON.stringify(problems));
  const broken = [...lines];
  broken[note] = broken[note].replace("/>", ">");
  const malformed = await checkMei(broken.join("\n"), validate);
  assert.ok(malformed.length > 0 && malformed.every((p) => p.line !== null), JSON.stringify(malformed));
  assert.ok(malformed.every((p) => p.syntax));
  assert.match(malformed[0].message, /Opening and ending tag mismatch: note line \d+ and layer/);
});

test("only MEI's pointers are references, and ids are read however they are quoted", async () => {
  const mei = meiString(buildScore([{ number: 1, page: 1, box: null, barLines: [], answer: SYSTEM as never }], [1]));
  const lines = mei.split("\n");
  const slur = lines.find((l) => l.includes("<slur "))!;
  const target = slur.match(/startid="#([^"]+)"/)![1];
  const edited = lines.map((l) =>
    l.replace(`xml:id="${target}"`, `xml:id='${target}' color="#ff0000"`).replace(/<staffDef /, '<staffDef label="#1" '),
  );
  assert.deepEqual(await checkMei(edited.join("\n"), validate), []);
  // A pointer to nothing is still found, on its line, whatever its quotes.
  const dangling = lines.map((l) => (l === slur ? l.replace(/endid="#[^"]+"/, "endid='#nothing'") : l));
  assert.deepEqual(await checkMei(dangling.join("\n"), validate), [
    { line: lines.indexOf(slur) + 1, message: '@endid points to "#nothing", but no element has that id.' },
  ]);
});
