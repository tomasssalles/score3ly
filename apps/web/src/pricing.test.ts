import { test } from "node:test";
import assert from "node:assert/strict";
import type { ModelConfig } from "./api";
import { dollars, pricingText } from "./pricing.ts";

test("prices per million tokens: whole dollars without cents, else at least the cents", () => {
  assert.equal(dollars(4), "$4");
  assert.equal(dollars(0.2), "$0.20");
  assert.equal(dollars(4.4), "$4.40");
  assert.equal(dollars(0.01), "$0.01");
  assert.equal(dollars(0.001), "$0.001");
  assert.equal(dollars(0.275), "$0.275");
});

test("a config's pricing: its four prices, borrowed or not, else free, unpriced or missing", () => {
  const priced = (price: ModelConfig["price"]) => pricingText({ price } as ModelConfig);
  const p = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 };
  assert.equal(priced({ kind: "priced", price: p, borrowedFrom: null }), "$4 input, $20 output, $0.20 cache read, $5 cache write, per million tokens");
  assert.match(priced({ kind: "priced", price: p, borrowedFrom: "Claude Opus 5.5" }), /per million tokens \(priced as Claude Opus 5\.5\)$/);
  assert.equal(priced({ kind: "free" }), "Free tier");
  assert.equal(priced({ kind: "unpriced" }), "Unpriced: its calls' costs are unknown");
  assert.equal(priced({ kind: "missing" }), "No price in the app's list");
});
