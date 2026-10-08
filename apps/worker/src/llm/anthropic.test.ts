import { test } from "node:test";
import assert from "node:assert/strict";
import type { Message } from "@anthropic-ai/sdk/resources/messages";
import { AnthropicProvider, fromMessage } from "./anthropic.ts";
import { LlmError, type LlmRequest } from "./types.ts";

type Captured = { url: string; headers: Headers; body: any };

// A fetch that records the request and answers with a stream of server-sent events, as the API does.
function fakeFetch(events: object[], captured: Captured[], status = 200): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.push({ url: String(input), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    if (status !== 200) {
      return new Response(JSON.stringify({ type: "error", error: { type: "error", message: "nope" } }), {
        status,
        headers: { "content-type": "application/json" },
      });
    }
    const sse = events.map((e: any) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
    return new Response(sse, { status: 200, headers: { "content-type": "text/event-stream" } });
  }) as typeof fetch;
}

function answer(text: string, model = "claude-opus-5-5"): object[] {
  return [
    {
      type: "message_start",
      message: {
        id: "msg_1",
        type: "message",
        role: "assistant",
        model,
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 1200, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      },
    },
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } },
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 42 } },
    { type: "message_stop" },
  ];
}

const request: LlmRequest = {
  model: "claude-opus-5-5",
  system: "You read music.",
  messages: [
    {
      role: "user",
      content: [
        { type: "image", image: { mediaType: "image/png", base64: "iVBORw0KGgo=" } },
        { type: "text", text: "How many systems are on this page?" },
      ],
    },
  ],
  effort: "high",
  jsonSchema: { type: "object", properties: { systems: { type: "integer" } }, required: ["systems"] },
};

test("a request is sent as the Messages API expects, with the image first and no fallback model", async () => {
  const captured: Captured[] = [];
  const provider = new AnthropicProvider({ apiKey: "test-key", fetch: fakeFetch(answer('{"systems":6}'), captured) });
  await provider.send(request);
  const [{ url, headers, body }] = captured;
  assert.match(url, /\/v1\/messages/);
  assert.equal(headers.get("x-api-key"), "test-key");
  assert.equal(headers.get("anthropic-beta"), null);
  assert.equal(body.model, "claude-opus-5-5");
  assert.equal(body.system, "You read music.");
  assert.equal(body.stream, true);
  assert.equal(body.fallbacks, undefined);
  assert.deepEqual(body.output_config, { effort: "high", format: { type: "json_schema", schema: request.jsonSchema } });
  assert.deepEqual(body.messages[0].content[0], {
    type: "image",
    source: { type: "base64", media_type: "image/png", data: "iVBORw0KGgo=" },
  });
  assert.equal(body.thinking, undefined); // thinking stays the model's default (adaptive on current models)
});

test("the effort and the output format are only sent when asked for", async () => {
  const captured: Captured[] = [];
  const provider = new AnthropicProvider({ apiKey: "k", fetch: fakeFetch(answer("hi", "claude-haiku-5-5"), captured) });
  await provider.send({
    model: "claude-haiku-5-5",
    messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
  });
  assert.equal(captured[0].body.output_config, undefined);
});

test("an answer from another model than the one asked is an error", async () => {
  const provider = new AnthropicProvider({
    apiKey: "k",
    fetch: fakeFetch(answer('{"systems":6}', "claude-opus-5"), []),
  });
  await assert.rejects(
    provider.send(request),
    (err: unknown) => err instanceof LlmError && err.kind === "unexpected_model",
  );
});

test("the answer comes back with its text, parsed JSON and usage", async () => {
  const provider = new AnthropicProvider({ apiKey: "k", fetch: fakeFetch(answer('{"systems":6}'), []) });
  const response = await provider.send(request);
  assert.equal(response.provider, "anthropic");
  assert.equal(response.model, "claude-opus-5-5");
  assert.equal(response.stop, "end");
  assert.deepEqual(response.json, { systems: 6 });
  assert.deepEqual(response.usage, { inputTokens: 1200, outputTokens: 42, cacheReadTokens: 0, cacheWriteTokens: 0 });
});

test("an answer that should be JSON and isn't is an error", async () => {
  const provider = new AnthropicProvider({ apiKey: "k", fetch: fakeFetch(answer("six systems"), []) });
  await assert.rejects(
    provider.send(request),
    (err: unknown) => err instanceof LlmError && err.kind === "invalid_output",
  );
});

test("HTTP errors become typed errors that say whether to retry", async () => {
  for (const [status, kind, retryable] of [
    [401, "auth", false],
    [400, "bad_request", false],
    [429, "rate_limit", true],
    [529, "overloaded", true],
    [500, "server", true],
  ] as const) {
    const provider = new AnthropicProvider({ apiKey: "k", fetch: fakeFetch([], [], status), maxRetries: 0 });
    await assert.rejects(provider.send(request), (err: unknown) => {
      assert.ok(err instanceof LlmError);
      assert.deepEqual([err.kind, err.status, err.retryable], [kind, status, retryable]);
      return true;
    });
  }
});

test("a refusal says so, with its category", () => {
  const message = {
    model: "claude-opus-5-5",
    content: [],
    stop_reason: "refusal",
    stop_details: { type: "refusal", category: "cyber", explanation: null },
    usage: { input_tokens: 10, output_tokens: 0, cache_read_input_tokens: null, cache_creation_input_tokens: null },
  } as unknown as Message;
  const response = fromMessage(message);
  assert.equal(response.stop, "refusal");
  assert.equal(response.stopDetail, "cyber");
  assert.equal(response.text, "");
});
