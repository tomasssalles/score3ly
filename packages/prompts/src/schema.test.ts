import { test } from "node:test";
import assert from "node:assert/strict";
import type { JsonSchema } from "@score3ly/core";
import { ANALYZE_PAGE_SCHEMA, ANALYZE_SCORE_SCHEMA } from "./analyzeForm.ts";
import { APPLY_REVIEW_SCHEMA } from "./applyReview.ts";
import { EXTRACT_SCHEMA } from "./extract.ts";
import { LAYOUT_SCHEMA } from "./layout.ts";
import { REVIEW_SCHEMA } from "./review.ts";

const SCHEMAS: Record<string, JsonSchema> = {
  layout: LAYOUT_SCHEMA,
  "analyze page": ANALYZE_PAGE_SCHEMA,
  "analyze score": ANALYZE_SCORE_SCHEMA,
  extract: EXTRACT_SCHEMA,
  review: REVIEW_SCHEMA,
  apply_review: APPLY_REVIEW_SCHEMA,
};

// Every schema within Anthropic's explicit limits for constrained output (docs/llm.md, "Claude's limit on schemas"):
// no optional property and nothing else allowed (every object requires all its properties and allows no others), and
// at most 16 properties with `anyOf` or a type list in a request (each request has one schema). Whether a schema is
// small enough beyond these, only the probe can tell (`npm run llm:probe-schemas -w apps/worker`).
test("every stage's schema requires every property, allows no others, and has at most 16 unions", () => {
  for (const [name, schema] of Object.entries(SCHEMAS)) {
    let unions = 0;
    const walk = (s: JsonSchema, path: string) => {
      if (s.anyOf) s.anyOf.forEach((option, i) => walk(option, `${path}|${i}`));
      if (s.type === "object") {
        assert.equal(s.additionalProperties, false, `${name}: ${path}`);
        assert.deepEqual(s.required, Object.keys(s.properties ?? {}), `${name}: ${path}`);
        for (const [key, sub] of Object.entries(s.properties ?? {})) {
          if (sub.anyOf || Array.isArray(sub.type)) unions++;
          walk(sub, `${path}.${key}`);
        }
      }
      if (s.type === "array") walk(s.items!, `${path}[]`);
    };
    walk(schema, "");
    assert.ok(unions <= 16, `${name}: ${unions} properties with anyOf or a type list`);
  }
});
