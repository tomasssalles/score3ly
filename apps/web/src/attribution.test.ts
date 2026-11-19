import { test } from "node:test";
import assert from "node:assert/strict";
import { attributionOf, extend, whoOf, type Attribution, type ChainStage, type Mismatch } from "./attribution.ts";
import type { StoredReview } from "./review.ts";
import type { StoredIssue } from "./issues.ts";

// Who chose and applied: worked out from the pipeline's stages in order, never stored (docs/stages/music.md, "Who chose").

function issue(id: number, choices: StoredIssue["choices"], applications: StoredIssue["applications"] = [], over: Partial<StoredIssue> = {}): StoredIssue {
  return {
    id,
    source: "extract",
    class: "reading",
    boxes: [],
    location: null,
    question: "A D or an E?",
    answers: [
      { key: "a", text: "A D" },
      { key: "b", text: "An E" },
    ],
    choices,
    applied: applications.at(-1)?.key ?? null,
    applications,
    resolved: false,
    lilypond: null,
    ...over,
  };
}

// Stored content, by made-up hashes; counts the reads.
function store(content: Record<string, unknown>) {
  const reads: string[] = [];
  return {
    reads,
    json: async (sha256: string) => (reads.push(sha256), structuredClone(content[sha256])),
    // Every walk here is a correct one: a mismatch fails the test.
    report: (m: Mismatch) => assert.fail(`mismatch: ${JSON.stringify(m)}`),
  };
}

const extracted = issue(1, [{ by: "extract", key: "a", reason: null }], [{ by: "extract", key: "a" }]);
const content: Record<string, unknown> = {
  // Extract: issue 1, its answer "a" written.
  e1: { system: 1, page: 1, answer: {}, issues: [extracted], warnings: [] },
  // A review that chose "b" on issue 1.
  r1: { system: 1, entries: [{ choice: { issue: 1, key: "b", newAnswer: null, reason: "The head is on the space." } }] } satisfies StoredReview,
  // The Apply review after it: "b" applied.
  a1: { system: 1, page: 1, answer: {}, warnings: [], issues: [issue(1, [...extracted.choices, { by: "review", key: "b", reason: "The head is on the space." }], [...extracted.applications!, { by: "apply_review", key: "b" }])] },
  // A review that made no choice: it keeps "b".
  r2: { system: 1, entries: [] } satisfies StoredReview,
};

const E: ChainStage = { who: whoOf("extract", 1), step: "extract", systems: ["e1"], checks: null };
const review = (sha256: string, turn: number): ChainStage => ({ who: whoOf("review", turn), step: "review", calls: [sha256], done: true });
const apply = (sha256: string, turn: number): ChainStage => ({ who: whoOf("apply_review", turn), step: "apply_review", systems: [sha256], checks: null });

const labels = (a: Attribution, id: number) => ({ choices: a[id].choices.map((w) => w.label), applications: a[id].applications.map((w) => w.label) });

test("every choice and application is named by the stage, in the pipeline's order, after which the issue first has it", async () => {
  const { attribution, issues } = await attributionOf([E, review("r1", 1), apply("a1", 1), review("r2", 2)], store(content));
  assert.deepEqual(labels(attribution, 1), {
    choices: ["Extract", "Review 1", "Review 2"], // Review 2's agreement, kept
    applications: ["Extract", "Apply review 1"],
  });
  assert.equal(issues.get(1)!.choices.at(-1)!.kept, true);
  assert.equal(whoOf("human_review", 2).person, true);
});

test("the same stored content gets the label of its turn now: a review moved up by a stage dropped before it", async () => {
  // Review r2's output is the same either way (found in the cache): only its place in the pipeline changed.
  const { attribution } = await attributionOf([E, review("r2", 1)], store(content));
  assert.deepEqual(labels(attribution, 1).choices, ["Extract", "Review 1"]);
});

test("each prefix of the chain is kept on the device, and a walk starts again from the longest one found", async () => {
  const cache = new Map<string, Attribution>();
  const sources = { cached: async (key: string) => cache.get(key) ?? null, cache: async (key: string, a: Attribution) => void cache.set(key, a) };
  const first = store(content);
  const chain = [E, review("r1", 1), apply("a1", 1)];
  const before = await attributionOf(chain, { ...first, ...sources });
  assert.equal(cache.size, 3);
  // One more stage: the cached prefix is used; only what the last stage needs is read again (from the latest
  // transcription on).
  const second = store(content);
  const after = await attributionOf([...chain, review("r2", 2)], { ...second, ...sources });
  assert.deepEqual(second.reads, ["a1", "r2"]);
  assert.deepEqual(labels(after.attribution, 1).applications, labels(before.attribution, 1).applications);
  assert.deepEqual(labels(after.attribution, 1).choices, ["Extract", "Review 1", "Review 2"]);
  // A stage dropped before: another chain, another key; nothing stale is used.
  const third = store(content);
  await attributionOf([E, review("r2", 1)], { ...third, ...sources });
  assert.deepEqual(third.reads, ["e1", "r2"]);
});

test("extend names only the entries beyond those already named; Extract's own stay Extract's", () => {
  const named = extend({}, [extracted], whoOf("review", 1));
  assert.deepEqual(labels(named, 1), { choices: ["Extract"], applications: ["Extract"] });
  const more = extend(named, [issue(1, [...extracted.choices, { by: "human_review", key: "b", reason: null }], extracted.applications)], whoOf("human_review", 1));
  assert.deepEqual(labels(more, 1).choices, ["Extract", "Human review 1"]);
  assert.equal(more[1].choices[1].person, true);
});

test("an entry given to a stage of another step than its stored one is reported, and keeps the stage's label", () => {
  const found: Mismatch[] = [];
  // A choice stored as a review's, but first found after an Apply review: a bug somewhere.
  const named = extend({}, [issue(1, [...extracted.choices, { by: "review", key: "b", reason: null }], extracted.applications)], whoOf("apply_review", 1), (m) => found.push(m));
  assert.deepEqual(found, [{ issue: 1, list: "choices", index: 1, stored: "review", stage: "Apply review 1" }]);
  assert.equal(named[1].choices[1].label, "Apply review 1");
  assert.equal(named[1].choices[0].label, "Extract"); // Extract's own: no mismatch
});
