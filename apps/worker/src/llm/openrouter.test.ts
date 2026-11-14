import { test } from "node:test";
import assert from "node:assert/strict";
import { createProvider } from "./index.ts";
import { fetchPriceRange, freeOnOpenRouter, priceRange } from "./openrouter.ts";
import { LlmError, type LlmRequest } from "./types.ts";

type Call = { url: string; headers: Headers; body: any };

// A completion as OpenRouter streams it: a comment while it waits, the text in two deltas, the finish reason, the
// usage in the last chunk, then [DONE]. An error after the stream began is a chunk of its own.
function sse(answer: any): string {
  const events: unknown[] = [];
  if (answer.error) events.push({ error: answer.error });
  else {
    const choice = answer.choices[0];
    const content: string = choice.message.content ?? "";
    const half = Math.ceil(content.length / 2);
    const base = { id: answer.id, model: answer.model, provider: answer.provider };
    events.push({ ...base, choices: [{ delta: { role: "assistant", content: content.slice(0, half) }, finish_reason: null }] });
    events.push({ ...base, choices: [{ delta: { content: content.slice(half) }, finish_reason: null }] });
    events.push({ ...base, choices: [{ delta: {}, finish_reason: choice.finish_reason, native_finish_reason: choice.native_finish_reason }] });
    events.push({ ...base, choices: [], usage: answer.usage });
  }
  return [": OPENROUTER PROCESSING", "", ...events.flatMap((e) => [`data: ${JSON.stringify(e)}`, ""]), "data: [DONE]", ""].join("\n");
}

// OpenRouter's Chat Completions, faked: one streamed answer, or an HTTP error (plain JSON).
function fakeOpenRouter(calls: Call[], answer: unknown, status = 200): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    return status === 200
      ? new Response(sse(answer), { headers: { "content-type": "text/event-stream" } })
      : new Response(JSON.stringify(answer), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

const MODEL = "anthropic/claude-opus-5.5";

function completion(over: Record<string, unknown> = {}) {
  return {
    id: "gen-1",
    model: MODEL,
    provider: "Amazon Bedrock",
    choices: [{ message: { role: "assistant", content: '{"systems":6}' }, finish_reason: "stop", native_finish_reason: "end_turn" }],
    usage: { prompt_tokens: 1000, completion_tokens: 25, prompt_tokens_details: { cached_tokens: 200, cache_write_tokens: 100 }, cost: 0.0042 },
    ...over,
  };
}

const request: LlmRequest = {
  model: MODEL,
  system: "Read the page.",
  messages: [
    {
      role: "user",
      content: [
        { type: "image", image: { mediaType: "image/png", base64: "AAAA" }, cacheUpTo: true },
        { type: "text", text: "How many systems?" },
      ],
    },
  ],
  maxOutputTokens: 4000,
  effort: "high",
  jsonSchema: { type: "object", properties: { systems: { type: "integer" } }, required: ["systems"] },
};

const provider = (calls: Call[], answer: unknown, region = "", status = 200) =>
  createProvider({ provider: "openrouter", apiKey: "or-key", region }, { fetch: fakeOpenRouter(calls, answer, status) });

test("the request: Chat Completions with the key, the system prompt, images as data URLs, cache marks, effort, the schema, only providers that take every parameter", async () => {
  const calls: Call[] = [];
  await provider(calls, completion()).send(request);
  const [call] = calls;
  assert.equal(call.url, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(call.headers.get("authorization"), "Bearer or-key");
  assert.equal(call.body.model, MODEL);
  assert.equal(call.body.stream, true);
  assert.deepEqual(call.body.messages[0], { role: "system", content: "Read the page." });
  assert.deepEqual(call.body.messages[1].content, [
    { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" }, cache_control: { type: "ephemeral" } },
    { type: "text", text: "How many systems?" },
  ]);
  assert.equal(call.body.max_tokens, 4000);
  assert.deepEqual(call.body.reasoning, { effort: "high" });
  assert.deepEqual(call.body.response_format, { type: "json_schema", json_schema: { name: "answer", strict: true, schema: request.jsonSchema } });
  assert.deepEqual(call.body.provider, { require_parameters: true });
  assert.equal(call.body.models, undefined); // never another model
});

test("the EU region goes to eu.openrouter.ai", async () => {
  const calls: Call[] = [];
  await provider(calls, completion(), "eu").send(request);
  assert.equal(calls[0].url, "https://eu.openrouter.ai/api/v1/chat/completions");
});

test("the answer, put together from the stream: text and JSON, tokens without the cached ones, the reported cost and who served it", async () => {
  const response = await provider([], completion()).send(request);
  assert.equal(response.provider, "openrouter");
  assert.equal(response.stop, "end");
  assert.deepEqual(response.json, { systems: 6 });
  assert.deepEqual(response.usage, { inputTokens: 700, outputTokens: 25, cacheReadTokens: 200, cacheWriteTokens: 100 });
  assert.equal(response.reportedCostUsd, 0.0042);
  assert.equal(response.servedBy, "Amazon Bedrock");
});

test("the model check takes the model asked or its dated slug, and nothing else", async () => {
  assert.equal((await provider([], completion({ model: `${MODEL}-20260921` })).send(request)).unexpectedModel, undefined);
  const other = await provider([], completion({ model: "anthropic/claude-sonnet-5.5" })).send(request);
  assert.match(other.unexpectedModel ?? "", /but anthropic\/claude-sonnet-5\.5 answered/);
  assert.equal(other.json, undefined);
});

test("stops: cut off, refused", async () => {
  const cut = await provider([], completion({ choices: [{ message: { content: '{"sys' }, finish_reason: "length" }] })).send(request);
  assert.equal(cut.stop, "max_tokens");
  const refused = await provider([], completion({ choices: [{ message: { content: "" }, finish_reason: "stop", native_finish_reason: "refusal" }] })).send(request);
  assert.equal(refused.stop, "refusal");
  const filtered = await provider([], completion({ choices: [{ message: { content: "" }, finish_reason: "content_filter" }] })).send(request);
  assert.equal(filtered.stop, "refusal");
});

test("errors: an HTTP error by its status, an error after a 200, no key", async () => {
  await assert.rejects(provider([], { error: { code: 402, message: "Insufficient credits" } }, "", 402).send(request), (e: LlmError) => e.kind === "bad_request" && e.status === 402);
  await assert.rejects(provider([], { error: { code: 429, message: "slow down" } }, "", 429).send(request), (e: LlmError) => e.kind === "rate_limit");
  await assert.rejects(provider([], { error: { code: 502, message: "upstream" } }).send(request), (e: LlmError) => e.kind === "server" && e.status === 502);
  assert.throws(() => createProvider({ provider: "openrouter", apiKey: "", region: "" }), LlmError);
});

test("a provider's refusal: its name and its own message, from the error's metadata", async () => {
  // As OpenRouter answered extract's request on Claude (2026-11-09).
  const raw = JSON.stringify({
    type: "error",
    error: { type: "invalid_request_error", message: "The compiled grammar is too large, which would cause performance issues. Simplify your tool schemas or reduce the number of strict tools." },
    request_id: "req_vrtx_011CgsLK3Cx5B5m2ZBiWAAFr",
  });
  const body = { error: { message: "Provider returned error", code: 400, metadata: { raw, provider_name: "Google", is_byok: false } }, user_id: "user_1" };
  await assert.rejects(
    provider([], body, "", 400).send(request),
    (e: LlmError) =>
      e.kind === "bad_request" &&
      e.message === "OpenRouter answered 400: Provider returned error (Google): The compiled grammar is too large, which would cause performance issues. Simplify your tool schemas or reduce the number of strict tools.",
  );
  // The same after the stream began; a raw body that isn't JSON is taken as it is.
  await assert.rejects(
    provider([], { error: { message: "Provider returned error", code: 502, metadata: { raw: "upstream timed out", provider_name: "Anthropic" } } }).send(request),
    (e: LlmError) => e.message === "OpenRouter: Provider returned error (Anthropic): upstream timed out",
  );
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

test("progress as the chunks arrive: the answer's characters, and the output tokens once the usage has come", async () => {
  const seen: { textChars: number; outputTokens?: number }[] = [];
  await provider([], completion()).send(request, undefined, (p) => seen.push(p));
  assert.deepEqual(seen.map((p) => p.textChars), [7, 13, 13, 13]);
  assert.equal(seen.at(-1)!.outputTokens, 25);
  assert.equal(seen[0].outputTokens, undefined);
});
