import { test } from "node:test";
import assert from "node:assert/strict";
import { keyOf } from "@score3ly/core";
import { llmStageKey } from "./llmStageKey.ts";
import { LAYOUT_VERSION, layoutStageKey } from "./layout.ts";

const input = { promptVersion: 4, model: { provider: "bedrock", model: "eu.anthropic.claude-opus-5-5", effort: "high" }, imageRecipe: { scale: 1 }, pages: [] };

test("the model config's id isn't part of an LLM stage's key, so configs with the same model share stages", async () => {
  const a = await layoutStageKey({ ...input, config: { modelConfigId: "a" } });
  assert.equal(a, await layoutStageKey({ ...input, config: { modelConfigId: "b" } }));
  // With no other setting, the key is the step, its version and the step's own input, as before the settings were in it.
  assert.equal(a, await keyOf({ step: "layout", version: LAYOUT_VERSION, ...input }));
});

test("a setting of an LLM stage besides its model config is part of its key", async () => {
  const plain = await llmStageKey("extract", 3, { ...input, config: { modelConfigId: "a" } });
  const set = await llmStageKey("extract", 3, { ...input, config: { modelConfigId: "a", zoom: 1 } });
  const other = await llmStageKey("extract", 3, { ...input, config: { modelConfigId: "b", zoom: 2 } });
  assert.notEqual(plain, set);
  assert.notEqual(set, other);
  assert.equal(set, await llmStageKey("extract", 3, { ...input, config: { modelConfigId: "b", zoom: 1 } }));
});
