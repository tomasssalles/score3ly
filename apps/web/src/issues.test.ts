import { test } from "node:test";
import assert from "node:assert/strict";
import { placesOf, systemsOf, type PlacedSystem, type StoredIssue } from "./issues.ts";
import { boxProblems } from "./humanReview.ts";
import { applyCalls } from "./applyReview.ts";
import { systemCropBox } from "./crops.ts";

// Six systems close together on one page: each crop (15% of a system's height above and below) reaches into its
// neighbours' boxes.
const CLOSE: PlacedSystem[] = Array.from({ length: 6 }, (_, i) => ({
  number: i + 1,
  page: 1,
  layout: { box: { left: 0.1, right: 0.9, top: 0.02 + i * 0.15, bottom: 0.16 + i * 0.15 }, barLines: [0.5] },
}));
const topOf5 = { page: 1, box: { left: 0.2, right: 0.3, top: CLOSE[4].layout.box.top + 0.002, bottom: CLOSE[4].layout.box.top + 0.03 } };
const bottomOf6 = { page: 1, box: { left: 0.6, right: 0.7, top: CLOSE[5].layout.box.bottom - 0.03, bottom: CLOSE[5].layout.box.bottom - 0.002 } };

test("the systems are close: system 4's crop reaches into system 5's box", () => {
  assert.ok(systemCropBox(CLOSE[3].layout).bottom > topOf5.box.top);
});

test("a box at the top of system 5 is on system 5 only (B4)", () => {
  assert.deepEqual(systemsOf([topOf5], CLOSE), [5]);
  assert.deepEqual(placesOf([topOf5], CLOSE), [{ system: 5, stretches: [1] }]);
});

test("a box only in margins is on the systems whose crops it overlaps", () => {
  const below6 = { page: 1, box: { left: 0.2, right: 0.3, top: CLOSE[5].layout.box.bottom + 0.005, bottom: CLOSE[5].layout.box.bottom + 0.015 } };
  assert.deepEqual(systemsOf([below6], CLOSE), [6]);
  // In the gap between systems 1 and 2, which both crops cover.
  assert.deepEqual(systemsOf([{ page: 1, box: { left: 0.2, right: 0.3, top: 0.162, bottom: 0.168 } }], CLOSE), [1, 2]);
  assert.deepEqual(systemsOf([{ page: 1, box: { left: 0.2, right: 0.3, top: 0.99, bottom: 1 } }], CLOSE), []);
});

test("a clarification on systems 5 and 6 near their edges is valid (B4)", () => {
  assert.deepEqual(boxProblems([topOf5, bottomOf6], CLOSE), { problem: null, bad: [] });
});

test("an issue on systems 5 and 6 near their edges is applied in a call at system 5 with the window [5, 6] (B4)", () => {
  const issue: StoredIssue = {
    id: 1,
    source: "review",
    class: "reading",
    boxes: [topOf5, bottomOf6],
    location: null,
    question: "Is it a D?",
    answers: [
      { key: "a", text: "A D" },
      { key: "b", text: "An E" },
    ],
    choices: [{ by: "review", key: "b", reason: null }],
    applied: "a",
    resolved: false,
    lilypond: null,
  };
  assert.deepEqual(applyCalls([issue], CLOSE), [{ system: 5, window: [5, 6], issues: [1] }]);
});
