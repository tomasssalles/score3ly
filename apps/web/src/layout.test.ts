import { test } from "node:test";
import assert from "node:assert/strict";
import { keyOf } from "@score3ly/core";
import { LAYOUT_ROUNDS } from "@score3ly/prompts";
import { firstNumbers, LAYOUT_VERSION, layoutStageKey, numberSystems } from "./layout.ts";

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

// B9 (code review): the number of rounds is in the stage's key, so a stage run with other rounds isn't reused.
test("layout's stage key holds the number of rounds", async () => {
  const input = {
    promptVersion: 4,
    model: { provider: "anthropic", model: "claude-opus-5-5", effort: "high" },
    imageRecipe: { limit: { maxLongEdge: 2576, maxPixels: 3_750_000 }, scale: 1, deskew: 1, rotate: 1, draw: 2 },
    pages: [{ pageImageKey: "a".repeat(64), linesSha256: null }],
  };
  assert.equal(
    await layoutStageKey({ config: { modelConfigId: "c" }, ...input }),
    await keyOf({ step: "layout", version: LAYOUT_VERSION, ...input, rounds: LAYOUT_ROUNDS }),
  );
});
