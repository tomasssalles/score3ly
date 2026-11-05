// A stand-in for the generated list of models and prices (docs/llm.md, "The list of models and prices"), until the
// script's first output (§15, "Generate the shipped price list"). Its shape is the real one; its contents are a few
// models on every provider, so the app runs with it:
// - Claude's prices are Anthropic's list prices (2026-10); on Bedrock, global routing at those prices and geographic
//   or in-region routing at 10% more, as AWS's price list has them for Opus 5.5 (2026-11-04); on Vertex AI, `global`
//   at the list prices and other locations at 10% more. Which regions serve which model is a sample, not checked.
// - Gemini's strings and prices are made up in the right range: not Google's.
// - The fake models: free ("fake") and with made-up prices ("fake-dev"), as before.

import type { Price } from "./prices.ts";
import type { ModelList, PriceEntry, Provider, Routing } from "./models.ts";

// Cache writes are 1.25 × the input price (Claude's 5-minute cache); Gemini's implicit caching has no write price.
function claude(input: number, output: number, cacheRead: number): Price {
  return { input, output, cacheRead, cacheWrite: input * 1.25 };
}
function gemini(input: number, output: number, cacheRead: number): Price {
  return { input, output, cacheRead, cacheWrite: 0 };
}
// The 10% premium of regional endpoints, rounded to a millionth of a dollar against floating-point noise.
function regional(price: Price): Price {
  const up = (v: number) => Math.round(v * 1.1 * 1e6) / 1e6;
  return {
    input: up(price.input),
    output: up(price.output),
    cacheRead: up(price.cacheRead),
    cacheWrite: up(price.cacheWrite),
  };
}

const OPUS = claude(4, 20, 0.2);
const SONNET = claude(2, 10, 0.2);
const HAIKU = claude(0.1, 0.5, 0.01);
const FABLE = claude(10, 50, 0.25);
const GEMINI_PRO = gemini(2, 12, 0.2);
const GEMINI_FLASH = gemini(0.5, 3, 0.05);

function at(
  model: string,
  provider: Provider,
  region: string,
  routing: Routing | null,
  price: Price,
): PriceEntry {
  return { model, provider, region, routing, price };
}

// Bedrock in a few regions: global at the list price; geographic and in-region (where the region has them) at 10% more.
function bedrock(
  model: string,
  price: Price,
  regions: [string, Routing[]][],
): PriceEntry[] {
  return regions.flatMap(([region, routings]) =>
    routings.map((routing) =>
      at(
        model,
        "bedrock",
        region,
        routing,
        routing === "global" ? price : regional(price),
      ),
    ),
  );
}

const EU_AND_US: [string, Routing[]][] = [
  ["eu-central-1", ["global", "geographic"]],
  ["eu-west-1", ["global", "geographic", "in-region"]],
  ["us-east-1", ["global", "geographic", "in-region"]],
];

export const MOCK_MODEL_LIST: ModelList = {
  asOf: "2026-11-05",
  mock: true,
  models: [
    {
      id: "claude-opus-5-5",
      name: "Claude Opus 5.5",
      family: "claude",
      strings: {
        anthropic: "claude-opus-5-5",
        bedrock: "anthropic.claude-opus-5-5",
        vertex: "claude-opus-5-5",
      },
    },
    {
      id: "claude-sonnet-5-5",
      name: "Claude Sonnet 5.5",
      family: "claude",
      strings: {
        anthropic: "claude-sonnet-5-5",
        bedrock: "anthropic.claude-sonnet-5-5",
        vertex: "claude-sonnet-5-5",
      },
    },
    {
      id: "claude-haiku-5-5",
      name: "Claude Haiku 5.5",
      family: "claude",
      strings: {
        anthropic: "claude-haiku-5-5",
        bedrock: "anthropic.claude-haiku-5-5",
        vertex: "claude-haiku-5-5",
      },
    },
    {
      id: "claude-fable-5-1",
      name: "Claude Fable 5.1",
      family: "claude",
      strings: {
        anthropic: "claude-fable-5-1",
        bedrock: "anthropic.claude-fable-5-1",
      },
    },
    {
      id: "gemini-3-1-pro",
      name: "Gemini 3.1 Pro",
      family: "gemini",
      strings: { "ai-studio": "gemini-3.1-pro", vertex: "gemini-3.1-pro" },
    },
    {
      id: "gemini-3-flash",
      name: "Gemini 3 Flash",
      family: "gemini",
      strings: { "ai-studio": "gemini-3-flash", vertex: "gemini-3-flash" },
    },
    {
      id: "fake",
      name: "Fake model",
      family: "fake",
      strings: { fake: "fake", "fake-dev": "fake" },
    },
  ],
  prices: [
    at("claude-opus-5-5", "anthropic", "", null, OPUS),
    at("claude-sonnet-5-5", "anthropic", "", null, SONNET),
    at("claude-haiku-5-5", "anthropic", "", null, HAIKU),
    at("claude-fable-5-1", "anthropic", "", null, FABLE),

    ...bedrock("claude-opus-5-5", OPUS, EU_AND_US),
    ...bedrock("claude-sonnet-5-5", SONNET, EU_AND_US),
    ...bedrock("claude-haiku-5-5", HAIKU, EU_AND_US),
    // Fable 5.1: regional only in us-east-1 (Anthropic's page).
    ...bedrock("claude-fable-5-1", FABLE, [
      ["eu-central-1", ["global"]],
      ["eu-west-1", ["global"]],
      ["us-east-1", ["global", "geographic", "in-region"]],
    ]),

    // Vertex AI: Opus 5.5 isn't served in Europe there (checked 2026-10-09).
    at("claude-opus-5-5", "vertex", "global", null, OPUS),
    at("claude-opus-5-5", "vertex", "us-east5", null, regional(OPUS)),
    at("claude-sonnet-5-5", "vertex", "global", null, SONNET),
    at("claude-sonnet-5-5", "vertex", "europe-west1", null, regional(SONNET)),
    at("claude-sonnet-5-5", "vertex", "us-east5", null, regional(SONNET)),
    at("claude-haiku-5-5", "vertex", "global", null, HAIKU),
    at("claude-haiku-5-5", "vertex", "europe-west1", null, regional(HAIKU)),
    at("gemini-3-1-pro", "vertex", "global", null, GEMINI_PRO),
    at("gemini-3-1-pro", "vertex", "europe-west1", null, GEMINI_PRO),
    at("gemini-3-flash", "vertex", "global", null, GEMINI_FLASH),
    at("gemini-3-flash", "vertex", "europe-west1", null, GEMINI_FLASH),

    at("gemini-3-1-pro", "ai-studio", "", null, GEMINI_PRO),
    at("gemini-3-flash", "ai-studio", "", null, GEMINI_FLASH),

    at("fake", "fake", "", null, {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    }),
    at("fake", "fake-dev", "", null, {
      input: 1,
      output: 5,
      cacheRead: 0.1,
      cacheWrite: 1.25,
    }),
  ],
};
