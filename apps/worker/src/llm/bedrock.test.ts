import { test } from "node:test";
import assert from "node:assert/strict";
import { bedrockClaudeProvider } from "./anthropic.ts";
import { createProvider } from "./index.ts";
import { LlmError, type LlmRequest } from "./types.ts";

type Call = { url: string; headers: Headers; body: any };

// Bedrock's Messages API endpoint, faked: a stream of server-sent events naming `model`.
function fakeBedrock(calls: Call[], model: string): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    const events = [
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
          usage: { input_tokens: 700, output_tokens: 1 },
        },
      },
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: '{"systems":6}' } },
      { type: "content_block_stop", index: 0 },
      { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 25 } },
      { type: "message_stop" },
    ];
    const sse = events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
    return new Response(sse, { headers: { "content-type": "text/event-stream" } });
  }) as typeof fetch;
}

const MODEL = "eu.anthropic.claude-opus-5-5";

const request: LlmRequest = {
  model: MODEL,
  messages: [{ role: "user", content: [{ type: "text", text: "How many systems?" }] }],
  effort: "high",
  jsonSchema: { type: "object", properties: { systems: { type: "integer" } }, required: ["systems"] },
};

test("with a Bedrock API key: the region's endpoint, the key as a bearer token, the model as given", async () => {
  const calls: Call[] = [];
  const provider = createProvider(
    { provider: "anthropic-bedrock", region: "eu-central-1", apiKey: "bedrock-key" },
    { fetch: fakeBedrock(calls, MODEL) },
  );
  const response = await provider.send(request);
  const [call] = calls;
  assert.equal(call.url, "https://bedrock-mantle.eu-central-1.api.aws/anthropic/v1/messages");
  assert.equal(call.headers.get("authorization"), "Bearer bedrock-key");
  assert.equal(call.body.model, MODEL);
  assert.equal(call.body.output_config.effort, "high");
  assert.equal(response.provider, "anthropic-bedrock");
  assert.equal(response.model, MODEL);
  assert.deepEqual(response.json, { systems: 6 });
  assert.deepEqual(response.usage, { inputTokens: 700, outputTokens: 25, cacheReadTokens: 0, cacheWriteTokens: 0 });
});

test("with an access key pair: the request is signed (AWS Signature V4) for the region", async () => {
  const calls: Call[] = [];
  const provider = createProvider(
    { provider: "anthropic-bedrock", region: "eu-west-1", accessKeyId: "AKIAEXAMPLE", secretAccessKey: "secret" },
    { fetch: fakeBedrock(calls, MODEL) },
  );
  await provider.send(request);
  const auth = calls[0].headers.get("authorization") ?? "";
  assert.match(auth, /^AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE\/\d{8}\/eu-west-1\/bedrock-mantle\/aws4_request, /);
  assert.ok(calls[0].headers.get("x-amz-date"));
  assert.match(calls[0].url, /^https:\/\/bedrock-mantle\.eu-west-1\.api\.aws\//);
});

test("the model check compares the answer's model with the string as given", async () => {
  // An inference profile asked for, the bare model ID in the answer: an error, until a real answer shows otherwise.
  const provider = createProvider(
    { provider: "anthropic-bedrock", region: "eu-central-1", apiKey: "k" },
    { fetch: fakeBedrock([], "anthropic.claude-opus-5-5") },
  );
  await assert.rejects(
    provider.send(request),
    (err: unknown) => err instanceof LlmError && err.kind === "unexpected_model",
  );
});

test("Bedrock needs an API key or a whole key pair, not both nor neither", () => {
  for (const credentials of [
    {},
    { apiKey: "k", accessKeyId: "a", secretAccessKey: "s" },
    { accessKeyId: "a" },
    { secretAccessKey: "s" },
  ]) {
    assert.throws(() => bedrockClaudeProvider({ region: "eu-central-1", ...credentials }), LlmError);
  }
});
