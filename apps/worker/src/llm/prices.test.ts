import { test } from "node:test";
import assert from "node:assert/strict";
import { costOf, fetchPriceRange, freeOnOpenRouter, priceRange } from "./prices.ts";

test("a call's cost: tokens × the prices per million, to the micro-dollar", () => {
  assert.equal(costOf({ inputTokens: 1000, outputTokens: 500, cacheReadTokens: 2000, cacheWriteTokens: 100 }, { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 }), 0.0149);
});

test("the price range: lowest and highest per million tokens among the providers, without the tiers asked for", async () => {
  const endpoints = [
    { tag: "amazon-bedrock", pricing: { prompt: "0.000004", completion: "0.00002", input_cache_read: "0.0000002", input_cache_write: "0.000005" } },
    { tag: "amazon-bedrock/eu-west-1", pricing: { prompt: "0.0000044", completion: "0.000022", input_cache_read: "0.00000022", input_cache_write: "0.0000055" } },
    { tag: "anthropic/fast", pricing: { prompt: "0.000008", completion: "0.00004", input_cache_read: "0.0000004", input_cache_write: "0.00001" } },
  ];
  const range = { input: [4, 4.4], output: [20, 22], cacheRead: [0.2, 0.22], cacheWrite: [5, 5.5] };
  assert.deepEqual(priceRange(endpoints), range);
  // No cache prices: none to pay.
  assert.deepEqual(priceRange([{ tag: "google-vertex", pricing: { prompt: "0.000002", completion: "0.000012" } }]), { input: [2, 2], output: [12, 12], cacheRead: [0, 0], cacheWrite: [0, 0] });
  assert.equal(priceRange([]), null);
  const calls: string[] = [];
  const fake = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(JSON.stringify({ data: { endpoints } }));
  }) as typeof fetch;
  assert.deepEqual(await fetchPriceRange("anthropic/claude-opus-5.5", "eu", fake, 1000), range);
  await fetchPriceRange("anthropic/claude-opus-5.5", "eu", fake, 2000); // kept
  assert.deepEqual(calls, ["https://eu.openrouter.ai/api/v1/models/anthropic/claude-opus-5.5/endpoints"]);
});

test("a model OpenRouter lists as free: all its prices 0; not free where they can't be read", async () => {
  const answering = (endpoints: unknown) => (async () => new Response(JSON.stringify({ data: { endpoints } }))) as unknown as typeof fetch;
  assert.equal(await freeOnOpenRouter("google/gemma-4:free", "", answering([{ tag: "chutes", pricing: { prompt: "0", completion: "0" } }]), 1), true);
  assert.equal(await freeOnOpenRouter("google/gemma-4", "", answering([{ tag: "chutes", pricing: { prompt: "0.0000001", completion: "0" } }]), 1), false);
  const unreachable = (async () => {
    throw new TypeError("fetch failed");
  }) as unknown as typeof fetch;
  assert.equal(await freeOnOpenRouter("google/gemma-5:free", "", unreachable, 1), false);
});

test("a price lookup that hangs is given up after its timeout: unreachable, not kept", async () => {
  let asked = 0;
  const hanging = ((_: unknown, init?: RequestInit) => {
    asked++;
    return new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)));
  }) as unknown as typeof fetch;
  // Node doesn't wait for the timeout's own timer (unref'd); a request in hand does.
  const keepAlive = setTimeout(() => {}, 1000);
  assert.equal(await fetchPriceRange("google/gemma-6", "", hanging, 1, 50), null);
  assert.equal(await fetchPriceRange("google/gemma-6", "", hanging, 2, 50), null);
  clearTimeout(keepAlive);
  assert.equal(asked, 2);
});
