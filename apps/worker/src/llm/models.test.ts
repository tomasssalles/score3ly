import { test } from "node:test";
import assert from "node:assert/strict";
import {
  configBaseName,
  listedPrice,
  listProblems,
  modelByString,
  modelsOf,
  modelString,
  placesOf,
  placesOfProvider,
  priceOfConfig,
  resolveModel,
  type ModelList,
} from "./models.ts";
import { adapterFor, supportedFamilies } from "./adapters.ts";
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

test("the app's list has no problems", () => {
  assert.deepEqual(listProblems(MODEL_LIST), []);

  assert.deepEqual(listProblems(LIST), []);
});

test("a model's string depends on the provider", () => {
  assert.equal(modelString(LIST, "big", "anthropic"), "claude-big");
  assert.equal(modelString(LIST, "big", "bedrock"), "anthropic.claude-big");
  assert.equal(modelString(LIST, "big", "vertex"), null);
  assert.equal(modelString(LIST, "nope", "anthropic"), null);
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

test("the pickers: a model's places, and the models at a place, without retired ones", () => {
  assert.deepEqual(placesOf(LIST, "big", "bedrock"), [EU_GLOBAL, EU_IN_REGION]);
  assert.deepEqual(
    modelsOf(LIST, "bedrock").map((m) => m.id),
    ["big", "small"],
  );
  assert.deepEqual(
    modelsOf(LIST, "bedrock", EU_IN_REGION).map((m) => m.id),
    ["big"],
  );
  assert.deepEqual(
    modelsOf(LIST, "anthropic").map((m) => m.id),
    ["big"],
  );
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
  assert.equal(
    configBaseName(MODEL_LIST, "bedrock", { modelId: "claude-opus-5-5" }, "high"),
    "Claude Opus 5.5 (Bedrock) · high",
  );
});

test("a provider's places come from the list's regions", () => {
  assert.deepEqual(placesOfProvider(LIST, "bedrock"), [
    EU_GLOBAL,
    { region: "eu-west-1", routing: "geographic" },
    EU_IN_REGION,
    { region: "us-east-1", routing: "global" },
  ]);
  assert.deepEqual(placesOfProvider(LIST, "anthropic"), [NOWHERE]);
  assert.deepEqual(placesOfProvider(LIST, "fake"), []);
  // The app's list has Bedrock's regions as AWS's model cards list them for bedrock-runtime.
  const bedrock = MODEL_LIST.regions.filter((r) => r.provider === "bedrock");
  assert.equal(bedrock.length, 35);
  assert.deepEqual(
    bedrock.find((r) => r.region === "eu-central-1"),
    { provider: "bedrock", region: "eu-central-1", routings: ["global", "geographic"], geography: "EU" },
  );
});

test("the supported pairs of provider and family are the adapters'", () => {
  assert.deepEqual(supportedFamilies("vertex"), ["gemini"]);
  assert.deepEqual(supportedFamilies("bedrock"), ["claude"]);
  assert.equal(adapterFor("vertex", "gemini"), "google-vertex");
  assert.equal(adapterFor("bedrock", "gemini"), null);
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
