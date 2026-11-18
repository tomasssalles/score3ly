// Snapshots of what the stages compute from boxes and bar lines, taken before the code review's batch 22 moved the box
// geometry into @score3ly/core (review/plan.md, "What guards requests"): the crops' recipe boxes (rounded to 6 digits,
// part of every image's key), the marked crops' boxes, issue boxes on the pages, which systems and stretches boxes are
// on, the layouts and lines the editors store (5 digits), `layout`'s checked answers, and the MEI's facsimile zones.
// The same inputs must give the same numbers, or requests and stored outputs change. Only a change that means to change
// them (the paid release) may update them.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { buildMei, buildScore, serialize } from "@score3ly/notation";
import { richScore } from "@score3ly/notation/testScore";
import { checkLayoutAnswer } from "@score3ly/prompts";
import { onPage, stretchBox, stretchCropBoxes, systemCropBox, type StoredExtraction } from "./extract.ts";
import { addBarLine, boxThrough, moveBarLine, resizeBox, systemAt, withinBox, BOX_HANDLES } from "./fixLayout.ts";
import { lineThrough } from "./fixSkew.ts";
import { checkReview, placesOf, type PlacedSystem, type ReviewContext } from "./review.ts";
import { boxesOnCrop, homeOf, shownSystem, type Note } from "./transcription.ts";

const json = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);

// Two pages: the first with four systems, close together (their crops overlap), unevenly spaced bar lines, one bar
// line just outside its box (as `layout` accepts within its tolerance) and one exactly on its edge; the second with a
// short last system without bar lines.
const LAYOUTS = [
  { box: { left: 0.0812, right: 0.9234, top: 0.0915, bottom: 0.2047 }, barLines: [0.30251, 0.52, 0.71377] },
  { box: { left: 0.0798, right: 0.9241, top: 0.2433, bottom: 0.3561 }, barLines: [0.25, 0.5, 0.75, 0.9312] },
  { box: { left: 0.1003, right: 0.9011, top: 0.3958, bottom: 0.5103 }, barLines: [0.1003, 0.33333, 0.66667] },
  { box: { left: 0.0801, right: 0.6127, top: 0.5502, bottom: 0.6629 }, barLines: [0.33] },
  { box: { left: 0.082, right: 0.477, top: 0.11, bottom: 0.232 }, barLines: [] },
];
const PLACED: PlacedSystem[] = LAYOUTS.map((layout, i) => ({ number: i + 1, page: i < 4 ? 1 : 2, layout }));

const extraction = (s: PlacedSystem): StoredExtraction => ({
  system: s.number,
  page: s.page,
  answer: { startRepeat: false, staves: [], groups: [], stretches: [], lastMeasureContinues: false, issues: [] },
  issues: [],
  warnings: [],
});
const SHOWN = PLACED.map((s) => shownSystem(extraction(s), s.layout));

// Boxes of issues on the pages: inside a system, near a system's top (in its neighbour's crop), across two systems,
// over a bar line, in the margin between systems, on page 2, and one off every system.
const BOXES = [
  { page: 1, box: { left: 0.31, right: 0.4, top: 0.1, bottom: 0.19 } },
  { page: 1, box: { left: 0.6, right: 0.72, top: 0.2448, bottom: 0.27 } },
  { page: 1, box: { left: 0.7, right: 0.92, top: 0.18, bottom: 0.27 } },
  { page: 1, box: { left: 0.49, right: 0.53, top: 0.4, bottom: 0.5 } },
  { page: 1, box: { left: 0.2, right: 0.3, top: 0.215, bottom: 0.235 } },
  { page: 2, box: { left: 0.1, right: 0.2, top: 0.12, bottom: 0.2 } },
  { page: 1, box: { left: 0.1, right: 0.2, top: 0.9, bottom: 0.95 } },
];
const note = (k: number): Note => ({ key: `w${k}`, boxes: [BOXES[k]], kind: "warning", warning: { message: "m", boxes: [BOXES[k]] } });
const NOTES = BOXES.map((_, k) => note(k));

// Boxes on images cut from the page (an answer's issue boxes): the whole image, a corner, a sliver.
const ON_IMAGE = [
  { left: 0, right: 1, top: 0, bottom: 1 },
  { left: 0.12345, right: 0.45678, top: 0.3, bottom: 0.71 },
  { left: 0.9, right: 0.99, top: 0.01, bottom: 0.04 },
];

function snapshots(): Record<string, string> {
  const crops = PLACED.map((s) => systemCropBox(s.layout));
  const stretchCrops = PLACED.map((s) => stretchCropBoxes(s.layout));
  const stretches = PLACED.map((s) => Array.from({ length: s.layout.barLines.length + 3 }, (_, k) => stretchBox(s.layout, k)));
  const onPages = [...crops, ...stretchCrops.flat()].flatMap((c) => ON_IMAGE.map((b) => onPage(c, b)));

  // A review's answer for system 2 with new issues on the system's crop, a stretch's crop and the previous system's.
  const images = new Map([
    ["system", { page: 1, box: crops[1], system: 2 }],
    ["stretch 2", { page: 1, box: stretchCrops[1][1], system: 2 }],
    ["previous system", { page: 1, box: crops[0], system: 1 }],
  ]);
  const ctx: ReviewContext = { system: 2, issues: new Map(), systems: PLACED, images };
  const newIssue = (boxes: { image: string; box: (typeof ON_IMAGE)[number] }[]) => ({
    newIssue: { boxes, location: null, question: "Is this a D or an E?", answers: [{ key: "a", text: "A D" }, { key: "b", text: "An E" }], applied: "a", chosen: "b", reason: null, class: "reading", lilypond: null },
  });
  const review = checkReview(
    { entries: [newIssue([{ image: "system", box: ON_IMAGE[1] }]), newIssue([{ image: "stretch 2", box: ON_IMAGE[2] }, { image: "previous system", box: ON_IMAGE[1] }])] },
    ctx,
    1,
  );
  const badReview = [
    { left: 0.5, right: 0.5, top: 0.1, bottom: 0.2 },
    { left: -0.1, right: 0.5, top: 0.1, bottom: 0.2 },
    { left: 0.1, right: 0.5, top: 0.3, bottom: 0.2 },
  ].map((box) => checkReview({ entries: [newIssue([{ image: "system", box }])] }, ctx, 1));

  // `layout`'s answers: as models give them (unsorted bar lines, one just outside its box), and refused ones.
  const flat = (layout: (typeof LAYOUTS)[number]) => ({ ...layout.box, barLines: [...layout.barLines].reverse() });
  const answer = (systems: unknown[]) => ({ severelySkewed: false, systems, satisfied: true, note: "" });
  const layoutAnswers = [
    answer(LAYOUTS.map(flat)),
    answer([{ ...flat(LAYOUTS[0]), barLines: [0.0612, 0.5, 0.94] }]),
    answer([{ ...flat(LAYOUTS[0]), barLines: [0.95] }]),
    answer([{ ...flat(LAYOUTS[0]), right: 1.01 }]),
    answer([{ ...flat(LAYOUTS[0]), left: 0.95 }]),
    answer([{ ...flat(LAYOUTS[0]), top: 0.3 }]),
    answer([{ ...flat(LAYOUTS[0]), bottom: "0.3" }]),
  ].map(checkLayoutAnswer);

  // The editors: boxes drawn and resized, bar lines added and moved (inside, past the box's ends), lines drawn.
  const p = (x: number, y: number) => ({ x, y });
  const system = LAYOUTS[1];
  const editors = {
    drawn: [boxThrough(p(0.123456, 0.654321), p(0.0333333, 0.111111)), boxThrough(p(-0.1, 1.2), p(0.5, 0.5)), boxThrough(p(0.1, 0.1), p(0.105, 0.5))],
    resized: BOX_HANDLES.flatMap((h) => [resizeBox(system.box, h, p(0.0123456, 0.987654)), resizeBox(system.box, h, p(0.5000049, 0.3000051)), resizeBox(system.box, h, p(-1, 2))]),
    added: [0.4444444, 0.01, 0.99, 0.5].map((x) => addBarLine(system, x)),
    moved: [0.6666666, 0.01, 0.99].map((x) => moveBarLine(system, 1, x)),
    within: [withinBox({ ...system, box: { ...system.box, right: 0.74 } }), withinBox(system)],
    at: [systemAt(LAYOUTS, p(0.5, 0.3), null), systemAt(LAYOUTS, p(0.5, 0.3), 1), systemAt(LAYOUTS, p(0.95, 0.95), null)],
    lines: [
      lineThrough(p(101.3, 220.7), p(1105.9, 241.2), 1200, 1600),
      lineThrough(p(-50, 300), p(1300, 290), 1200, 1600),
      lineThrough(p(600, 10), p(1150, -40), 1200, 1600),
      lineThrough(p(5, 5), p(5.0001, 1500), 1200, 1600),
    ],
  };

  // The rich score on these layouts: the MEI's facsimile zones come from the stretches' edges.
  const rich = richScore().map((s, i) => ({ ...s, box: LAYOUTS[i].box, barLines: LAYOUTS[i].barLines.slice(0, s.barLines.length) }));
  const mei = serialize(buildMei(buildScore(rich, [1, 4])));

  return {
    "system crops": json(crops),
    "stretch crops": json(stretchCrops),
    "stretch boxes": json(stretches),
    "on the page": json(onPages),
    "boxes on crops": json(crops.map((c, i) => boxesOnCrop(NOTES, PLACED[i].page, c).map((b) => [b.note.key, b.k, b.box]))),
    "boxes on stretch crops": json(stretchCrops.flatMap((list, i) => list.map((c) => boxesOnCrop(NOTES, PLACED[i].page, c).map((b) => [b.note.key, b.box])))),
    homes: json(NOTES.map((n) => homeOf(n, SHOWN))),
    places: json(BOXES.map((b) => placesOf([b], PLACED))),
    "places together": json([placesOf(BOXES.slice(0, 3), PLACED), placesOf(BOXES, PLACED)]),
    "review's new issues": json(review),
    "review's refused boxes": json(badReview),
    "layout answers": json(layoutAnswers),
    editors: json(editors),
    mei: json(mei),
  };
}

test("what the stages compute from boxes is what it was", () => {
  assert.deepEqual(snapshots(), {
    "boxes on crops": "db89ac8275790fe7",
    "boxes on stretch crops": "dbdde3901adcb9f7",
    "layout answers": "400c0a2e5c166ed5",
    "on the page": "a9eb8ebecbb2bdc0",
    "places together": "29f3bbfe21922f65",
    "review's new issues": "01083fe22688a598",
    "review's refused boxes": "38ec01401b61d032",
    "stretch boxes": "86282c6b726732f5",
    "stretch crops": "a0d6a9ded21383b3",
    "system crops": "5c223c245e64c47d",
    editors: "79d2195f76a19ce2",
    homes: "001be09e74238698",
    mei: "adb303b3a0df85e8",
    places: "4ee24c86683ee919",
  });
});
