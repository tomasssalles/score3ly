import { test } from "node:test";
import assert from "node:assert/strict";
import { createImage } from "./image.ts";
import { rotate } from "./rotate.ts";
import { findSkew, shouldDeskew, type Skew } from "./skew.ts";
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
  assert.deepEqual(findSkew(createImage(800, 1000, paper)), { angle: 0, confidence: 0, atLimit: false, staves: [] });
});

test("angles beyond the search range aren't found, and the result says it is at the limit", () => {
  const skew = findSkew(rotate(musicPage(), 2.5, paper), { maxAngle: 1 });
  assert.ok(Math.abs(skew.angle) <= 1);
  assert.equal(skew.atLimit, true);
  assert.equal(findSkew(rotate(musicPage(), 0.5, paper)).atLimit, false);
});

// musicPage draws 8 staves, the first at 10% of the height, one every 10.5%, each 4 spacings of height/115 tall.
test("the staves are found where they are, at any skew", () => {
  for (const angle of [0, -1.5, 3]) {
    const { staves } = findSkew(rotate(musicPage(), angle, paper));
    assert.equal(staves.length, 8, `at ${angle}°`);
    staves.forEach((staff, i) => {
      const top = (Math.round(1600 * 0.1 + i * 1600 * 0.105) + 1) / 1600; // the middle of the 2-pixel line
      assert.ok(Math.abs(staff.top - top) < 0.003, `staff ${i} at ${angle}°: top ${staff.top}, expected ${top}`);
      assert.ok(Math.abs(staff.bottom - staff.top - (4 * 14) / 1600) < 0.003);
    });
  }
});

test("staves in faded ink on dark, noisy paper are found too", () => {
  const page = musicPage(1200, 1600, { paper: [215, 200, 165], ink: [180, 168, 140], noise: 8, seed: 7 });
  assert.equal(findSkew(rotate(page, 1.3, [215, 200, 165])).staves.length, 8);
});

test("evenly spaced lines that don't start and end together aren't a staff", () => {
  const page = createImage(1200, 1600, paper);
  // Hatching: groups of five evenly spaced lines, each line shifted sideways, as in an engraving.
  for (let group = 0; group < 6; group++) {
    for (let line = 0; line < 5; line++) {
      fillRect(page, 100 + line * 120, 200 + group * 220 + line * 14, 560, 2, [20, 20, 20]);
    }
  }
  assert.deepEqual(findSkew(page).staves, []);
});

test("a page is deskewed only with staves, at a trustworthy angle, large enough to matter", () => {
  const staves = [{ top: 0.1, bottom: 0.12 }];
  const skew = (angle: number, more: Partial<Skew> = {}): Skew => ({
    angle,
    confidence: 0.7,
    atLimit: false,
    staves,
    ...more,
  });
  assert.equal(shouldDeskew(skew(0.4), 2500).deskew, true);
  assert.match(shouldDeskew(skew(0.4, { staves: [] }), 2500).reason, /no staves/);
  assert.match(shouldDeskew(skew(4.95, { atLimit: true }), 2500).reason, /limit/);
  assert.match(shouldDeskew(skew(0.01), 2500).reason, /too small/); // 0.4 px across the page
  assert.equal(shouldDeskew(skew(0.03), 2500).deskew, true); // 1.3 px
});
