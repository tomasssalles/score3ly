import { test } from "node:test";
import assert from "node:assert/strict";
import { CONFIG_VALUES, sameConfigValues, valuesOf, valuesOfNew, type ConfigValues, type ModelConfig } from "./modelConfigs.ts";

const ROW: ConfigValues = {
  provider: "bedrock",
  model_id: "opus",
  model_string: null,
  family: null,
  effort: "high",
  region: "eu-central-1",
  routing: "geographic",
  project: null,
  account: null,
  secrets_json: '{"accessKeyId":"ID","secretAccessKey":"SECRET"}',
  pricing_kind: "list",
  pricing_reference: null,
};

// As the Worker's create (`sameValues`) and import (`sameConfig`) compared stored rows before they shared this.
test("two configs are the same when every value but the id, the name and the dates is", () => {
  assert.equal(sameConfigValues(ROW, { ...ROW }), true);
  assert.equal(sameConfigValues({ ...ROW, id: "a", name: "A", created_at: "x" } as ConfigValues, { ...ROW, id: "b", name: "B" } as ConfigValues), true);
  // Secrets by content, whatever their order; a value missing from a row is null.
  assert.equal(sameConfigValues(ROW, { ...ROW, secrets_json: '{"secretAccessKey":"SECRET","accessKeyId":"ID"}' }), true);
  const { project: _p, ...withoutProject } = ROW;
  assert.equal(sameConfigValues(ROW, withoutProject), true);
  assert.equal(sameConfigValues({ ...ROW, secrets_json: undefined as unknown as string }, { ...ROW, secrets_json: "{}" }), true);
  // Secrets that aren't JSON (a damaged import) compare as their text, without throwing.
  assert.equal(sameConfigValues({ ...ROW, secrets_json: "{bad" }, { ...ROW, secrets_json: "{bad" }), true);
  assert.equal(sameConfigValues({ ...ROW, secrets_json: "{bad" }, ROW), false);
  for (const key of CONFIG_VALUES) {
    assert.equal(sameConfigValues(ROW, { ...ROW, [key]: key === "secrets_json" ? '{"apiKey":"K"}' : "other" }), false, key);
  }
  assert.equal(sameConfigValues(ROW, { ...ROW, effort: null }), false);
  assert.equal(sameConfigValues(ROW, { ...ROW, region: "" }), false);
});

test("a new config's values and a config's values, as stored", () => {
  const config = {
    provider: "bedrock",
    modelId: "opus",
    modelString: null,
    family: "claude",
    effort: "high",
    region: "eu-central-1",
    routing: "geographic",
    project: null,
    account: null,
    secrets: { secretAccessKey: "SECRET", accessKeyId: "ID" },
    pricing: { kind: "list", reference: null },
  } as unknown as ModelConfig;
  assert.deepEqual(valuesOf(config), ROW);
  assert.deepEqual(
    valuesOfNew({ provider: "bedrock", modelId: "opus", effort: "high", region: "eu-central-1", routing: "geographic", secrets: { secretAccessKey: "SECRET", accessKeyId: "ID" }, pricing: { kind: "list", reference: null } }),
    ROW,
  );
  // A model added by hand: its string trimmed, its family; an empty project is none; a reference only for list pricing.
  assert.deepEqual(
    valuesOfNew({ provider: "vertex", modelString: " x ", family: "gemini", effort: null, region: "eu", routing: null, project: "", secrets: {}, pricing: { kind: "unpriced" } }),
    { ...ROW, provider: "vertex", model_id: null, model_string: "x", family: "gemini", effort: null, region: "eu", routing: null, secrets_json: "{}", pricing_kind: "unpriced" },
  );
});
