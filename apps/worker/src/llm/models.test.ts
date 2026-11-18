import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  configBaseName,
  effortsOf,
  listedPrice,
  listProblems,
  modelByString,
  placesOf,
  priceEntry,
  geographyOf,
  placesOfProvider,
  priceOfConfig,
  resolveModel,
  type ModelList,
  type Provider,
} from "./models.ts";
import { MAX_NAME_LENGTH, nameTooLong } from "@score3ly/core";
import { isSupported, secretSets, supportedFamilies } from "./adapters.ts";
import { MODEL_LIST } from "./modelList.ts";

const P = (input: number) => ({
  input,
  output: input * 5,
  cacheRead: input / 10,
  cacheWrite: input * 1.25,
});

// A list of the tests' own: a model on two providers, one on Bedrock only in one place, a retired one.
const LIST: ModelList = {
  asOf: "2026-01-01",
  regions: [
    { provider: "anthropic", region: "", routings: null },
    { provider: "bedrock", region: "eu-west-1", routings: ["global", "geographic", "in-region"], geography: "EU" },
    { provider: "bedrock", region: "us-east-1", routings: ["global"] },
    { provider: "ai-studio", region: "", routings: null },
    { provider: "vertex", region: "europe-west1", routings: null },
  ],
  models: [
    {
      id: "big",
      name: "Claude Big",
      family: "claude",
      strings: { anthropic: "claude-big", bedrock: "anthropic.claude-big" },
    },
    {
      id: "small",
      name: "Claude Small",
      family: "claude",
      strings: { bedrock: "anthropic.claude-small" },
    },
    {
      id: "old",
      name: "Claude Old",
      family: "claude",
      strings: { anthropic: "claude-old" },
      retired: true,
    },
    {
      id: "gem",
      name: "Gemini Gem",
      family: "gemini",
      strings: { "ai-studio": "gemini-gem", vertex: "gemini-gem" },
    },
  ],
  prices: [
    {
      model: "big",
      provider: "anthropic",
      region: "",
      routing: null,
      price: P(4),
    },
    {
      model: "big",
      provider: "bedrock",
      region: "eu-west-1",
      routing: "global",
      price: P(4),
    },
    {
      model: "big",
      provider: "bedrock",
      region: "eu-west-1",
      routing: "in-region",
      price: P(4.4),
    },
    {
      model: "small",
      provider: "bedrock",
      region: "us-east-1",
      routing: "global",
      price: P(1),
    },
    {
      model: "old",
      provider: "anthropic",
      region: "",
      routing: null,
      price: P(8),
    },
    {
      model: "gem",
      provider: "ai-studio",
      region: "",
      routing: null,
      price: P(2),
    },
    {
      model: "gem",
      provider: "vertex",
      region: "europe-west1",
      routing: null,
      price: P(2),
    },
  ],
};

const EU_GLOBAL = { region: "eu-west-1", routing: "global" as const };
const EU_IN_REGION = { region: "eu-west-1", routing: "in-region" as const };
const NOWHERE = { region: "", routing: null };

// The app's own list is checked by generateModelList.test.ts (the module is what the files give, without problems).
test("the test's list has no problems", () => {
  assert.deepEqual(listProblems(LIST), []);
});

test("a model's string depends on the provider", () => {
  assert.equal(modelByString(LIST, "bedrock", "anthropic.claude-small")?.id, "small");
  assert.equal(modelByString(LIST, "anthropic", "anthropic.claude-small"), null);
});

test("a price is found by model, provider, region and routing", () => {
  assert.equal(listedPrice(LIST, "big", "bedrock", EU_GLOBAL)?.input, 4);
  assert.equal(listedPrice(LIST, "big", "bedrock", EU_IN_REGION)?.input, 4.4);
  assert.equal(
    listedPrice(LIST, "big", "bedrock", {
      region: "eu-west-1",
      routing: "geographic",
    }),
    null,
  );
  assert.equal(listedPrice(LIST, "big", "anthropic", NOWHERE)?.input, 4);
  assert.equal(
    listedPrice(LIST, "big", "anthropic", {
      region: "",
      routing: undefined as never,
    }),
    listedPrice(LIST, "big", "anthropic", NOWHERE),
  );
});

test("a model's places, and whether it is offered at one", () => {
  assert.deepEqual(placesOf(LIST, "big", "bedrock"), [EU_GLOBAL, EU_IN_REGION]);
  assert.equal(priceEntry(LIST, "big", "bedrock", EU_IN_REGION)?.price?.input, 4.4);
  assert.equal(priceEntry(LIST, "big", "bedrock", { region: "eu-west-1", routing: "geographic" }), undefined);
  assert.equal(priceEntry(LIST, "big", "vertex", NOWHERE), undefined);
});

test("a config's model: listed, added by the user, retired, or not offered", () => {
  assert.deepEqual(resolveModel(LIST, "bedrock", { modelId: "big" }), {
    string: "anthropic.claude-big",
    family: "claude",
    name: "Claude Big",
    retired: false,
  });
  assert.deepEqual(
    resolveModel(LIST, "bedrock", {
      modelString: "anthropic.claude-new",
      family: "claude",
    }),
    {
      string: "anthropic.claude-new",
      family: "claude",
      name: null,
      retired: false,
    },
  );
  assert.equal(resolveModel(LIST, "anthropic", { modelId: "old" })?.retired, true);
  assert.equal(resolveModel(LIST, "vertex", { modelId: "big" }), null);
  assert.equal(resolveModel(LIST, "anthropic", { modelId: "gone" }), null);
});

test("a config's price: its own, borrowed, free, unpriced or missing", () => {
  const own = { kind: "list" as const, reference: null };
  assert.deepEqual(
    priceOfConfig(LIST, {
      provider: "bedrock",
      model: { modelId: "big" },
      place: EU_IN_REGION,
      pricing: own,
    }),
    {
      kind: "priced",
      price: P(4.4),
      borrowedFrom: null,
    },
  );
  // A model the user added, priced as a listed one: the reference's price at the config's place.
  assert.deepEqual(
    priceOfConfig(LIST, {
      provider: "bedrock",
      model: { modelString: "anthropic.claude-big-2", family: "claude" },
      place: EU_GLOBAL,
      pricing: { kind: "list", reference: "big" },
    }),
    { kind: "priced", price: P(4), borrowedFrom: "big" },
  );
  // ... and where the reference has no price, none.
  assert.deepEqual(
    priceOfConfig(LIST, {
      provider: "bedrock",
      model: { modelString: "anthropic.claude-big-2", family: "claude" },
      place: { region: "us-east-1", routing: "global" },
      pricing: { kind: "list", reference: "big" },
    }),
    { kind: "missing" },
  );
  // A listed model at a place without a price.
  assert.deepEqual(
    priceOfConfig(LIST, {
      provider: "bedrock",
      model: { modelId: "small" },
      place: EU_GLOBAL,
      pricing: own,
    }),
    { kind: "missing" },
  );
  // A model the user added without a reference has nothing to be priced from.
  assert.deepEqual(
    priceOfConfig(LIST, {
      provider: "anthropic",
      model: { modelString: "claude-x", family: "claude" },
      place: NOWHERE,
      pricing: own,
    }),
    { kind: "missing" },
  );
  for (const kind of ["free", "unpriced"] as const) {
    assert.deepEqual(
      priceOfConfig(LIST, {
        provider: "anthropic",
        model: { modelId: "big" },
        place: NOWHERE,
        pricing: { kind },
      }),
      { kind },
    );
  }
});

test("default names: the model's name, the provider, the effort", () => {
  assert.equal(configBaseName(LIST, "bedrock", { modelId: "big" }, "high"), "Claude Big (Bedrock) · high");
  assert.equal(configBaseName(LIST, "ai-studio", { modelId: "gem" }, null), "Gemini Gem (AI Studio)");
  assert.equal(
    configBaseName(LIST, "bedrock", { modelString: "anthropic.claude-new", family: "claude" }, "max"),
    "anthropic.claude-new (Bedrock) · max",
  );
});

test("a provider's places come from the list's regions", () => {
  assert.deepEqual(placesOfProvider(LIST, "bedrock"), [
    { ...EU_GLOBAL, geography: "EU" },
    { region: "eu-west-1", routing: "geographic", geography: "EU" },
    { ...EU_IN_REGION, geography: "EU" },
    { region: "us-east-1", routing: "global" },
  ]);
  assert.deepEqual(placesOfProvider(LIST, "anthropic"), [NOWHERE]);
  assert.deepEqual(placesOfProvider(LIST, "fake"), []);
  assert.equal(geographyOf(LIST, "bedrock", "eu-west-1"), "EU");
  assert.equal(geographyOf(LIST, "bedrock", "us-east-1"), undefined);
});

test("the supported pairs of provider and family are the adapters'", () => {
  assert.deepEqual(supportedFamilies("vertex"), ["gemini"]);
  assert.deepEqual(supportedFamilies("bedrock"), ["claude"]);
  assert.equal(isSupported("vertex", "gemini"), true);
  assert.equal(isSupported("bedrock", "gemini"), false);
  assert.deepEqual(secretSets("bedrock", "claude"), [["apiKey"], ["accessKeyId", "secretAccessKey"]]);
  assert.equal(secretSets("bedrock", "gemini"), null);
});

test("the list's problems are found", () => {
  const broken: ModelList = {
    asOf: "2026-01-01",
    regions: [
      { provider: "anthropic", region: "", routings: null },
      { provider: "anthropic", region: "", routings: null },
      { provider: "vertex", region: "global", routings: ["global"] },
      { provider: "bedrock", region: "eu-west-1", routings: null },
      { provider: "bedrock", region: "us-east-1", routings: ["global", "geographic"] },
    ],
    models: [
      { id: "a", name: "A", family: "gemini", strings: { bedrock: "x" } },
      {
        id: "a",
        name: "A again",
        family: "claude",
        strings: { anthropic: "y" },
      },
      { id: "b", name: "B", family: "claude", strings: { anthropic: "y" } },
    ],
    prices: [
      {
        model: "b",
        provider: "anthropic",
        region: "",
        routing: null,
        price: P(1),
      },
      {
        model: "b",
        provider: "anthropic",
        region: "",
        routing: null,
        price: P(1),
      },
      {
        model: "c",
        provider: "anthropic",
        region: "",
        routing: null,
        price: P(1),
      },
      {
        model: "b",
        provider: "bedrock",
        region: "mars-1",
        routing: "global",
        price: P(-1),
      },
    ],
  };
  assert.deepEqual(listProblems(broken), [
    "Model a: the app doesn't support Gemini on Bedrock.",
    "Model a is listed twice.",
    "Models a and b have the same string on Anthropic: y.",
    'Region "" on Anthropic is listed twice.',
    "Region global on Vertex AI has routings, which only Bedrock has.",
    "Region eu-west-1 on Bedrock has no routings.",
    "Region us-east-1 on Bedrock routes geographically, but has no geography.",
    "Two prices for b on Anthropic.",
    "A price for c on Anthropic, a model not in the list.",
    "A price for b on Bedrock in mars-1 (global), but the model has no string there.",
    "A price for b on Bedrock in mars-1 (global), a place not in the list's regions.",
    "A price for b on Bedrock in mars-1 (global) isn't a number of dollars.",
    "Model a has a string on Bedrock but no price there.",
    "Model a has a string on Anthropic but no price there.",
  ]);
});

// Names are numbered when taken, and a numbered name must fit (decided 2026-11-17): every default name a listed model
// gives a config is at most 200 characters, so its numbered forms fit too.
test("the default name of every listed model, on every provider, at every effort, fits the limit", () => {
  let names = 0;
  for (const m of MODEL_LIST.models) {
    for (const provider of Object.keys(m.strings) as Provider[]) {
      const efforts = effortsOf(m.family, m);
      for (const effort of efforts.length > 0 ? efforts : [null]) {
        const name = configBaseName(MODEL_LIST, provider, { modelId: m.id }, effort);
        assert.ok(name.length <= MAX_NAME_LENGTH && !nameTooLong(`${name} (999)`), name);
        names++;
      }
    }
  }
  assert.ok(names > 0);
});

test("the pickers' options from a list (a guard of batch 21: the lookups under them changed, the options didn't)", async () => {
  const { modelOptions } = await import("../modelConfigs.ts");
  const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
  assert.equal(hash(modelOptions(LIST, false)), "56aee9037ce8de2269e7ff31267fb7b1057f8e1353c7e95bcf75060a9f8cbef2");
  assert.equal(hash(modelOptions(LIST, true)), "265cc99a5181a8f70a108dd4a990baf21fa9343c8f11817ac6f5577ea253dd4a");
});

test("a config priced by the provider is priced so, whatever the list has", () => {
  assert.deepEqual(priceOfConfig(LIST, { provider: "openrouter", model: { modelId: "big" }, place: NOWHERE, pricing: { kind: "provider" } }), { kind: "provider" });
});
