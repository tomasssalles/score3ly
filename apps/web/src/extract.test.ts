import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMei, buildScore, checkSystem, elements, pieceStart } from "@score3ly/notation";
import { richScore } from "@score3ly/notation/testScore";
import { extractImageLabels } from "@score3ly/prompts";
import { extractNote, pieceBounds, scoreInput, storedExtraction } from "./extract.ts";
import { stretchBox, stretchCropBoxes, systemCropBox } from "./crops.ts";
import { linkSpans, placeFor, systemHints } from "./linking.ts";
import type { StoredObservations, StoredPage } from "./analyze.ts";

const system = { box: { left: 0.1, right: 0.9, top: 0.2, bottom: 0.4 }, barLines: [0.3, 0.5, 0.7] };

test("the system's crop has margins, within the page", () => {
  const box = systemCropBox(system);
  assert.deepEqual(box, { left: 0.09, right: 0.91, top: 0.17, bottom: 0.43 });
  const edge = systemCropBox({ box: { left: 0, right: 1, top: 0, bottom: 0.1 }, barLines: [] });
  assert.deepEqual(edge, { left: 0, right: 1, top: 0, bottom: 0.115 });
});

test("each stretch's crop reaches half into its neighbours", () => {
  const boxes = stretchCropBoxes(system);
  assert.equal(boxes.length, 4);
  assert.deepEqual(boxes.map((b) => [b.left, b.right]), [
    [0.09, 0.4],
    [0.2, 0.6],
    [0.4, 0.8],
    [0.6, 0.91],
  ]);
  assert.deepEqual(stretchBox(system, 2), { left: 0.3, right: 0.5, top: 0.2, bottom: 0.4 });
});

test("the MEI's zones and the stretch boxes issues point at have the same edges (core's stretchEdges)", () => {
  const input = richScore();
  const zones = [...elements(buildMei(buildScore(input, [1, 4])))].filter((e) => e.name === "zone");
  assert.ok(zones.length > 0);
  for (const zone of zones) {
    const attr = (name: string) => zone.attrs.find(([k]) => k === name)?.[1];
    const [, system, first, last] = /^z(\d+)t(\d+)-(\d+)$/.exec(String(attr("xml:id")))!.map(Number);
    const layout = { box: input[system - 1].box!, barLines: input[system - 1].barLines };
    assert.equal(Number(attr("ulx")), Math.round(stretchBox(layout, first).left * 10000), String(attr("xml:id")));
    assert.equal(Number(attr("lrx")), Math.round(stretchBox(layout, last).right * 10000), String(attr("xml:id")));
  }
});

test("pieces: a system begins or ends one", () => {
  assert.deepEqual(pieceBounds([1, 5], 1, 8), { first: true, last: false });
  assert.deepEqual(pieceBounds([1, 5], 4, 8), { first: false, last: true });
  assert.deepEqual(pieceBounds([1, 5], 8, 8), { first: false, last: true });
});

test("the images' labels, which issue boxes name", () => {
  assert.deepEqual(extractImageLabels(2, true, false), ["system", "stretch 1", "stretch 2", "previous system"]);
});

test("stored: the model's issue boxes on the pages, code's issues and warnings on their stretches, numbered", () => {
  const answer = {
    startRepeat: false,
    staves: [{ staff: 1, description: "voice", label: null, clef: "treble", key: "0", time: "4/4" }],
    groups: [],
    stretches: [
      { stretch: 1, class: "new", kind: "normal", printedNumber: null, measureNumber: null, changes: [], ending: null, voices: [{ voice: 1, staff: 1, description: "melody", music: "c''2 d''2" }], rightBarLine: "single" },
      { stretch: 2, class: "new", kind: "normal", printedNumber: null, measureNumber: null, changes: [], ending: null, voices: [{ voice: 1, staff: 1, description: null, music: "e''2" }], rightBarLine: "final" },
    ],
    lastMeasureContinues: false,
    issues: [
      {
        boxes: [{ image: "stretch 1", box: { left: 0, right: 0.5, top: 0, bottom: 1 } }],
        location: null,
        question: "staccato or smudge?",
        answers: [
          { key: "a", text: "staccato" },
          { key: "b", text: "smudge" },
        ],
        applied: "b",
        class: "reading",
        lilypond: null,
      },
    ],
  };
  const layout = { box: { left: 0.1, right: 0.9, top: 0.2, bottom: 0.4 }, barLines: [0.5] };
  const checked = checkSystem(answer, { system: 1, stretches: 2, firstOfPiece: true, images: extractImageLabels(2, false, true) }, pieceStart());
  if ("problem" in checked) assert.fail(checked.problem);
  const crops = stretchCropBoxes(layout);
  const sources = new Map([["stretch 1", { page: 3, box: crops[0] }]]);
  const stored = storedExtraction({ number: 1, page: 3, item: "p3/s1", layout }, checked, sources, (p) => ({ page: 3, box: stretchBox(layout, p.stretch) }), 7);
  assert.equal(stored.issues.length, 1);
  assert.equal(stored.issues[0].id, 7);
  assert.deepEqual(stored.issues[0].choices, [{ by: "extract", key: "b", reason: null }]);
  assert.equal(stored.issues[0].boxes[0].page, 3);
  assert.ok(Math.abs(stored.issues[0].boxes[0].box.left - crops[0].left) < 1e-9);
  assert.equal(stored.warnings.length, 1); // stretch 2 lasts a half note in 4/4
  assert.deepEqual(stored.warnings[0].boxes, [{ page: 3, box: stretchBox(layout, 2) }]);
  assert.equal(extractNote(2, 1, 1), "2 systems · 1 issue · 1 warning");
});

// Two pages: an ottava open at the end of page 1 continues on page 2, an ending on page 2 only.
function observations(): StoredObservations {
  const empty = { systems: [], changes: [], ottavas: [], specialBarLines: [], endings: [], directions: [], notes: [] };
  const page1: StoredPage = {
    page: 1,
    ...empty,
    systems: [{ id: "p1-1", system: 2, staves: 2, instruments: ["piano right hand", "piano left hand"], confidence: "high" }],
    ottavas: [{ id: "p1-2", text: "8va", staff: { number: 1, of: 2 }, start: { system: 2, at: "stretch", number: 3 }, end: null, confidence: "high" }],
    specialBarLines: [{ id: "p1-3", kind: "endRepeat", place: { system: 2, at: "barLine", number: 2 }, confidence: "medium", confirmed: true }],
  };
  const page2: StoredPage = {
    page: 2,
    ...empty,
    ottavas: [{ id: "p2-1", text: "8va", staff: { number: 1, of: 2 }, start: null, end: { system: 4, at: "barLine", number: 1 }, confidence: "low" }],
    notes: [{ id: "p2-2", text: "cross-staff writing", confidence: "medium" }],
  };
  return { pages: [page1, page2], score: { instrumentation: [], style: [], form: [], recurringMaterial: [], notesForTranscription: [] } };
}

const systemsOf = (page: number) => (page === 1 ? [1, 2] : [3, 4]);

test("spans open at a page's edge are linked to their other part, as certain as the weakest", () => {
  const spans = linkSpans(observations(), systemsOf, []);
  assert.equal(spans.length, 1);
  assert.deepEqual([spans[0].from, spans[0].to, spans[0].state], [2, 4, "low"]);
});

// Code review D19: nothing carries over a piece's boundary, so a span doesn't either.
test("a span stops at a piece's start: not linked across it, and cut there", () => {
  // A piece starts at system 3, page 2's first: the ottava open at page 1's end ends with system 2, and page 2's
  // starts with system 3.
  const spans = linkSpans(observations(), systemsOf, [1, 3]);
  assert.deepEqual(
    spans.map((s) => [s.from, s.to, s.start, s.end, s.state]),
    [
      [2, 2, { system: 2, at: "stretch", number: 3 }, { system: 2, at: "end", number: 0 }, "high"],
      [3, 4, { system: 3, at: "start", number: 0 }, { system: 4, at: "barLine", number: 1 }, "low"],
    ],
  );
  // A piece starting inside a page cuts a span across it where the piece starts: the ottava, linked over the page
  // break, ends with system 3.
  const inside = linkSpans(observations(), systemsOf, [1, 4]);
  assert.deepEqual(
    inside.map((s) => [s.from, s.to, s.start, s.end]),
    [[2, 3, { system: 2, at: "stretch", number: 3 }, { system: 3, at: "end", number: 0 }]],
  );
  // With one piece, as before.
  assert.deepEqual(linkSpans(observations(), systemsOf, [1]), linkSpans(observations(), systemsOf, []));
});

test("a system's hints: its staves, what is on it, the spans in effect, its page's notes", () => {
  const o = observations();
  const spans = linkSpans(o, systemsOf, []);
  const two = systemHints(o, spans, 2, 1);
  assert.deepEqual(two.staves, { count: 2, instruments: ["piano right hand", "piano left hand"], state: "high" });
  assert.deepEqual(two.onThisSystem, [{ what: "special bar line", text: "endRepeat", place: "the bar line at the right of stretch 2", staff: null, state: "confirmed" }]);
  assert.deepEqual(two.spans[0].from, "stretch 3");
  const three = systemHints(o, spans, 3, 2);
  assert.deepEqual(three.spans, [{ what: "ottava", text: "8va", staff: "staff 1/2", from: "system 2, stretch 3", to: "system 4, bar line 1", state: "low" }]);
  assert.deepEqual(three.pageNotes, [{ text: "cross-staff writing", state: "medium" }]);
  assert.equal(placeFor(3, null, "after"), "after the pages seen");
});

test("scoreInput: a system as notation builds the score from it, without a layout no box and no bar lines", () => {
  const answer = { staves: [] } as unknown as Parameters<typeof scoreInput>[1];
  const layout = { box: { left: 0.1, right: 0.9, top: 0.2, bottom: 0.4 }, barLines: [0.5] };
  assert.deepEqual(scoreInput({ number: 3, page: 2, layout }, answer), { number: 3, page: 2, box: layout.box, barLines: [0.5], answer });
  assert.deepEqual(scoreInput({ number: 3, page: 2 }, answer), { number: 3, page: 2, box: null, barLines: [], answer });
});
