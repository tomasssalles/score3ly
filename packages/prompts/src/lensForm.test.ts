import { test } from "node:test";
import assert from "node:assert/strict";
import { BAR_LINES, GROUP_SYMBOLS, ISSUE_CLASSES, MEASURE_KINDS, STRETCH_CLASSES } from "@score3ly/notation/lens";
import { APPLY_REVIEW_SCHEMA } from "./applyReview.ts";
import { EXTRACT_SCHEMA } from "./extract.ts";
import { REVIEW_SCHEMA } from "./review.ts";
import { buildScore, checkSystems } from "@score3ly/notation";
import { richScore } from "@score3ly/notation/testScore";
import {
  groupForModel,
  groupFromModel,
  issueForModel,
  lensFromExtract,
  staffForModel,
  staffFromModel,
  stretchForModel,
  stretchFromModel,
  stretchMeasures,
  systemFieldsForModel,
  systemForModel,
  systemFromModel,
  voiceForModel,
  voiceFromModel,
} from "./lensForm.ts";

const lensStretch = (over: object = {}) => ({
  stretch: 2,
  class: "new",
  kind: "normal",
  printedNumber: null,
  measureNumber: null,
  changes: [{ staff: 1, key: null, time: "3/4" }],
  ending: null,
  voices: [{ voice: 1, staff: 1, description: null, music: "c'1" }],
  rightBarLine: "single",
  ...over,
});

test("a stretch goes to the model's form and back unchanged, every ending and class", () => {
  const endings = [
    [null, "none"],
    [{ startsHere: true, endsHere: false, label: "1." }, "start"],
    [{ startsHere: false, endsHere: false, label: null }, "middle"],
    [{ startsHere: false, endsHere: true, label: null }, "end"],
    [{ startsHere: true, endsHere: true, label: "2." }, "whole"],
  ] as const;
  for (const [ending, value] of endings) {
    const s = lensStretch({ ending });
    const model = stretchForModel(s);
    assert.equal(model.ending, value);
    assert.equal(model.endingLabel, ending?.label ?? "");
    assert.deepEqual(stretchFromModel(model), s);
  }
  for (const [c, kind, value] of [["new", "incomplete", "new-incomplete"], ["continues", null, "continues"], ["none", null, "none"]] as const) {
    const s = lensStretch({ class: c, kind, printedNumber: "12", measureNumber: 12 });
    const model = stretchForModel(s);
    assert.equal(model.class, value);
    assert.deepEqual(stretchFromModel(model), s);
  }
  const model = stretchForModel(lensStretch());
  assert.deepEqual([model.printedNumber, model.measureNumber, model.changes, model.voices], ["", -1, [{ staff: 1, key: "", time: "3/4" }], [{ voice: 1, staff: 1, description: "", music: "c'1" }]]);
  assert.equal("kind" in model, false);
});

test("a staff goes to the model's form and back unchanged", () => {
  const staff = { staff: 1, description: null, label: null, clef: "treble", key: "0", time: null };
  assert.deepEqual(staffForModel(staff), { staff: 1, description: "", label: "", clef: "treble", key: "0", time: "" });
  assert.deepEqual(staffFromModel(staffForModel(staff)), staff);
});

test("the schemas of review and apply_review: no nullable field but a voice's music", () => {
  assert.doesNotMatch(JSON.stringify(REVIEW_SCHEMA), /"null"/);
  assert.equal(JSON.stringify(APPLY_REVIEW_SCHEMA).match(/"null"/g)?.length, 1);
  const voice = (APPLY_REVIEW_SCHEMA.properties!.voices as { items: { properties: { music: { anyOf: unknown[] } } } }).items.properties.music;
  assert.deepEqual(voice.anyOf, [{ type: "string" }, { type: "null" }]);
});

test("the answer's schema and the checks agree on every list of values, in the schema's order", () => {
  const stretch = EXTRACT_SCHEMA.properties!.stretches.items!.properties!;
  // The class and the measure's kind are one value in the answer (lensFromExtract splits them); the order is the one the
  // requests have always had.
  assert.deepEqual(stretch.class.enum, ["new-normal", "new-incomplete", "new-unmeasured", "continues", "none"]);
  assert.deepEqual(new Set(stretch.class.enum), new Set([...MEASURE_KINDS.map((k) => `new-${k}`), ...STRETCH_CLASSES.filter((c) => c !== "new")]));
  assert.deepEqual(stretch.ending.enum, ["none", "start", "middle", "end", "whole"]);
  assert.deepEqual(stretch.rightBarLine.enum, [...BAR_LINES]);
  assert.deepEqual(EXTRACT_SCHEMA.properties!.groups.items!.properties!.symbol.enum, [...GROUP_SYMBOLS]);
  assert.deepEqual(EXTRACT_SCHEMA.properties!.issues.items!.properties!.class.enum, [...ISSUE_CLASSES]);
});

test("every part of a system goes to the model's form and back unchanged", () => {
  for (const { answer } of richScore()) {
    for (const staff of answer.staves) assert.deepEqual(staffFromModel(staffForModel(staff)), staff);
    for (const group of answer.groups) assert.deepEqual(groupFromModel(groupForModel(group)), group);
    for (const stretch of answer.stretches) {
      assert.deepEqual(stretchFromModel(stretchForModel(stretch)), stretch);
      for (const voice of stretch.voices) assert.deepEqual(voiceFromModel(voiceForModel(voice)), voice);
    }
    // A system unit of apply_review, and extract's whole answer.
    const { stretches, issues: _, ...fields } = answer;
    const unit = { system: 3, ...fields, reason: null };
    assert.deepEqual(systemFromModel(systemFieldsForModel(unit)), unit);
    const model = { ...systemFieldsForModel(fields), stretches: stretches.map((s) => stretchForModel(s)), issues: [] };
    assert.deepEqual(lensFromExtract(model), { ...answer, issues: [] });
  }
});

// The seam between the two packages: extract's answers in the model's form, read back (lensFromExtract), are checked
// by notation exactly as the lens they stand for.
test("extract's answers in the model's form pass the checks as the lens they stand for", () => {
  const input = richScore();
  const contexts = input.map((s) => ({ system: s.number, stretches: s.answer.stretches.length, firstOfPiece: s.number === 1 || s.number === 4, images: [] }));
  const model = input.map(({ answer: { stretches, issues: _, ...fields } }) => ({ ...systemFieldsForModel(fields), stretches: stretches.map((s) => stretchForModel(s)), issues: [] }));
  const fromModel = checkSystems(model.map((m, i) => ({ context: contexts[i], answer: lensFromExtract(m) })));
  assert.ok(!("problem" in fromModel), "problem" in fromModel ? fromModel.problem : "");
  assert.deepEqual(fromModel, checkSystems(input.map((s, i) => ({ context: contexts[i], answer: s.answer }))));
});

test("a system as review and apply_review read it: its place, each stretch's measure, descriptions only for apply_review", () => {
  const input = richScore();
  const measureOf = stretchMeasures(buildScore(input, [1, 4]));
  assert.equal(measureOf.get("2/1"), measureOf.get("1/4")); // a measure across the system break
  const read = systemForModel(input[0].answer, { system: 1, page: 1 }, measureOf, false);
  assert.deepEqual(Object.keys(read), ["system", "page", "startRepeat", "staves", "groups", "stretches", "lastMeasureContinues"]);
  const staves = read.staves as Record<string, unknown>[];
  assert.deepEqual(staves[0], { staff: 1, label: "Piano", clef: "treble", key: "1f", time: "4/4" });
  const stretches = read.stretches as Record<string, unknown>[];
  assert.deepEqual([stretches[0].measure, stretches[1].measure], [measureOf.get("1/1"), measureOf.get("1/2")]);
  assert.deepEqual((stretches[0].voices as object[])[0], { voice: 1, staff: 1, music: input[0].answer.stretches[0].voices[0].music });
  const applied = systemForModel(input[0].answer, { system: 1, page: 1 }, measureOf, true);
  assert.equal((applied.staves as Record<string, unknown>[])[0].description, "piano right hand");
  assert.equal(((applied.stretches as Record<string, unknown>[])[0].voices as Record<string, unknown>[])[0].description, "melody");
  assert.equal(((applied.stretches as Record<string, unknown>[])[1].voices as Record<string, unknown>[])[0].description, "");
});

test("an issue as a model reads it: no location is \"\", a reading issue's tokens [] as a model writes them, the order kept", () => {
  const issue = { id: 3, class: "reading", location: null, question: "Q?", lilypond: null };
  assert.deepEqual(Object.entries(issueForModel(issue)), [["id", 3], ["class", "reading"], ["location", ""], ["question", "Q?"], ["lilypond", []]]);
  assert.deepEqual(issueForModel({ ...issue, class: "format", location: "the top note", lilypond: ["\\harmonic"] }), {
    id: 3,
    class: "format",
    location: "the top note",
    question: "Q?",
    lilypond: ["\\harmonic"],
  });
  assert.deepEqual(issueForModel({ id: 4, chosen: "b" }), { id: 4, chosen: "b" });
});
