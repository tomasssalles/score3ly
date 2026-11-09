import { test } from "node:test";
import assert from "node:assert/strict";
import { APPLY_REVIEW_SCHEMA } from "./applyReview.ts";
import { REVIEW_SCHEMA } from "./review.ts";
import { staffForModel, staffFromModel, stretchForModel, stretchFromModel } from "./lensForm.ts";

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
  const voice = (APPLY_REVIEW_SCHEMA.properties.voices as { items: { properties: { music: { anyOf: unknown[] } } } }).items.properties.music;
  assert.deepEqual(voice.anyOf, [{ type: "string" }, { type: "null" }]);
});
