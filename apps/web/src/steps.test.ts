import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { STEPS } from "./steps.ts";
import type { ApiStage } from "./api.ts";

// Every step's kind, as it was declared. A step's kind never changes (docs/database.md): add new steps here, but
// never edit an entry.
const KINDS: Record<string, string> = {
  ingest: "ingest",
  rasterize: "computed",
  skew_analysis: "computed",
  layout: "llm",
  analyze: "llm",
  extract: "llm",
  review: "llm",
  apply_review: "llm",
  build_mei: "computed",
  engrave: "computed",
  fix_skew: "manual",
  fix_layout: "manual",
  fix_metadata: "manual",
  fix_observations: "manual",
  human_review: "manual",
  fix_mei: "manual",
};

test("no step's kind ever changes", () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(STEPS).map(([id, info]) => [id, info.kind])),
    KINDS,
  );
});

// The Worker gives every LLM stage its model config when it creates the stage (docs/llm.md), by its own list of the LLM
// steps (`LLM_STEPS` in apps/worker/src/pipeline.ts, read here as text: importing it would load the Worker's code). Every
// step declared here as an LLM step must be in it, and the other way round.
test("the Worker knows every LLM step", () => {
  const source = readFileSync(join(import.meta.dirname, "../../worker/src/pipeline.ts"), "utf8");
  const list = /export const LLM_STEPS = \[([^\]]*)\]/.exec(source)?.[1];
  assert.ok(list, "LLM_STEPS not found in the Worker's pipeline.ts");
  const worker = [...list.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
  const llm = Object.entries(STEPS).filter(([, info]) => info.kind === "llm").map(([id]) => id);
  assert.deepEqual(llm.filter((id) => !worker.includes(id)), []);
  assert.deepEqual(worker.filter((id) => !llm.includes(id)), []);
});

const NO_MODELS = { modelConfigs: [], laterLlmStages: 0 };

test("rasterize's config is checked against the PDF's page count before it is saved", () => {
  const { check } = STEPS.rasterize.config!;
  assert.equal(check({ pages: "1-3", dpi: 300 }, { pageCount: 3, ...NO_MODELS }), null);
  assert.equal(check({ pages: "2, 5", dpi: 300 }, { pageCount: 3, ...NO_MODELS }), "The PDF has 3 pages: there is no page 5.");
  // Unknown page count: only the config itself is checked.
  assert.equal(check({ pages: "5", dpi: 300 }, { pageCount: null, ...NO_MODELS }), null);
  assert.notEqual(check({ pages: "5", dpi: 10 }, { pageCount: null, ...NO_MODELS }), null);
});

test("every LLM stage's config has its model config: read from the stored config, checked against the configs", () => {
  for (const [id, info] of Object.entries(STEPS)) {
    if (info.kind === "llm") assert.equal(info.config?.fields.find((f) => f.kind === "modelConfig")?.key, "modelConfigId", id);
  }
  const { read, check } = STEPS.layout.config!;
  assert.deepEqual(read({ modelConfigId: "opus" }), { modelConfigId: "opus" });
  assert.deepEqual(read(null), { modelConfigId: "" });
  const context = {
    pageCount: null,
    modelConfigs: [
      { id: "opus", name: "Opus", deleted: false, unsupported: false },
      { id: "old", name: "Old", deleted: true, unsupported: false },
      { id: "gone", name: "Gone", deleted: false, unsupported: true },
    ],
    laterLlmStages: 2,
  };
  assert.equal(check({ modelConfigId: "opus" }, context), null);
  assert.equal(check({ modelConfigId: "" }, context), "Pick a model config.");
  assert.equal(check({ modelConfigId: "old" }, context), '"Old" was deleted: pick another model config.');
  assert.equal(check({ modelConfigId: "gone" }, context), 'The app no longer supports "Gone": pick another model config.');
});

test("Fix MEI is offered only by Build MEI, the stage that creates the MEI", () => {
  for (const [id, info] of Object.entries(STEPS)) assert.equal(info.fixes.includes("fix_mei"), id === "build_mei", id);
});
