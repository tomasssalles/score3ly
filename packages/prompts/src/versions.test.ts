// The prompt-version guard (docs/overview.md, §7.2; code review D15).
// A prompt's version is in its step's stage key, but its texts are partly generated (music.ts from symbolic.ts' lists,
// the schemas from lensForm.ts' parts): a change there changes what is sent without anyone raising the version, and a
// re-run then reuses the done stages made with the old prompt. So each LLM stage's texts and schemas are hashed here,
// pinned beside the version they were written under: a changed text fails this test until its version is raised and
// the new hash pinned with it.
//
// What is hashed: every text a stage sends that doesn't depend on the project (system prompts, fixed texts), the text
// builders on fixed inputs (their wording around the request), the images' labels, and the answer's schema(s). Not
// the limits on output tokens: a parameter, not the prompt.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  ANALYZE_PAGE_SCHEMA,
  ANALYZE_PAGE_SYSTEM,
  ANALYZE_PROMPT_VERSION,
  ANALYZE_SCORE_SCHEMA,
  ANALYZE_SCORE_SYSTEM,
  ANALYZE_SCORE_TEXT,
  APPLY_REVIEW_PROMPT_VERSION,
  APPLY_REVIEW_SCHEMA,
  APPLY_REVIEW_SYSTEM,
  EXTRACT_PROMPT_VERSION,
  EXTRACT_SCHEMA,
  EXTRACT_SYSTEM,
  LAYOUT_FIRST,
  LAYOUT_PROMPT_VERSION,
  LAYOUT_ROUNDS,
  LAYOUT_SCHEMA,
  LAYOUT_SYSTEM,
  REVIEW_PROMPT_VERSION,
  REVIEW_SCHEMA,
  REVIEW_SYSTEM,
  analyzePageText,
  applyReviewIssuesText,
  applyReviewLogText,
  applyReviewText,
  extractImageLabels,
  extractText,
  layoutCheck,
  reviewIssuesText,
  reviewLogText,
  reviewScoreText,
  reviewText,
} from "./index.ts";

type Prompt = { version: number; parts: unknown };

const R = { request: ["<request>"] };
const ENTRY = { entry: "<entry>" };

// Each stage: its prompt version, and everything of its prompt that doesn't come from the project.
const PROMPTS: Record<string, Prompt> = {
  layout: {
    version: LAYOUT_PROMPT_VERSION,
    parts: [LAYOUT_SYSTEM, LAYOUT_FIRST, Array.from({ length: LAYOUT_ROUNDS }, (_, i) => layoutCheck(i + 1)), LAYOUT_SCHEMA],
  },
  analyze: {
    version: ANALYZE_PROMPT_VERSION,
    parts: [ANALYZE_PAGE_SYSTEM, [analyzePageText(3, []), analyzePageText(3, [5]), analyzePageText(3, [5, 6, 7])], ANALYZE_PAGE_SCHEMA, ANALYZE_SCORE_SYSTEM, ANALYZE_SCORE_TEXT, ANALYZE_SCORE_SCHEMA],
  },
  extract: {
    version: EXTRACT_PROMPT_VERSION,
    parts: [EXTRACT_SYSTEM, [extractImageLabels(1, false, false), extractImageLabels(3, true, true)], extractText(R), EXTRACT_SCHEMA],
  },
  review: {
    version: REVIEW_PROMPT_VERSION,
    parts: [REVIEW_SYSTEM, reviewScoreText(R, R), reviewIssuesText(R, R), reviewLogText(4, [ENTRY, ENTRY]), reviewText(R), REVIEW_SCHEMA],
  },
  apply_review: {
    version: APPLY_REVIEW_PROMPT_VERSION,
    parts: [APPLY_REVIEW_SYSTEM, applyReviewIssuesText(R, R), applyReviewLogText(4, [ENTRY, ENTRY]), applyReviewText(R), APPLY_REVIEW_SCHEMA],
  },
};

// The hashes, each with the version it was pinned at. A text or schema changed on purpose: raise the stage's prompt
// version and pin both here (the failure prints the new hash).
const PINNED: Record<string, { version: number; sha256: string }> = {
  layout: { version: 4, sha256: "8f0cb80515f87811a6e120ed0c33276d0ae1430271cd1cdd2417ac9aafb225e1" },
  analyze: { version: 7, sha256: "78b59fa3e653b52cd4d8b201a44c00e0c335f98ae3015b6204a0b0cba9a28dc3" },
  extract: { version: 7, sha256: "e5b5c2e493f0253e33740bc1af222e5407b48e1d744f2c695a2c8e93eb81388e" },
  review: { version: 7, sha256: "db714732c0d765d32dbd66ea86df54296e3a80fbf03c67d8f49c98e4f02312d3" },
  apply_review: { version: 7, sha256: "8b08407b7531ee07333ddfdc27c7e2108530174cb05fe6d251254fdb875e3d74" },
};

const promptHash = (parts: unknown) => createHash("sha256").update(JSON.stringify(parts)).digest("hex");

// What doesn't match: a stage whose prompt changed at its pinned version, or whose version moved without its hash.
function guardProblems(prompts: Record<string, Prompt>, pinned: Record<string, { version: number; sha256: string }>): string[] {
  return Object.entries(prompts).flatMap(([stage, { version, parts }]) => {
    const sha256 = promptHash(parts);
    const pin = pinned[stage];
    if (pin && pin.version === version && pin.sha256 === sha256) return [];
    return [
      `${stage}: its prompt is ${sha256} at version ${version}, pinned as ${pin?.sha256} at version ${pin?.version}. ` +
        (pin && pin.sha256 !== sha256 && pin.version === version
          ? "Its texts or schema changed: raise its prompt version, then pin the new hash with it."
          : "Pin the hash with the version."),
    ];
  });
}

test("each stage's prompt (texts and schemas) is pinned to its prompt version", () => {
  assert.deepEqual(Object.keys(PINNED), Object.keys(PROMPTS));
  assert.deepEqual(guardProblems(PROMPTS, PINNED), []);
});

test("the guard fails when a text changes alone, and when a version moves without its hash", () => {
  const changed = { ...PROMPTS, extract: { ...PROMPTS.extract, parts: [...(PROMPTS.extract.parts as unknown[]), "one more sentence"] } };
  const problems = guardProblems(changed, PINNED);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^extract: .*raise its prompt version/);
  const raised = { ...PROMPTS, review: { ...PROMPTS.review, version: PROMPTS.review.version + 1 } };
  assert.match(guardProblems(raised, PINNED).join(), /^review: .*Pin the hash with the version/);
  // Raised and pinned together: passes.
  const pinned = { ...PINNED, extract: { version: PROMPTS.extract.version, sha256: promptHash(changed.extract.parts) } };
  assert.deepEqual(guardProblems(changed, pinned), []);
});
