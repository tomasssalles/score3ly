import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addBarLine,
  fixedLayout,
  moveBarLine,
  sortSystems,
  systemAt,
  systemsChanged,
  withinBox,
} from "./fixLayout.ts";

const box = (left: number, top: number, right: number, bottom: number) => ({ left, right, top, bottom });
const system = (b: ReturnType<typeof box>, barLines: number[] = []) => ({ box: b, barLines });

test("systems are numbered top to bottom", () => {
  const sorted = sortSystems([system(box(0.1, 0.5, 0.9, 0.7)), system(box(0.1, 0.1, 0.9, 0.3))]);
  assert.deepEqual(sorted.map((s) => s.box.top), [0.1, 0.5]);
});

test("bar lines stay within their box, sorted", () => {
  const s = system(box(0.1, 0.1, 0.9, 0.3), [0.3, 0.6]);
  assert.deepEqual(addBarLine(s, 0.45), { system: { ...s, barLines: [0.3, 0.45, 0.6] }, index: 1 });
  assert.deepEqual(addBarLine(s, 0.95).system.barLines, [0.3, 0.6, 0.9]);
  assert.deepEqual(moveBarLine(s, 0, 0.7), { system: { ...s, barLines: [0.6, 0.7] }, index: 1 });
  assert.deepEqual(withinBox({ ...s, box: box(0.1, 0.1, 0.5, 0.3) }).barLines, [0.3]);
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
});

