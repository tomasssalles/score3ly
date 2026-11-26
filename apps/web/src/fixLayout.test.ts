import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addBarLine,
  fixedLayout,
  moveBarLine,
  sortSystems,
  systemAt,
  systemsChanged,
  settledBarLine,
  withinBox,
} from "./fixLayout.ts";
import { MIN_BAR_LINE_GAP } from "@score3ly/core";

const box = (left: number, top: number, right: number, bottom: number) => ({ left, right, top, bottom });
const system = (b: ReturnType<typeof box>, barLines: number[] = []) => ({ box: b, barLines });

test("systems are numbered top to bottom", () => {
  const sorted = sortSystems([system(box(0.1, 0.5, 0.9, 0.7)), system(box(0.1, 0.1, 0.9, 0.3))]);
  assert.deepEqual(sorted.map((s) => s.box.top), [0.1, 0.5]);
});

test("bar lines stay within their box, sorted", () => {
  const s = system(box(0.1, 0.1, 0.9, 0.3), [0.3, 0.6]);
  assert.deepEqual(addBarLine(s, 0.45), { system: { ...s, barLines: [0.3, 0.45, 0.6] }, index: 1 });
  assert.deepEqual(addBarLine(s, 0.95).system.barLines, [0.3, 0.6, 0.895]);
  assert.deepEqual(moveBarLine(s, 0, 0.7), { system: { ...s, barLines: [0.6, 0.7] }, index: 1 });
  assert.deepEqual(withinBox({ ...s, box: box(0.1, 0.1, 0.5, 0.3) }).barLines, [0.3]);
});

test("a bar line is never at the box's sides or at another's place (code review B3)", () => {
  const s = system(box(0.1, 0.1, 0.9, 0.3), [0.3, 0.6]);
  const gap = MIN_BAR_LINE_GAP;
  // A tap at the box's end or past it puts the line inside, the gap away from the side.
  assert.deepEqual(addBarLine(s, 0.9).system.barLines, [0.3, 0.6, 0.895]);
  assert.deepEqual(addBarLine(s, 0.95).system.barLines, [0.3, 0.6, 0.895]);
  assert.deepEqual(addBarLine(s, 0.1).system.barLines, [0.105, 0.3, 0.6]);
  // A tap on a line (or closer than the gap) selects it, adding nothing.
  assert.deepEqual(addBarLine(s, 0.6), { system: s, index: 1 });
  assert.deepEqual(addBarLine(s, 0.302), { system: s, index: 0 });
  // A box too narrow for a line takes none.
  const narrow = system(box(0.1, 0.1, 0.1 + gap, 0.3));
  assert.deepEqual(addBarLine(narrow, 0.1 + gap / 2), { system: narrow, index: null });
  // A move stays the gap inside the box; dropped where another line is, the two are one.
  assert.deepEqual(moveBarLine(s, 1, 0.95).system.barLines, [0.3, 0.895]);
  assert.deepEqual(settledBarLine(moveBarLine(s, 1, 0.3).system, 0.3), { system: { ...s, barLines: [0.3] }, index: 0 });
  assert.deepEqual(settledBarLine(moveBarLine(s, 1, 0.5).system, 0.5), { system: { ...s, barLines: [0.3, 0.5] }, index: 1 });
  // A box made smaller drops the lines it no longer covers, and those now at its sides.
  assert.deepEqual(withinBox({ ...s, box: box(0.1, 0.1, 0.6, 0.3) }).barLines, [0.3]);
  assert.equal(withinBox(s), s, "unchanged: the same system");
});

test("tapping where boxes overlap goes through them", () => {
  const systems = [system(box(0.1, 0.1, 0.9, 0.4)), system(box(0.1, 0.3, 0.9, 0.6))];
  const p = { x: 0.5, y: 0.35 };
  assert.equal(systemAt(systems, p, null), 0);
  assert.equal(systemAt(systems, p, 0), 1);
  assert.equal(systemAt(systems, p, 1), 0);
  assert.equal(systemAt(systems, { x: 0.5, y: 0.2 }, 1), 0);
  assert.equal(systemAt(systems, { x: 0.5, y: 0.8 }, 0), null);
});

test("fix_layout's output is sorted and not flagged; only the systems count as a change", () => {
  const layout = {
    angle: 0.3,
    severelySkewed: false,
    systems: [system(box(0.1, 0.5, 0.9, 0.7)), system(box(0.1, 0.1, 0.9, 0.3))],
    flagged: true,
    note: "unsure",
    rounds: 3,
  };
  const fixed = fixedLayout(layout);
  assert.equal(fixed.flagged, false);
  assert.deepEqual(fixed.systems.map((s) => s.box.top), [0.1, 0.5]);
  assert.equal(systemsChanged(layout.systems, fixed.systems), false);
  assert.equal(systemsChanged(layout.systems, fixed.systems.slice(1)), true);
  // The same systems with their keys in another order (e.g. read from elsewhere) haven't changed.
  const reordered = fixed.systems.map(({ box: { left, right, top, bottom }, barLines }) => ({ barLines, box: { bottom, top, right, left } }));
  assert.equal(systemsChanged(layout.systems, reordered), false);
});

