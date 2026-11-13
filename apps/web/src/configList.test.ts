import { test } from "node:test";
import assert from "node:assert/strict";
import type { ModelConfig } from "./api.ts";
import { facetValues, NO_FILTER, shownConfigs, sortedConfigs } from "./configList.ts";

const config = (id: string, fields: Partial<ModelConfig>) => ({ id, name: id, provider: "anthropic", model: "claude-opus-5-5", modelName: "Claude Opus 5.5", createdAt: "2026-11-01T00:00:00Z", ...fields }) as ModelConfig;
const NAMES = { anthropic: "Anthropic", bedrock: "Bedrock", fake: "Fake" } as Record<string, string>;
const providerName = (p: string) => NAMES[p] ?? p;

const configs = [
  config("Opus 10", { createdAt: "2026-11-03T00:00:00Z" }),
  config("opus 2", { createdAt: "2026-11-01T00:00:00Z", provider: "bedrock" }),
  config("Éclair", { createdAt: "2026-11-02T00:00:00Z", provider: "fake", modelName: null, model: "fake-model" }),
  config("Bach", { createdAt: "2026-11-02T00:00:00Z", provider: "fake", modelName: null, model: "fake-slow" }),
];
const ids = (list: ModelConfig[]) => list.map((c) => c.id);

test("the configs in the order picked: by creation, either way, or by name, ignoring case and accents, numbers by value", () => {
  assert.deepEqual(ids(sortedConfigs(configs, "newest")), ["Opus 10", "Éclair", "Bach", "opus 2"]);
  assert.deepEqual(ids(sortedConfigs(configs, "oldest")), ["opus 2", "Bach", "Éclair", "Opus 10"]);
  assert.deepEqual(ids(sortedConfigs(configs, "name-asc")), ["Bach", "Éclair", "opus 2", "Opus 10"]);
  assert.deepEqual(ids(sortedConfigs(configs, "name-desc")), ["Opus 10", "opus 2", "Éclair", "Bach"]);
});

test("the filter's values: each provider and each model once, as the cards name them", () => {
  assert.deepEqual(facetValues(configs, "provider", providerName).map((v) => v.label), ["Anthropic", "Bedrock", "Fake"]);
  assert.deepEqual(facetValues(configs, "model", providerName).map((v) => v.label), ["Claude Opus 5.5", "fake-model", "fake-slow"]);
});

test("a config is shown unless its provider or its model is taken out", () => {
  assert.equal(shownConfigs(configs, NO_FILTER, providerName).length, 4);
  assert.deepEqual(ids(shownConfigs(configs, { provider: ["fake"], model: [] }, providerName)), ["Opus 10", "opus 2"]);
  assert.deepEqual(ids(shownConfigs(configs, { provider: [], model: ["name:Claude Opus 5.5"] }, providerName)), ["Éclair", "Bach"]);
  assert.deepEqual(ids(shownConfigs(configs, { provider: ["anthropic"], model: ["string:fake-slow"] }, providerName)), ["opus 2", "Éclair"]);
});
