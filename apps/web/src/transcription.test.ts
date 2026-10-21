import { test } from "node:test";
import assert from "node:assert/strict";
import type { StoredExtraction } from "./extract.ts";
import { boxesOnCrop, homeOf, notesOf, shownSystem, type Note } from "./transcription.ts";

const extraction = (system: number, page: number): StoredExtraction => ({
  system,
  page,
  answer: { startRepeat: false, staves: [], groups: [], stretches: [], lastMeasureContinues: false, issues: [] },
  issues: [],
  warnings: [],
});

const systems = [
  shownSystem(extraction(1, 1), { box: { left: 0.1, right: 0.9, top: 0.1, bottom: 0.3 }, barLines: [0.5] }),
  shownSystem(extraction(2, 1), { box: { left: 0.1, right: 0.9, top: 0.4, bottom: 0.6 }, barLines: [0.5] }),
  shownSystem(extraction(3, 2), { box: { left: 0.1, right: 0.9, top: 0.1, bottom: 0.3 }, barLines: [] }),
];

const warning = (boxes: Note["boxes"]): Note => ({ key: "w", boxes, kind: "warning", warning: { message: "m", boxes } });

test("a note's text goes below the system its first box falls on", () => {
  assert.equal(homeOf(warning([{ page: 1, box: { left: 0.5, right: 0.9, top: 0.45, bottom: 0.55 } }]), systems), 2);
  assert.equal(homeOf(warning([{ page: 2, box: { left: 0.5, right: 0.9, top: 0.15, bottom: 0.25 } }]), systems), 3);
  assert.equal(homeOf(warning([{ page: 3, box: { left: 0, right: 1, top: 0, bottom: 1 } }]), systems), null);
});

test("a box is drawn on every crop it falls on, in the crop's fractions, cut at its edges", () => {
  // A box over the end of system 1 and the start of system 2: on both crops.
  const notes = [warning([{ page: 1, box: { left: 0.7, right: 0.9, top: 0.2, bottom: 0.5 } }])];
  const onFirst = boxesOnCrop(notes, 1, systems[0].crop);
  const onSecond = boxesOnCrop(notes, 1, systems[1].crop);
  assert.equal(onFirst.length, 1);
  assert.equal(onSecond.length, 1);
  assert.equal(onFirst[0].box.bottom, 1);
  assert.equal(onSecond[0].box.top, 0);
  assert.deepEqual(boxesOnCrop(notes, 2, systems[2].crop), []);
});

test("issues and warnings of the systems and of the whole score, each with its own key", () => {
  const withNotes = { ...systems[0], extraction: { ...extraction(1, 1), warnings: [{ message: "a", boxes: [] }] } };
  const notes = notesOf([withNotes], { issues: [], warnings: [{ message: "b", boxes: [] }] });
  assert.deepEqual(notes.map((n) => n.key), ["warning-1-0", "warning-score-0"]);
});
