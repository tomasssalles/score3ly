import { test } from "node:test";
import assert from "node:assert/strict";
import { keyOf } from "@score3ly/core";
import { FIND_SKEW_VERSION } from "@score3ly/imaging";
import { angleLabel, skewConfigError, skewConfigOf, skewNote, skewStageKey } from "./skewAnalysis.ts";

test("the maximum angle defaults to 5° and is checked", () => {
  assert.deepEqual(skewConfigOf(null), { maxAngle: 5 });
  assert.deepEqual(skewConfigOf({ maxAngle: 12 }), { maxAngle: 12 });
  assert.equal(skewConfigError({ maxAngle: 5 }), null);
  assert.equal(skewConfigError({ maxAngle: 12.5 }), null);
  assert.ok(skewConfigError({ maxAngle: 0.2 }));
  assert.ok(skewConfigError({ maxAngle: 60 }));
  assert.ok(skewConfigError({ maxAngle: 2.25 }));
  assert.ok(skewConfigError({ maxAngle: NaN }));
});

test("the stage key changes with the maximum angle and with the page images", async () => {
  const pages = ["a".repeat(64), "b".repeat(64)];
  const key = await skewStageKey({ maxAngle: 5 }, pages);
  assert.equal(key, await skewStageKey({ maxAngle: 5 }, [...pages]));
  assert.notEqual(key, await skewStageKey({ maxAngle: 10 }, pages));
  assert.notEqual(key, await skewStageKey({ maxAngle: 5 }, pages.slice(1)));
});

// B7, A14 (code review): a change of findSkew changes the stage's key, so a stage run by the old code isn't reused.
test("the stage key holds findSkew's version", async () => {
  const pages = ["a".repeat(64)];
  assert.equal(
    await skewStageKey({ maxAngle: 5 }, pages),
    await keyOf({ step: "skew_analysis", version: 1, findSkew: FIND_SKEW_VERSION, config: { maxAngle: 5 }, inputs: pages }),
  );
});

test("labels and the card's note", () => {
  assert.equal(angleLabel(0.4249), "+0.42°");
  assert.equal(angleLabel(-1.3), "−1.30°");
  assert.equal(angleLabel(0.001), "0.00°");
  assert.equal(skewNote(10, 12), "lines on 10 of 12 pages");
  assert.equal(skewNote(1, 1), "lines found");
  assert.equal(skewNote(0, 1), "no lines found");
  // Pages whose angle was at the limit of the search (dec. 8): said, since they have no lines for that reason.
  assert.equal(skewNote(9, 10, 1), "lines on 9 of 10 pages · 1 at the angle limit");
  assert.equal(skewNote(0, 1, 1), "no lines found · at the angle limit");
});
