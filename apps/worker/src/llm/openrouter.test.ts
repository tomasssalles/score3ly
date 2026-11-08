import { test } from "node:test";
import assert from "node:assert/strict";
import { createProvider } from "./index.ts";
import { LlmError, type LlmRequest } from "./types.ts";

type Call = { url: string; headers: Headers; body: any };

// OpenRouter's Chat Completions, faked: one answer, or an HTTP error.
function fakeOpenRouter(calls: Call[], answer: unknown, status = 200): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify(answer), { status, headers: { "content-type": "application/json" } });
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

test("the answer: text and JSON, tokens without the cached ones, the reported cost and who served it", async () => {
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
