import { test } from "node:test";
import assert from "node:assert/strict";
import type { StoredExtraction, StoredIssue } from "./extract.ts";
import { answerTags, boxesOnCrop, homeOf, notesOf, shownSystem, type Note } from "./transcription.ts";

const extraction = (system: number, page: number): StoredExtraction => ({
  system,
  page,
  answer: { startRepeat: false, staves: [], groups: [], stretches: [], lastMeasureContinues: false, issues: [] },
  issues: [],
  warnings: [],
});

const systems = [
  shownSystem(extraction(1, 1), { box: { left: 0.1, right: 0.9, top: 0.1, bottom: 0.3 }, barLines: [0.5] }),
  shownSystem(extraction(2, 1), { box: { left: 0.1, right: 0.9, top: 0.4, bottom: 0.6 }, barLines: [0.5] }),
  shownSystem(extraction(3, 2), { box: { left: 0.1, right: 0.9, top: 0.1, bottom: 0.3 }, barLines: [] }),
];

const warning = (boxes: Note["boxes"]): Note => ({ key: "w", boxes, kind: "warning", warning: { message: "m", boxes } });

test("a note's text goes below the system its first box falls on", () => {
  assert.equal(homeOf(warning([{ page: 1, box: { left: 0.5, right: 0.9, top: 0.45, bottom: 0.55 } }]), systems), 2);
  assert.equal(homeOf(warning([{ page: 2, box: { left: 0.5, right: 0.9, top: 0.15, bottom: 0.25 } }]), systems), 3);
  assert.equal(homeOf(warning([{ page: 3, box: { left: 0, right: 1, top: 0, bottom: 1 } }]), systems), null);
});

test("a box is drawn on every crop it falls on, in the crop's fractions, cut at its edges", () => {
  // A box over the end of system 1 and the start of system 2: on both crops.
  const notes = [warning([{ page: 1, box: { left: 0.7, right: 0.9, top: 0.2, bottom: 0.5 } }])];
  const onFirst = boxesOnCrop(notes, 1, systems[0].crop);
  const onSecond = boxesOnCrop(notes, 1, systems[1].crop);
  assert.equal(onFirst.length, 1);
  assert.equal(onSecond.length, 1);
  assert.equal(onFirst[0].box.bottom, 1);
  assert.equal(onSecond[0].box.top, 0);
  assert.deepEqual(boxesOnCrop(notes, 2, systems[2].crop), []);
});

test("issues and warnings of the systems and of the whole score, each with its own key", () => {
  const withNotes = { ...systems[0], extraction: { ...extraction(1, 1), warnings: [{ message: "a", boxes: [] }] } };
  const notes = notesOf([withNotes], { issues: [], warnings: [{ message: "b", boxes: [] }] });
  assert.deepEqual(notes.map((n) => n.key), ["warning-1-0", "warning-score-0"]);
});

test("an answer's suffixes: who put it in the transcription, and who chose it last; a revert is a choice like any other", () => {
  const choosers = {
    extract: { label: "Extract", person: false },
    r1: { label: "Review 1", person: false },
    a1: { label: "Apply review 1", person: false },
    r2: { label: "Review 2", person: false },
    h1: { label: "Human review 1", person: true },
  };
  const base: StoredIssue = {
    id: 1,
    source: "extract",
    class: "reading",
    boxes: [],
    location: null,
    question: "A D or an E?",
    answers: [
      { key: "a", text: "A D" },
      { key: "b", text: "An E" },
    ],
    choices: [{ by: "extract", key: "a", reason: null }],
    applied: "a",
    applications: [{ by: "extract", key: "a" }],
    resolved: false,
    lilypond: null,
  };
  const tags = (issue: StoredIssue) => issue.answers.map((a) => answerTags(issue, a.key, choosers).map((t) => (t.stage ? `${t.words} ${t.stage}` : t.words)));
  // The stage's name apart, to be shown in bold.
  assert.deepEqual(answerTags(base, "a", choosers), [{ words: "written by", stage: "Extract" }]);
  assert.deepEqual(tags(base), [["written by Extract"], []]);
  const kept = { ...base, choices: [...base.choices, { by: "r1", key: "a", reason: null, kept: true as const }] };
  assert.deepEqual(tags(kept), [["written by Extract", "kept by Review 1"], []]);
  const chosen = { ...base, choices: [...base.choices, { by: "r1", key: "b", reason: null }] };
  assert.deepEqual(tags(chosen), [["written by Extract"], ["chosen by Review 1"]]);
  // Applied: the answer that was applied loses its suffix.
  const applied = { ...chosen, applied: "b", applications: [...base.applications!, { by: "a1", key: "b" }] };
  assert.deepEqual(tags(applied), [[], ["applied by Apply review 1", "chosen by Review 1"]]);
  // Reverted: Apply review's choice of the applied answer.
  const reverted = { ...chosen, choices: [...chosen.choices, { by: "a1", key: "a", reason: "Impossible.", reverted: true as const }] };
  assert.deepEqual(tags(reverted), [["written by Extract", "chosen by Apply review 1"], []]);
  // A later review keeps it: one suffix of each kind, never more.
  const again = { ...applied, choices: [...applied.choices, { by: "r2", key: "b", reason: null, kept: true as const }] };
  assert.deepEqual(tags(again), [[], ["applied by Apply review 1", "kept by Review 2"]]);
  // Raised after the transcription was written (a review's new issue), or by a person.
  assert.deepEqual(tags({ ...chosen, applications: [] }), [["in this transcription"], ["chosen by Review 1"]]);
  assert.deepEqual(tags({ ...base, choices: [{ by: "h1", key: "b", reason: null }] }), [["written by Extract"], ["confirmed by Human review 1"]]);
  assert.deepEqual(tags({ ...base, applied: null, applications: [] }), [[], []]);
});
