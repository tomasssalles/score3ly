// Snapshots of what `analyze` stores, what its forms (`fix_metadata`, `fix_observations`) read, edit and store, what
// `extract` is told of the observations, and what the MEI's header takes from the metadata, taken before the code
// review's batch 30 moved analyze's rules into the prompts and the forms onto them (review/plan.md, "What guards
// requests"). Built from two real pages (Kinderscenen, first edition), besides `requestSnapshots.test.ts`, which
// holds analyze's requests. The same inputs must give the same bytes. Changed by the paid release (batch 34): the input's
// `startEndRepeat` renamed `bothRepeats` (D18c), the only change in what is stored and read; the hints linked within
// the pieces (D19: analyze's pieces, 1 and 4, cut nothing; the form's, at every system, cut its spans at each).

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { buildScore, meiString } from "@score3ly/notation";
import { richScore } from "@score3ly/notation/testScore";
import { checkScoreAnswer, firstPlace, flatMetadata, PLACE_KINDS, placeLabel, positionLabel, type AnalyzeContext, type PageMetadata, type PageObservations, type Place } from "@score3ly/prompts";
import { combineObservations, normalizeMetadata, pageItems, piecesOf, shownConfidence, type PageAnalysis } from "./analyze.ts";
import * as fixMetadata from "./fixMetadata.ts";
import * as fixObservations from "./fixObservations.ts";
import { linkSpans, systemHints } from "./linking.ts";
import { meiMetadata } from "./engrave.ts";

const hash = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 16);
const json = (value: unknown) => hash(JSON.stringify(value));

// --- The inputs: the pages as requestSnapshots.test.ts has them ---

const at = (system: number, at: "start" | "barLine" | "stretch" | "end", number = 0): Place => ({ system, at, number });
const pages: PageAnalysis[] = [
  {
    page: 1,
    systems: [1, 2],
    metadata: {
      titles: [
        { text: "Kinderscenen", type: "main", confidence: "high" },
        { text: "Leichte Stücke für das Pianoforte", type: "subtitle", confidence: "medium" },
      ],
      people: [{ name: "Robert Schumann", role: "composer", confidence: "high" }],
      pieces: [{ title: "Von fremden Ländern und Menschen", system: 1, confidence: "high" }],
      catalogueNumbers: [{ text: "Op. 15", confidence: "high" }],
      dedications: [],
      instrumentation: [],
      compositionDates: [],
      publishers: [{ text: "Breitkopf & Härtel", confidence: "high" }],
      places: [{ text: "Leipzig", confidence: "medium" }],
      dates: [],
      plateNumbers: [{ text: "5948", confidence: "low" }],
      notices: [],
    } satisfies PageMetadata,
    observations: {
      systems: [
        { system: 1, staves: 2, instruments: ["piano right hand", "piano left hand"], confidence: "high" },
        { system: 2, staves: 2, instruments: ["piano right hand", "piano left hand"], confidence: "high" },
      ],
      changes: [
        { kind: "key", text: "G major", place: at(1, "start"), staff: null, confidence: "high" },
        { kind: "time", text: "2/4", place: at(1, "start"), staff: null, confidence: "high" },
        { kind: "clef", text: "treble clef", place: at(1, "stretch", 2), staff: { number: 2, of: 2 }, confidence: "medium" },
        { kind: "tempo", text: "Langsam", place: at(1, "start"), staff: null, confidence: "high" },
      ],
      ottavas: [{ text: "8va", staff: { number: 1, of: 2 }, start: at(2, "stretch", 2), end: null, confidence: "medium" }],
      specialBarLines: [
        { kind: "endRepeat", place: at(2, "barLine", 3), confidence: "high" },
        { kind: "startRepeat", place: at(1, "start"), confidence: "high" },
      ],
      endings: [{ numbers: "1.", start: at(2, "barLine", 2), end: at(2, "barLine", 3), confidence: "high" }],
      directions: [{ text: "Fine", place: at(2, "end"), confidence: "low" }],
      notes: [{ text: "The melody is in the top voice of the right hand, with a second voice below it.", confidence: "medium" }],
    } satisfies PageObservations,
  },
  {
    page: 2,
    systems: [3, 4],
    metadata: {
      titles: [],
      people: [],
      pieces: [{ title: "Kuriose Geschichte", system: 4, confidence: "high" }],
      catalogueNumbers: [],
      dedications: [],
      instrumentation: [],
      compositionDates: [],
      publishers: [],
      places: [],
      dates: [],
      plateNumbers: [{ text: "5948", confidence: "high" }],
      notices: [{ text: "Eigenthum des Verlegers", confidence: "high" }],
    } satisfies PageMetadata,
    observations: {
      systems: [
        { system: 3, staves: 3, instruments: ["voice", "piano right hand", "piano left hand"], confidence: "medium" },
        { system: 4, staves: 2, instruments: ["piano right hand", "piano left hand"], confidence: "high" },
      ],
      changes: [{ kind: "key", text: "D major", place: at(4, "start"), staff: null, confidence: "high" }],
      ottavas: [{ text: "8va", staff: { number: 2, of: 3 }, start: null, end: at(3, "barLine", 1), confidence: "medium" }],
      specialBarLines: [{ kind: "bothRepeats", place: at(4, "barLine", 2), confidence: "medium" }],
      endings: [],
      directions: [{ text: "D.C. al Fine", place: at(4, "end"), confidence: "high" }],
      notes: [],
    } satisfies PageObservations,
  },
];
// The systems of the rich score: 1 and 2 on page 1, 3 and 4 on page 2, with their bar lines.
const input = richScore();
const scoreSystems: fixObservations.ScoreSystems = input.map((s) => ({ page: s.page, barLines: s.barLines.length }));
const context: AnalyzeContext = {
  systems: new Map(input.map((s) => [s.number, { barLines: s.barLines.length, page: s.page }])),
  pages: [1, 2],
  items: pageItems(pages),
};
const scoreAnswer = {
  metadata: flatMetadata({
    ...pages[0].metadata,
    titles: pages[0].metadata.titles.map((t) => ({ ...t, page: 1 })),
    people: [{ name: "Robert Schumann", role: "composer", confidence: "high", page: 1 }],
    pieces: [
      { title: "Von fremden Ländern und Menschen", system: 1, confidence: "high", page: 1 },
      { title: "Kuriose Geschichte", system: 4, confidence: "high", page: 2 },
    ],
    catalogueNumbers: [{ text: "Op. 15", confidence: "high", page: 1 }],
    publishers: [{ text: "Breitkopf & Härtel", confidence: "high", page: 1 }],
    places: [],
    plateNumbers: [{ text: "5948", confidence: "high", page: 2 }],
    notices: [{ text: "Eigenthum des Verlegers", confidence: "high", page: 2 }],
  } as never),
  edits: {
    systems: [{ id: "p2-1", page: 2, system: 3, staves: 3, instruments: ["voice", "piano right hand", "piano left hand"], confidence: "high" }],
    items: [
      { id: "p1-11", page: 1, kind: "finalBarLine", text: "", staff: null, start: at(2, "end"), end: null, confidence: "high" },
      { id: "", page: 2, kind: "note", text: "A third staff for the voice on system 3", staff: null, start: null, end: null, confidence: "medium" },
    ],
  },
  removals: ["p1-6"],
  score: [
    { kind: "style", text: "Romantic character pieces", places: [], confidence: "high" },
    { kind: "recurringMaterial", text: "The opening figure", places: [at(1, "stretch", 1), at(4, "stretch", 1)], confidence: "medium" },
  ],
};

// --- What is stored, read, edited and told ---

function snapshots(): Record<string, string> {
  const checked = checkScoreAnswer(scoreAnswer, context);
  assert.ok(!("problem" in checked), JSON.stringify(checked));
  const metadata = checked.metadata;
  const observations = combineObservations(pages, checked);
  const systemsOf = (page: number) => pages.find((p) => p.page === page)?.systems ?? [];

  // fix_metadata: analyze's metadata read, edited (a field confirmed, one changed, a piece moved, fields added and
  // retyped), stored, and read back.
  const shown = normalizeMetadata(metadata);
  const rows = fixMetadata.rowsOf(shown);
  const metaSystems: fixMetadata.Systems = { pageOf: scoreSystems.map((s) => s.page) };
  const pieceIndex = rows.findIndex((r) => r.kind === "piece" && r.system === 4);
  let edited = rows.map((r, i) => (i === 0 ? { ...r, confirmed: true } : i === 2 ? { ...r, text: "R. Schumann", confirmed: true } : r));
  edited = edited.map((r, i) => (i === pieceIndex ? fixMetadata.withSystem(r, 3, metaSystems) : r));
  const kinds = fixMetadata.FIELD_KINDS;
  const added = fixMetadata.newRow(kinds.find((k) => k.id === "piece")!, edited, metaSystems);
  edited = [...edited, { ...added, text: "Bittendes Kind" }, { ...fixMetadata.newRow(kinds.find((k) => k.id === "text:comments")!, edited, metaSystems), text: "A note" }];
  edited = [...edited, fixMetadata.withKind({ ...edited[1] }, kinds.find((k) => k.id === "piece")!, edited, -1, metaSystems)];
  const stored = fixMetadata.metadataOf(edited);
  const metadataProblems = edited.map((r, i) => fixMetadata.pieceProblem(r, edited.filter((_, j) => j !== i)));

  // fix_observations: analyze's observations read, edited (moved, staves added, items added), stored, read back.
  const obs = fixObservations.normalizeObservations(observations);
  const obsRows = fixObservations.rowsOf(obs);
  const ottava = obsRows.findIndex((r) => r.list === "ottavas" && r.page === 1);
  let obsEdited = obsRows.map((r, i) =>
    i === ottava ? fixObservations.withPlace(r, "end", at(2, "barLine", 3), obsRows, scoreSystems) : r,
  );
  const system1 = obsEdited.findIndex((r) => r.list === "systems" && r.system === 1);
  const withStaff = fixObservations.addStaff(obsEdited, system1, "above", scoreSystems);
  assert.ok(typeof withStaff !== "string");
  obsEdited = withStaff;
  for (const k of fixObservations.OBS_KINDS) obsEdited = [...obsEdited, { ...fixObservations.newRow(k, obsEdited, scoreSystems, [1, 2]), text: k.label }];
  const obsStored = fixObservations.observationsOf(obsEdited, [1, 2]);
  const obsProblems = obsEdited.map((r, i) => fixObservations.obsProblem(r, obsEdited.filter((_, j) => j !== i), scoreSystems));
  const removeProblems = obsEdited.map((_, i) => fixObservations.removeProblem(obsEdited, i, scoreSystems));
  const reversed = { ...obsRows[ottava], start: at(2, "barLine", 3), end: at(2, "stretch", 1) };

  // What extract is told, from analyze's observations and from the form's.
  const hints = (o: typeof observations, pieces: number[]) => {
    const spans = linkSpans(o, systemsOf, pieces);
    return { spans, hints: input.map((s) => systemHints(o, spans, s.number, s.page)) };
  };

  // Places as the views name and sort them.
  const places = input.flatMap((s) => fixObservations.positionsIn(s.number, s.barLines.length));
  const score = buildScore(input, piecesOf(stored));

  return {
    "analyze metadata": json(metadata),
    "analyze observations": json(observations),
    "analyze pieces": json(piecesOf(metadata)),
    "metadata read": json(shown),
    "metadata rows": json(rows),
    "metadata sections": json(fixMetadata.sectionsOf(edited)),
    "metadata stored": json(stored),
    "metadata stored, read back": json(normalizeMetadata(JSON.parse(JSON.stringify(stored)))),
    "metadata counts": json([fixMetadata.changedFields(shown, stored), fixMetadata.confirmedFields(stored), fixMetadata.fixNote(2, 3)]),
    "metadata problems": json(metadataProblems),
    "metadata confidences": json(rows.map(shownConfidence)),
    "metadata pieces": json(piecesOf(stored)),
    "observations read": json(obs),
    "observations rows": json(obsRows),
    "observations sections": json(fixObservations.sectionsOf(obsEdited)),
    "observations stored": json(obsStored),
    "observations stored, read back": json(fixObservations.normalizeObservations(JSON.parse(JSON.stringify(obsStored)))),
    "observations counts": json([fixObservations.changedItems(obs, obsStored), fixObservations.confirmedItems(obsStored)]),
    "observations problems": json([...obsProblems, ...removeProblems, fixObservations.obsProblem(reversed, obsRows.filter((_, i) => i !== ottava), scoreSystems)]),
    "observations confidences": json(obsEdited.map(shownConfidence)),
    "hints from analyze": json(hints(observations, piecesOf(metadata))),
    "hints from the form": json(hints(obsStored, piecesOf(stored))),
    "place labels": json(places.map((p) => [placeLabel(p), positionLabel(p), firstPlace({ place: p })])),
    "place kinds": json(PLACE_KINDS),
    "mei metadata, analyze": json(meiMetadata(metadata)),
    "mei metadata, form": json(meiMetadata(stored)),
    "mei, form": hash(meiString(score, { metadata: meiMetadata(stored) })),
  };
}

test("what analyze and its forms store, read and tell is what it was", () => {
  assert.deepEqual(snapshots(), {
    "analyze metadata": "eed8565d834f1ece",
    "analyze observations": "1275f3977880da43",
    "analyze pieces": "aa5507f9e57ee8a2",
    "metadata read": "ac86eb23d1766161",
    "metadata rows": "fba7455cd0e73645",
    "metadata sections": "2ede906fb510db86",
    "metadata stored": "a4f3f0fe394c0eb8",
    "metadata stored, read back": "a4f3f0fe394c0eb8",
    "metadata counts": "0c25bbfa52b3c1dc",
    "metadata problems": "e8e67f77c7df82f4",
    "metadata confidences": "dff2fba0b305bebe",
    "metadata pieces": "f6bd10506e9a4dae",
    "observations read": "fd5fc7cdffdabe89",
    "observations rows": "aa4f8c2ffaf9215c",
    "observations sections": "4862f4d9c8957cca",
    "observations stored": "5b5aaa7343dddedf",
    "observations stored, read back": "5b5aaa7343dddedf",
    "observations counts": "780870d9e4e08c7d",
    "observations problems": "68c2ccca9c96bd77",
    "observations confidences": "83ac7d8f0fd13554",
    "hints from analyze": "d69c738fc15413ef",
    "hints from the form": "4671c7abd2357cd2",
    "place labels": "759281a69f198495",
    "place kinds": "4323a3ab0f9ddb03",
    "mei metadata, analyze": "8505dc8daa08b257",
    "mei metadata, form": "1a729153f4eff963",
    "mei, form": "7b7140baeb8ef31a",
  });
});
