import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildModelList, listChanges, modelListModule, type ProviderFile } from "./generateModelList.ts";
import { schemaProblems, type Schema } from "./jsonSchema.ts";
import { MODEL_LIST } from "./modelList.ts";
import type { ModelList } from "./models.ts";

const dataDir = join(import.meta.dirname, "..", "..", "model-list");
const schema = JSON.parse(readFileSync(join(dataDir, "schema.json"), "utf8")) as Schema;
const files = readdirSync(dataDir)
  .filter((f) => f.endsWith(".json") && f !== "schema.json")
  .sort()
  .map((f) => JSON.parse(readFileSync(join(dataDir, f), "utf8")) as ProviderFile);

const PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 };

function file(provider: ProviderFile["provider"], fields: Partial<ProviderFile> = {}): ProviderFile {
  return { provider, collectedAt: "2026-11-05", sources: [], models: [], regions: [{ region: "", routings: null }], prices: [], ...fields };
}

const anthropic = file("anthropic", {
  models: [{ id: "big", name: "Claude Big", family: "claude", string: "claude-big" }],
  prices: [{ model: "big", region: "", routing: null, ...PRICE, source: "a page" }],
});
const bedrock = file("bedrock", {
  collectedAt: "2026-11-01",
  mock: true,
  models: [{ id: "big", name: "Claude Big", family: "claude", string: "anthropic.claude-big" }],
  regions: [{ region: "eu-west-1", routings: ["global", "geographic"], geography: "EU" }],
  prices: [{ model: "big", region: "eu-west-1", routing: "global", ...PRICE, source: "a file" }],
});

test("every file in model-list fits the schema, and the committed module is what they give", () => {
  assert.ok(files.length >= 4);
  for (const f of files) assert.deepEqual(schemaProblems(schema, f), [], f.provider);
  const built = buildModelList(files, MODEL_LIST);
  assert.ok("list" in built, "problems" in built ? built.problems.join("\n") : "");
  assert.equal(modelListModule(built.list), readFileSync(join(import.meta.dirname, "modelList.ts"), "utf8"), "run `npm run model-list -w apps/worker`");
});

test("the schema's problems are found, each with its path", () => {
  const broken = {
    provider: "openai",
    collectedAt: "5 Nov",
    sources: [{ url: "x", extra: 1 }],
    models: [{ id: "Big One", name: "", family: "claude", string: "s" }],
    regions: [{ region: "", routings: "global" }],
    prices: [{ model: "big", region: "", routing: null, input: -1, output: 20, cacheRead: 0.2, cacheWrite: 5 }],
  };
  assert.deepEqual(schemaProblems(schema, broken), [
    '$.provider: expected one of "anthropic", "bedrock", "ai-studio", "vertex", "openrouter", "fake", "fake-dev", found "openai"',
    "$.collectedAt: doesn't match ^\\d{4}-\\d{2}-\\d{2}$",
    "$.sources[0]: unexpected extra",
    "$.models[0].id: doesn't match ^[a-z0-9][a-z0-9.-]*$",
    "$.models[0].name: shorter than 1",
    "$.regions[0].routings: expected array or null, found string",
    "$.prices[0]: missing source",
    "$.prices[0].input: below 0",
  ]);
});

test("the files are joined into one list: models across providers, regions and prices per provider", () => {
  const built = buildModelList([bedrock, anthropic], null);
  assert.ok("list" in built);
  assert.deepEqual(built.list, {
    asOf: "2026-11-01", // the oldest file's day
    mock: true, // one file is a mock
    models: [{ id: "big", name: "Claude Big", family: "claude", strings: { anthropic: "claude-big", bedrock: "anthropic.claude-big" } }],
    regions: [
      { provider: "anthropic", region: "", routings: null },
      { provider: "bedrock", region: "eu-west-1", routings: ["global", "geographic"], geography: "EU" },
    ],
    prices: [
      { model: "big", provider: "anthropic", region: "", routing: null, price: PRICE },
      { model: "big", provider: "bedrock", region: "eu-west-1", routing: "global", price: PRICE },
    ],
  });
});

test("a model no file has any more is kept, retired; one that comes back isn't", () => {
  const previous: ModelList = {
    asOf: "2026-10-01",
    models: [
      { id: "big", name: "Claude Big", family: "claude", strings: { anthropic: "claude-big" }, retired: true },
      { id: "old", name: "Claude Old", family: "claude", strings: { anthropic: "claude-old" } },
    ],
    regions: [],
    prices: [],
  };
  const built = buildModelList([anthropic], previous);
  assert.ok("list" in built);
  assert.deepEqual(
    built.list.models.map((m) => [m.id, m.retired ?? false]),
    [
      ["big", false],
      ["old", true],
    ],
  );
});

test("files that disagree, and lists with problems, give no list", () => {
  const renamed = file("bedrock", { ...bedrock, models: [{ id: "big", name: "Claude Large", family: "claude", string: "anthropic.claude-big" }] });
  const built = buildModelList([anthropic, renamed, anthropic], null);
  assert.ok("problems" in built);
  assert.deepEqual(built.problems.slice(0, 3), [
    "Two files for anthropic.",
    'Model big is listed twice in anthropic\'s file.',
    'Model big is called "Claude Big" in one file and "Claude Large" in bedrock\'s.',
  ]);
  // listProblems: a price for a model the file doesn't have.
  const orphan = buildModelList([file("anthropic", { prices: [{ model: "nope", region: "", routing: null, ...PRICE, source: "x" }] })], null);
  assert.ok("problems" in orphan && orphan.problems.some((p) => p.includes("a model not in the list")));
});

test("the changes since the previous list, to spot-check", () => {
  const previous = buildModelList([anthropic, bedrock], null);
  assert.ok("list" in previous);
  const next = buildModelList(
    [
      file("anthropic", {
        models: [{ id: "new", name: "Claude New", family: "claude", string: "claude-new" }],
        prices: [{ model: "new", region: "", routing: null, ...PRICE, source: "x" }],
      }),
      file("bedrock", {
        ...bedrock,
        models: [{ id: "big", name: "Claude Big", family: "claude", string: "anthropic.claude-big-v2" }],
        regions: [{ region: "eu-west-1", routings: ["global"] }],
        prices: [{ model: "big", region: "eu-west-1", routing: "global", ...PRICE, input: 3, source: "x" }],
      }),
    ],
    previous.list,
  );
  assert.ok("list" in next, "problems" in next ? next.problems.join("\n") : "");
  assert.deepEqual(listChanges(previous.list, next.list), [
    "Model added: Claude New (new)",
    "Model string of big on anthropic: claude-big → none",
    "Model string of big on bedrock: anthropic.claude-big → anthropic.claude-big-v2",
    "Region added: bedrock eu-west-1 (global)",
    "Region gone: bedrock eu-west-1 (global, geographic) EU",
    "Price added: new on anthropic: $4 / $20 / $0.2 / $5",
    "Price changed: big on bedrock in eu-west-1 (global): $4 / $20 / $0.2 / $5 → $3 / $20 / $0.2 / $5",
    "Price gone: big on anthropic: $4 / $20 / $0.2 / $5",
  ]);
  assert.deepEqual(listChanges(previous.list, previous.list), []);
});
