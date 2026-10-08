import { test } from "node:test";
import assert from "node:assert/strict";
import { createImage } from "./image.ts";
import { rotate } from "./rotate.ts";
import { findSkew } from "./skew.ts";
import { drawLine, fillRect, musicPage } from "./testPages.ts";

const paper = [250, 247, 238] as [number, number, number];
const TOLERANCE = 0.05; // degrees

function assertNear(actual: number, expected: number, what: string) {
  assert.ok(Math.abs(actual - expected) <= TOLERANCE, `${what}: found ${actual}°, expected ${expected}°`);
}

test("finds the skew of a page, either way", () => {
  const page = musicPage();
  for (const angle of [-3.2, -0.5, 0, 0.35, 2.7]) {
    const skew = findSkew(rotate(page, angle, paper));
    assertNear(skew.angle, angle, `rotated by ${angle}°`);
    assert.ok(skew.confidence > 0.5, `confidence ${skew.confidence}`);
  }
});

test("faded ink on dark, noisy paper", () => {
  const page = musicPage(1200, 1600, { paper: [215, 200, 165], ink: [180, 168, 140], noise: 8, seed: 7 });
  assertNear(findSkew(rotate(page, 1.3, [215, 200, 165])).angle, 1.3, "faded");
});

test("long hairpins and slurs at other angles don't pull the angle away", () => {
  const page = musicPage();
  for (let i = 0; i < 6; i++) {
    const y = 250 + i * 220;
    drawLine(page, 150, y, 1050, y - 60, 2, [20, 20, 20]); // about -3.8°
    drawLine(page, 150, y + 40, 1050, y + 40 + 95, 2, [20, 20, 20]); // about 6°
  }
  assertNear(findSkew(rotate(page, -0.8, paper)).angle, -0.8, "with hairpins");
});

test("scanner borders and a crooked page edge are ignored", () => {
  const scan = rotate(musicPage(), 0.6, paper);
  fillRect(scan, 0, 0, 70, scan.height, [10, 10, 10]); // a black border at the left
  fillRect(scan, 0, scan.height - 50, scan.width, 50, [10, 10, 10]); // and at the bottom
  // The page's top edge, at another angle, with the dark scanner lid above it.
  for (let x = 0; x < scan.width; x++) {
    fillRect(scan, x, 0, 1, 30 + Math.round(x * 0.05), [30, 30, 30]);
  }
  assertNear(findSkew(scan).angle, 0.6, "with borders");
});

test("a large scan is measured just as well", () => {
  const page = musicPage(3600, 4800, { seed: 3 });
  assertNear(findSkew(rotate(page, -1.1, paper)).angle, -1.1, "large");
});

test("an empty page has no skew and no confidence", () => {
  assert.deepEqual(findSkew(createImage(800, 1000, paper)), { angle: 0, confidence: 0 });
});

test("angles beyond the search range aren't found", () => {
  const skew = findSkew(rotate(musicPage(), 2.5, paper), { maxAngle: 1 });
  assert.ok(Math.abs(skew.angle) <= 1);
});
