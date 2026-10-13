import { test } from "node:test";
import assert from "node:assert/strict";
import { STEPS } from "./steps.ts";

// Every step's kind, as it was declared. A step's kind never changes (DESIGN.md §5.8): add new steps here, but
// never edit an entry.
const KINDS: Record<string, string> = {
  ingest: "ingest",
  rasterize: "computed",
  skew_analysis: "computed",
  layout: "llm",
  fix_skew: "manual",
};

test("no step's kind ever changes", () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(STEPS).map(([id, info]) => [id, info.kind])),
    KINDS,
  );
});
