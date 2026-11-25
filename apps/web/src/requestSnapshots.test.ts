// Snapshots of what the LLM stages send and store, taken before the code review's batch 17 moved the schemas and the
// lens's model form (review/plan.md, "What guards requests"): the six schemas as sent (key order included), the
// prompts' fixed texts, the requests' texts built from realistic inputs (notation's rich score, issues of every kind,
// the observations and metadata of real pages, several pieces), and the answers as code turns them into what is
// stored. The same inputs must give the same bytes, or every call is paid again. Only a change that means to change
// requests (the paid release) may update them. Changed by the paid release (batch 34), each diff read: the prompts'
// new sentences, a reading issue's `lilypond: []` (C31) and a revert's `reverted` (D18d) in the issues review and
// apply_review read, `bothRepeats` (D18c).

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { buildScore, type LensSystem } from "@score3ly/notation";
import { richScore } from "@score3ly/notation/testScore";
import {
  ANALYZE_PAGE_SCHEMA,
  ANALYZE_PAGE_SYSTEM,
  ANALYZE_SCORE_SCHEMA,
  ANALYZE_SCORE_SYSTEM,
  ANALYZE_SCORE_TEXT,
  analyzePageText,
  APPLY_REVIEW_SCHEMA,
  APPLY_REVIEW_SYSTEM,
  applyReviewFromModel,
  applyReviewIssuesText,
  applyReviewLogText,
  applyReviewText,
  checkPageAnswer,
  checkScoreAnswer,
  EXTRACT_SCHEMA,
  EXTRACT_SYSTEM,
  extractText,
  flatMetadata,
  flatObservations,
  groupForModel,
  LAYOUT_FIRST,
  LAYOUT_SCHEMA,
  LAYOUT_SYSTEM,
  layoutCheck,
  lensFromExtract,
  REVIEW_SCHEMA,
  REVIEW_SYSTEM,
  reviewFromModel,
  reviewIssuesText,
  reviewLogText,
  reviewScoreText,
  reviewText,
  staffForModel,
  stretchForModel,
  stretchMeasures as measures,
  withIds,
  type AnalyzeContext,
  type PageMetadata,
  type PageObservations,
  type ScoreAnswer,
} from "@score3ly/prompts";
import { combineObservations, pageItems, pageResultsForScore, type PageAnalysis } from "./analyze.ts";
import { applyLogEntries, issueToApply, systemView, type StoredApplyCall } from "./applyReview.ts";
import { logEntries, reviewIssues, reviewScore, reviewWarnings, type StoredReview } from "./review.ts";
import type { PlacedSystem, StoredIssue, StoredWarning } from "./issues.ts";

const hash = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 16);
const json = (value: unknown) => hash(JSON.stringify(value));

// --- The inputs ---

const input = richScore();
const score = buildScore(input, [1, 4]);
const placed: PlacedSystem[] = input.map((s) => ({ number: s.number, page: s.page, layout: { box: s.box!, barLines: s.barLines } }));
const answers = new Map<number, LensSystem>(input.map((s) => [s.number, s.answer]));

const on = (page: number, top: number, left = 0.2, right = 0.4) => ({ page, box: { left, right, top, bottom: top + 0.05 } });

// Issues of every kind: extract's reading and format issues (one across two systems), a review's, code's (nothing
// known applied), a person's clarification (resolved), and one with a review's agreement and a revert.
const issues: StoredIssue[] = [
  {
    id: 1,
    source: "extract",
    class: "reading",
    boxes: [on(1, 0.12)],
    location: null,
    question: "Is the dot above the F a staccato or a smudge?",
    answers: [
      { key: "a", text: "A staccato" },
      { key: "b", text: "A smudge" },
    ],
    choices: [{ by: "extract", key: "a", reason: null }],
    applied: "a",
    applications: [{ by: "extract", key: "a" }],
    resolved: false,
    lilypond: null,
  },
  {
    id: 2,
    source: "extract",
    class: "format",
    boxes: [on(1, 0.25, 0.7, 0.9), on(1, 0.52, 0.1, 0.2)],
    location: "the diamond notehead of the top note",
    question: "The top note has a diamond notehead (a harmonic), which the format can't write.",
    answers: [
      { key: "a", text: "Write it as a normal note" },
      { key: "b", text: "Drop the note" },
    ],
    choices: [{ by: "extract", key: "a", reason: null }],
    applied: "a",
    applications: [{ by: "extract", key: "a" }],
    resolved: false,
    lilypond: ["\\harmonic"],
  },
  {
    id: 3,
    source: "review",
    class: "reading",
    boxes: [on(1, 0.55, 0.5, 0.7)],
    location: "the lowest note of the chord",
    question: "Is the lowest note of the chord in m. 3 a C or an E?",
    answers: [
      { key: "a", text: "A C" },
      { key: "b", text: "An E" },
    ],
    choices: [{ by: "review", key: "b", reason: "Measure 7 has the same chord, with an E" }],
    applied: "a",
    resolved: false,
    lilypond: null,
  },
  {
    id: 4,
    source: "code",
    class: "reading",
    boxes: [on(2, 0.15, 0.3, 0.6)],
    location: null,
    question: "Where does the slur that starts in m. 8 end?",
    answers: [
      { key: "a", text: "On the next note" },
      { key: "b", text: "At the end of the measure" },
    ],
    choices: [],
    applied: null,
    resolved: false,
    lilypond: null,
  },
  {
    id: 5,
    source: "user",
    class: "reading",
    boxes: [on(2, 0.6, 0.1, 0.3)],
    location: null,
    question: "",
    answers: [{ key: "a", text: "This is a C flat, not a C" }],
    choices: [{ by: "human_review", key: "a", reason: null }],
    applied: null,
    resolved: true,
    lilypond: null,
  },
  {
    id: 6,
    source: "extract",
    class: "reading",
    boxes: [on(1, 0.58, 0.3, 0.5)],
    location: null,
    question: "Is there a tie between the two B flats?",
    answers: [
      { key: "a", text: "A tie" },
      { key: "b", text: "No tie" },
      { key: "c", text: "A slur over both" },
    ],
    choices: [
      { by: "extract", key: "a", reason: null },
      { by: "review", key: "a", reason: null, kept: true },
      { by: "review", key: "c", reason: "The curve reaches the next note" },
      { by: "apply_review", key: "a", reason: "The next note is a rest, so the slur can't end there.", reverted: true },
    ],
    applied: "a",
    applications: [{ by: "extract", key: "a" }],
    resolved: false,
    lilypond: null,
  },
];

const warnings: StoredWarning[] = [
  { message: "The voices of m. 3 don't last the same: 1 and 3/4.", boxes: [on(1, 0.5, 0.3, 0.5)] },
  { message: "The measure numbers change their offset at m. 8.", boxes: [on(2, 0.5, 0.4, 0.7), on(2, 0.1, 0.4, 0.7)] },
];

const observations = { systems: [{ id: "p1-1", system: 1, staves: 2 }], notesForTranscription: [{ id: "s1", text: "Two voices in the right hand", confidence: "medium" }] };

const review: StoredReview = {
  system: 1,
  entries: [
    { choice: { issue: 1, key: "b", newAnswer: null, reason: null } },
    { choice: { issue: 6, key: "d", newAnswer: { key: "d", text: "A tie and a slur" }, reason: "Both curves are printed" } },
    { newIssue: issues[2] },
    { newIssue: { ...issues[1], id: 7, source: "review", choices: [{ by: "review", key: "b", reason: null }], applications: undefined } },
  ],
};

const { voices: _v, ...stretch2 } = input[1].answer.stretches[1];
const call: StoredApplyCall = {
  system: 2,
  window: [2, 3],
  voices: [
    { system: 2, stretch: 1, voice: 1, staff: 1, description: null, music: "\\flat b'4\\=1( b'4\\=1) r4 r4", reason: null },
    { system: 3, stretch: 1, voice: 4, staff: 1, description: "inner alto line", music: "R2.", reason: "The new voice of issue 3 starts here" },
    { system: 2, stretch: 4, voice: 2, staff: 2, description: null, music: null, reason: null },
  ],
  stretches: [{ system: 2, ...stretch2, class: "continues", kind: null, reason: null }],
  systems: [{ system: 3, startRepeat: false, staves: input[2].answer.staves, groups: input[2].answer.groups, lastMeasureContinues: false, reason: "The start repeat is on system 2" }],
  choices: [
    { issue: 3, key: "a", reason: "The chord would then have two Es." },
    { issue: 4, key: "c", newAnswer: { key: "c", text: "On the E of the next measure" }, reason: "Neither answer says what is there." },
  ],
  applied: [1, 2],
  changed: [{ system: 2, stretch: 1 }],
  warnings: [],
};

// Two real pages (Kinderscenen, first edition): metadata of every kind, observations of every kind.
const at = (system: number, at: "start" | "barLine" | "stretch" | "end", number = 0) => ({ system, at, number });
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
      specialBarLines: [{ kind: "startEndRepeat", place: at(4, "barLine", 2), confidence: "medium" }],
      endings: [],
      directions: [{ text: "D.C. al Fine", place: at(4, "end"), confidence: "high" }],
      notes: [],
    } satisfies PageObservations,
  },
];
const analyzeContext: AnalyzeContext = {
  systems: new Map(placed.map((s) => [s.number, { barLines: s.layout.barLines.length, page: s.page }])),
  pages: [1, 2],
  items: pageItems(pages),
};

// --- The answers, as models write them ---

const modelIssues = [
  {
    boxes: [{ image: "stretch 2", box: { left: 0.1, right: 0.3, top: 0.2, bottom: 0.4 } }],
    location: "",
    question: "Is the dot above the F a staccato or a smudge?",
    answers: [
      { key: "a", text: "A staccato" },
      { key: "b", text: "A smudge" },
    ],
    applied: "a",
    class: "reading",
    lilypond: [],
  },
  {
    boxes: [
      { image: "system", box: { left: 0.8, right: 0.95, top: 0.1, bottom: 0.3 } },
      { image: "next system", box: { left: 0.02, right: 0.1, top: 0.1, bottom: 0.3 } },
    ],
    location: "the diamond notehead",
    question: "The top note has a diamond notehead, which the format can't write.",
    answers: [
      { key: "a", text: "Write it as a normal note" },
      { key: "b", text: "Drop the note" },
    ],
    applied: "a",
    class: "format",
    lilypond: ["\\harmonic"],
  },
];
// Each system of the rich score as extract's answer, in the model's form.
const extractAnswers = input.map(({ answer }) => ({
  startRepeat: answer.startRepeat,
  staves: answer.staves.map(staffForModel),
  groups: answer.groups.map(groupForModel),
  stretches: answer.stretches.map((s) => stretchForModel(s)),
  lastMeasureContinues: answer.lastMeasureContinues,
  issues: modelIssues,
}));
const reviewAnswer = {
  entries: [
    { choice: { issue: 1, key: "b", newAnswer: "", reason: "" } },
    { choice: { issue: 6, key: "", newAnswer: "A tie and a slur", reason: "Both curves are printed" } },
    { newIssue: { ...modelIssues[0], chosen: "b", reason: "" } },
    { newIssue: { ...modelIssues[1], chosen: "b", reason: "The same notehead is a harmonic in m. 9" } },
  ],
};
const applyAnswer = {
  voices: [
    { system: 2, stretch: 1, voice: 1, staff: 1, description: "", music: "\\flat b'4\\=1( b'4\\=1) r4 r4", reason: "" },
    { system: 3, stretch: 1, voice: 4, staff: 1, description: "inner alto line", music: "R2.", reason: "The new voice starts here" },
    { system: 2, stretch: 4, voice: 2, staff: 2, description: "", music: null, reason: "" },
  ],
  stretches: [{ system: 2, ...stretchForModel(stretch2), class: "continues", reason: "" }],
  systems: [{ system: 3, startRepeat: false, staves: input[2].answer.staves.map(staffForModel), groups: input[2].answer.groups.map(groupForModel), lastMeasureContinues: false, reason: "" }],
  choices: [
    { issue: 3, key: "a", newAnswer: "", reason: "The chord would then have two Es." },
    { issue: 4, key: "", newAnswer: "On the E of the next measure", reason: "Neither answer says what is there." },
  ],
};
const flatPage = (p: PageAnalysis) => ({ metadata: flatMetadata(p.metadata), observations: flatObservations(p.observations) });
const scoreAnswer = {
  metadata: flatMetadata({ ...pages[0].metadata, titles: pages[0].metadata.titles.map((t) => ({ ...t, page: 1 })), people: [], pieces: [{ title: "Kuriose Geschichte", system: 4, confidence: "high", page: 2 }], catalogueNumbers: [], publishers: [], places: [], plateNumbers: [] } as never),
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

// --- What is sent and stored ---

function snapshots(): Record<string, string> {
  const measureOf = measures(score);
  const checkedScore = checkScoreAnswer(scoreAnswer, analyzeContext);
  assert.ok(!("problem" in checkedScore), JSON.stringify(checkedScore));
  return {
    "schema layout": json(LAYOUT_SCHEMA),
    "schema analyze page": json(ANALYZE_PAGE_SCHEMA),
    "schema analyze score": json(ANALYZE_SCORE_SCHEMA),
    "schema extract": json(EXTRACT_SCHEMA),
    "schema review": json(REVIEW_SCHEMA),
    "schema apply_review": json(APPLY_REVIEW_SCHEMA),
    "system layout": hash(LAYOUT_SYSTEM),
    "system analyze page": hash(ANALYZE_PAGE_SYSTEM),
    "system analyze score": hash(ANALYZE_SCORE_SYSTEM),
    "system extract": hash(EXTRACT_SYSTEM),
    "system review": hash(REVIEW_SYSTEM),
    "system apply_review": hash(APPLY_REVIEW_SYSTEM),
    "layout texts": hash([LAYOUT_FIRST, layoutCheck(2), layoutCheck(3)].join("\n")),
    "analyze page texts": hash([analyzePageText(1, []), analyzePageText(2, [3]), analyzePageText(3, [4, 5, 6])].join("\n")),
    "analyze score text": hash(`${ANALYZE_SCORE_TEXT}\n\n${JSON.stringify(pageResultsForScore(pages))}`),
    "analyze page answers": json(pages.map((p) => checkPageAnswer(flatPage(p), { systems: new Map([...analyzeContext.systems].filter(([, s]) => s.page === p.page)) }))),
    "analyze score answer": json(checkedScore),
    "analyze observations": json(combineObservations(pages, checkedScore as ScoreAnswer)),
    "analyze ids": json(withIds(2, pages[1].observations)),
    "review score": hash(reviewScoreText(reviewScore(score), observations)),
    "review issues": hash(reviewIssuesText(reviewIssues(issues, placed), reviewWarnings(warnings, placed))),
    "review log": hash(reviewLogText(1, logEntries(review))),
    "review request": hash(reviewText({ system: 2, page: 1, stretches: 4, firstOfPiece: false, lastOfPiece: false, issues: [2, 6], resolved: [], warnings: [warnings[0].message], links: [] })),
    "apply_review issues": hash(applyReviewIssuesText(reviewIssues(issues, placed), reviewWarnings(warnings, placed))),
    "apply_review log": hash(applyReviewLogText(2, applyLogEntries(call))),
    "apply_review request": hash(
      applyReviewText({
        window: [2, 3],
        systems: [2, 3].map((n) => systemView(answers.get(n)!, placed[n - 1], measureOf)),
        before: systemView(answers.get(1)!, placed[0], measureOf),
        after: systemView(answers.get(4)!, placed[3], measureOf),
        links: { 2: [], 3: [] },
        apply: [issues[2], issues[4], issues[5]].map((i) => issueToApply(i, placed)),
        others: [4],
        warnings: [warnings[1].message],
      }),
    ),
    "extract answers, model form": json(extractAnswers),
    "extract answers, code form": json(extractAnswers.map(lensFromExtract)),
    "extract request text": hash(extractText({ system: 3, stretches: 2, staves: extractAnswers[0].staves })),
    "review answer, code form": json(reviewFromModel(reviewAnswer)),
    "apply_review answer, code form": json(applyReviewFromModel(applyAnswer)),
  };
}

test("what the LLM stages send and store is what it was", () => {
  assert.deepEqual(snapshots(), {
    'analyze ids': '57538c501756108e',
    'analyze observations': 'e6f5984bda111b09',
    'analyze page answers': 'b8539051e49aa7fb',
    'analyze page texts': 'd529249a3d5a8544',
    'analyze score answer': 'fcedd5b4da6eaf42',
    'analyze score text': '0dbb2583ade30086',
    'apply_review answer, code form': '55846af76199c8d9',
    'apply_review issues': 'a2d7a22254883075',
    'apply_review log': '9f2221a3f2d6d25c',
    'apply_review request': '335205ceeec66eb6',
    'extract answers, code form': '015b68503089e0eb',
    'extract answers, model form': 'a482e0c29959337a',
    'extract request text': 'd9d826fc31450236',
    'layout texts': 'b58bb9eed16bc762',
    'review answer, code form': '061d8587b2833bf2',
    'review issues': 'e2eb4d51a2c79bd9',
    'review log': '6cb904fa82435092',
    'review request': '9a55c9275415bc98',
    'review score': 'b338fb22bdcf66a8',
    'schema analyze page': '44c16332a18e02fd',
    'schema analyze score': 'f8c8f8191a4650c9',
    'schema apply_review': '5ed827108928eee1',
    'schema extract': 'f22c0ee953ad38a6',
    'schema layout': '3969e557f5052ec0',
    'schema review': '8e1f323d20481b41',
    'system analyze page': '76dc85cf386d6061',
    'system analyze score': '440f534babfe9e9c',
    'system apply_review': '102fdf8168015b69',
    'system extract': 'f01beb5cde230350',
    'system layout': 'f2637a5e0a846d25',
    'system review': '5ad917a2a9012a3d',
  });
});
