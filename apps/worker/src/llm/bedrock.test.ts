import { test } from "node:test";
import { crc32 } from "node:zlib";
import assert from "node:assert/strict";
import { bedrockClaudeProvider } from "./anthropic.ts";
import { bedrockModel, createAdapter, createProvider } from "./index.ts";
import { LlmError, type LlmRequest } from "./types.ts";

type Call = { url: string; headers: Headers; body: any };

// One message of AWS's event stream (the binary framing of `bedrock-runtime`'s streamed answers): a prelude (total and
// headers' lengths, its CRC32), the headers (all strings), the payload, the whole message's CRC32.
function eventStreamMessage(headers: Record<string, string>, payload: Uint8Array): Uint8Array {
  const enc = new TextEncoder();
  const headerBytes = Buffer.concat(
    Object.entries(headers).map(([name, value]) => {
      const n = enc.encode(name);
      const v = enc.encode(value);
      const out = Buffer.alloc(1 + n.length + 1 + 2 + v.length);
      out.writeUInt8(n.length, 0);
      out.set(n, 1);
      out.writeUInt8(7, 1 + n.length); // the type: a string
      out.writeUInt16BE(v.length, 2 + n.length);
      out.set(v, 4 + n.length);
      return out;
    }),
  );
  const total = 12 + headerBytes.length + payload.length + 4;
  const message = Buffer.alloc(total);
  message.writeUInt32BE(total, 0);
  message.writeUInt32BE(headerBytes.length, 4);
  message.writeUInt32BE(crc32(message.subarray(0, 8)), 8);
  message.set(headerBytes, 12);
  message.set(payload, 12 + headerBytes.length);
  message.writeUInt32BE(crc32(message.subarray(0, total - 4)), total - 4);
  return message;
}

// `bedrock-runtime`, faked: InvokeModelWithResponseStream's answer, Claude's stream events as chunks, naming `model`.
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
    const headers = { ":event-type": "chunk", ":content-type": "application/json", ":message-type": "event" };
    const body = Buffer.concat(
      events.map((e) => {
        const bytes = Buffer.from(JSON.stringify(e)).toString("base64");
        return eventStreamMessage(headers, new TextEncoder().encode(JSON.stringify({ bytes })));
      }),
    );
    return new Response(body, { headers: { "content-type": "application/vnd.amazon.eventstream" } });
  }) as typeof fetch;
}

const MODEL = "eu.anthropic.claude-opus-5-5";
const RUNTIME = "https://bedrock-runtime.eu-central-1.amazonaws.com";

const request: LlmRequest = {
  model: MODEL,
  messages: [{ role: "user", content: [{ type: "text", text: "How many systems?" }] }],
  effort: "high",
  jsonSchema: { type: "object", properties: { systems: { type: "integer" } }, required: ["systems"] },
};

test("with a Bedrock API key: the region's bedrock-runtime, the model in the path, the key as a bearer token", async () => {
  const calls: Call[] = [];
  const provider = createProvider(
    { provider: "anthropic-bedrock", region: "eu-central-1", apiKey: "bedrock-key" },
    { fetch: fakeBedrock(calls, MODEL) },
  );
  const response = await provider.send(request);
  const [call] = calls;
  assert.equal(call.url, `${RUNTIME}/model/${MODEL}/invoke-with-response-stream`);
  assert.equal(call.headers.get("authorization"), "Bearer bedrock-key");
  assert.equal(call.body.model, undefined);
  assert.equal(call.body.anthropic_version, "bedrock-2023-05-31");
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
  assert.match(auth, /^AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE\/\d{8}\/eu-west-1\/bedrock\/aws4_request, /);
  assert.ok(calls[0].headers.get("x-amz-date"));
  assert.match(calls[0].url, /^https:\/\/bedrock-runtime\.eu-west-1\.amazonaws\.com\/model\//);
});

test("the model check takes the answer's model with or without the routing's prefix, and nothing else", async () => {
  // An inference profile asked for ("eu."), the bare model ID in the answer: the same model.
  const bare = createProvider({ provider: "anthropic-bedrock", region: "eu-central-1", apiKey: "k" }, { fetch: fakeBedrock([], "anthropic.claude-opus-5-5") });
  assert.equal((await bare.send(request)).unexpectedModel, undefined);
  const other = createProvider({ provider: "anthropic-bedrock", region: "eu-central-1", apiKey: "k" }, { fetch: fakeBedrock([], "anthropic.claude-sonnet-5-5") });
  assert.match((await other.send(request)).unexpectedModel ?? "", /but anthropic\.claude-sonnet-5-5 answered/);
});

test("the routing becomes the model string's prefix", () => {
  const id = "anthropic.claude-haiku-4-5-20251001-v1:0";
  assert.equal(bedrockModel(id, "global", "EU"), `global.${id}`);
  assert.equal(bedrockModel(id, "geographic", "EU"), `eu.${id}`);
  assert.equal(bedrockModel(id, "in-region", "EU"), id);
});

test("an adapter for each supported pair, none for the others", () => {
  const secrets = { apiKey: "k" };
  assert.equal(createAdapter({ provider: "bedrock", family: "claude", region: "eu-west-1", project: null, secrets })?.id, "anthropic-bedrock");
  assert.equal(createAdapter({ provider: "ai-studio", family: "gemini", region: "", project: null, secrets })?.id, "google");
  assert.equal(createAdapter({ provider: "fake-dev", family: "fake", region: "", project: null, secrets: {} })?.id, "fake-dev");
  assert.equal(createAdapter({ provider: "bedrock", family: "gemini", region: "eu-west-1", project: null, secrets }), null);
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
