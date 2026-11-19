import { test } from "node:test";
import assert from "node:assert/strict";
import { STEP_KINDS } from "@score3ly/core";
import { STEPS } from "./steps.ts";
import type { ApiStage } from "./api.ts";
import { pdfRecipe } from "./recipes.ts";

// The kinds are declared once, in core (`STEP_KINDS`, which the Worker reads too: it gives LLM stages their model config
// and adds, carries and drops manual stages by them); the web's steps are those steps, with those kinds.
test("the web's steps are core's, with their kinds", () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(STEPS).map(([id, info]) => [id, info.kind])),
    STEP_KINDS,
  );
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

// Code review, D13: the PDF's recipe is read back for the artifact (its MEI and its page size), not rebuilt from the
// stage's config; a recipe stored before it held the page options reads the same.
test("engrave's artifact: the PDF of its stored recipe", () => {
  const stage = (recipe: unknown) =>
    ({ id: "s9", step: "engrave", status: "done", config: { pageSize: "a4" }, outputs: [{ id: "o1", item: "", type: "pdf", contentSha256: null, recipe }] }) as unknown as ApiStage;
  const mei = "ab".repeat(32);
  const engraving = (recipe: unknown) => STEPS.engrave.artifacts(stage(recipe), [])[0]?.engraving;
  assert.deepEqual(engraving(pdfRecipe(mei, { pageSize: "letter" })), { view: "pdf", meiSha256: mei, config: { pageSize: "letter" } });
  assert.deepEqual(engraving({ mei, config: { pageSize: "letter" }, verovio: "4.0.0", rendering: 1, pdf: 1 }), { view: "pdf", meiSha256: mei, config: { pageSize: "letter" } });
  assert.equal(engraving({ config: { pageSize: "a4" } }), undefined);
});
