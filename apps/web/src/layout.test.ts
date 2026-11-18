import { test } from "node:test";
import assert from "node:assert/strict";
import { firstNumbers, numberSystems } from "./layout.ts";

const system = (top: number) => ({ box: { left: 0.1, right: 0.9, top, bottom: top + 0.2 }, barLines: [0.5] });

test("systems are numbered top to bottom, continuing from page to page in the pages' order", () => {
  const pages = [
    { page: 3, systems: [system(0.1)] },
    { page: 1, systems: [system(0.1), system(0.5)] },
    { page: 2, systems: [] },
  ];
  assert.deepEqual(
    numberSystems(pages).map((s) => [s.number, s.page, s.item, s.pageIndex]),
    [
      [1, 1, "p1/s1", 1],
      [2, 1, "p1/s2", 1],
      [3, 3, "p3/s1", 0],
    ],
  );
  assert.equal(numberSystems(pages)[1].layout, pages[1].systems[1]);
  // A page without systems: its first would be the next page's.
  assert.deepEqual(firstNumbers(pages), [3, 1, 3]);
});

test("a page whose layout isn't loaded counts no systems (the layout editor while loading)", () => {
  const pages = [
    { page: 1, systems: [system(0.1), system(0.5)] },
    { page: 2, systems: [] }, // not loaded
    { page: 3, systems: [system(0.1)] },
  ];
  assert.deepEqual(firstNumbers(pages), [1, 3, 3]);
  assert.deepEqual(numberSystems(pages).map((s) => s.number), [1, 2, 3]);
});

test("the numbers are firstNumbers' as it was: counts in order", () => {
  const counts = [0, 4, 5, 3];
  const pages = counts.map((n, i) => ({ page: i + 1, systems: Array.from({ length: n }, (_, j) => system(j / 10)) }));
  assert.deepEqual(firstNumbers(pages), [1, 1, 5, 10]);
});
