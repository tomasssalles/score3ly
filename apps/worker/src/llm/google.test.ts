import { test } from "node:test";
import assert from "node:assert/strict";
import { GoogleProvider, mergeChunks } from "./google.ts";
import { LlmError, type LlmRequest } from "./types.ts";

type Captured = { url: string; headers: Headers; body: any };

// Server-sent events, as Gemini streams its answer: one "data:" event per chunk.
export function sse(chunks: object[]): string {
  return chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\r\n\r\n`).join("");
}

// A successful reply is streamed: an object is sent as one chunk, a list as its chunks. An error is plain JSON.
function fakeFetch(reply: object | object[], captured: Captured[], status = 200): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    const body = input instanceof Request ? await input.text() : String(init?.body);
    const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
    captured.push({ url, headers, body: JSON.parse(body) });
    if (status !== 200) return new Response(JSON.stringify(reply), { status, headers: { "content-type": "application/json" } });
    return new Response(sse(Array.isArray(reply) ? reply : [reply]), { status, headers: { "content-type": "text/event-stream" } });
  }) as typeof fetch;
}

const request: LlmRequest = {
  model: "gemini-3-pro",
  system: "You read music.",
  messages: [
    {
      role: "user",
      content: [
        { type: "image", image: { mediaType: "image/jpeg", base64: "/9j/4AAQ" } },
        { type: "text", text: "How many systems?" },
      ],
    },
  ],
  maxOutputTokens: 8000,
  effort: "xhigh",
  jsonSchema: { type: "object", properties: { systems: { type: "integer" } }, required: ["systems"] },
};

const reply = {
  candidates: [
    {
      content: { role: "model", parts: [{ text: "thinking…", thought: true }, { text: '{"systems":6}' }] },
      finishReason: "STOP",
    },
  ],
  usageMetadata: {
    promptTokenCount: 1300,
    cachedContentTokenCount: 300,
    candidatesTokenCount: 12,
    thoughtsTokenCount: 500,
  },
  modelVersion: "gemini-3-pro",
};

test("a request is sent as the Gemini API expects", async () => {
  const captured: Captured[] = [];
  await new GoogleProvider({ apiKey: "g-key", fetch: fakeFetch(reply, captured) }).send(request);
  const [{ url, headers, body }] = captured;
  assert.match(url, /models\/gemini-3-pro:streamGenerateContent\?alt=sse/);
  assert.equal(headers.get("x-goog-api-key"), "g-key");
  assert.deepEqual(body.contents, [
    {
      role: "user",
      parts: [{ inlineData: { mimeType: "image/jpeg", data: "/9j/4AAQ" } }, { text: "How many systems?" }],
    },
  ]);
  assert.equal(body.systemInstruction.parts[0].text, "You read music.");
  assert.equal(body.generationConfig.maxOutputTokens, 8000);
  assert.equal(body.generationConfig.responseMimeType, "application/json");
  assert.deepEqual(body.generationConfig.responseJsonSchema, request.jsonSchema);
  assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, "HIGH");
  // Thought summaries, so the stream carries something while the model thinks (Cloudflare's 125 seconds).
  assert.equal(body.generationConfig.thinkingConfig.includeThoughts, true);
});

test("cache marks are accepted and left out: Gemini caches matching prefixes by itself", async () => {
  const captured: Captured[] = [];
  const marked: LlmRequest = {
    ...request,
    messages: [{ role: "user", content: request.messages[0].content.map((part) => ({ ...part, cacheUpTo: true as const })) }],
  };
  const response = await new GoogleProvider({ apiKey: "g-key", fetch: fakeFetch(reply, captured) }).send(marked);
  assert.deepEqual(response.json, { systems: 6 });
  assert.deepEqual(captured[0].body.contents[0].parts, [{ inlineData: { mimeType: "image/jpeg", data: "/9j/4AAQ" } }, { text: "How many systems?" }]);
});

test("the answer leaves out thoughts; cached tokens and thinking are counted where they are billed", async () => {
  const response = await new GoogleProvider({ apiKey: "k", fetch: fakeFetch(reply, []) }).send(request);
  assert.equal(response.text, '{"systems":6}');
  assert.deepEqual(response.json, { systems: 6 });
  assert.equal(response.stop, "end");
  assert.equal(response.model, "gemini-3-pro");
  assert.deepEqual(response.usage, { inputTokens: 1000, outputTokens: 512, cacheReadTokens: 300, cacheWriteTokens: 0 });
});

test("a blocked prompt or a safety stop is a refusal", async () => {
  const blocked = { promptFeedback: { blockReason: "SAFETY" }, usageMetadata: { promptTokenCount: 10 } };
  const response = await new GoogleProvider({ apiKey: "k", fetch: fakeFetch(blocked, []) }).send({
    ...request,
    jsonSchema: undefined,
  });
  assert.equal(response.stop, "refusal");
  assert.equal(response.stopDetail, "SAFETY");
});

test("HTTP errors become typed errors", async () => {
  for (const [status, kind] of [
    [403, "auth"],
    [429, "rate_limit"],
    [503, "overloaded"],
  ] as const) {
    const provider = new GoogleProvider({
      apiKey: "k",
      fetch: fakeFetch({ error: { code: status, message: "nope" } }, [], status),
    });
    await assert.rejects(provider.send(request), (err: unknown) => err instanceof LlmError && err.kind === kind);
  }
});

// The same answer as `reply`, in the pieces Gemini streams it in: thoughts, then the text, the usage at the end.
const chunks = [
  { candidates: [{ content: { role: "model", parts: [{ text: "think", thought: true }] } }], modelVersion: "gemini-3-pro" },
  { candidates: [{ content: { role: "model", parts: [{ text: "ing…", thought: true }] } }], modelVersion: "gemini-3-pro" },
  { candidates: [{ content: { role: "model", parts: [{ text: '{"syst' }] } }], modelVersion: "gemini-3-pro" },
  { candidates: [{ content: { role: "model", parts: [{ text: 'ems":6}' }] }, finishReason: "STOP" }], usageMetadata: reply.usageMetadata, modelVersion: "gemini-3-pro" },
];

test("a streamed answer is put together: its text, its thoughts left out, the last finish reason and usage", async () => {
  const response = await new GoogleProvider({ apiKey: "k", fetch: fakeFetch(chunks, []) }).send(request);
  assert.equal(response.text, '{"systems":6}');
  assert.deepEqual(response.json, { systems: 6 });
  assert.equal(response.stop, "end");
  assert.deepEqual(response.usage, { inputTokens: 1000, outputTokens: 512, cacheReadTokens: 300, cacheWriteTokens: 0 });
  // The record keeps one response, as `generateContent` would have answered.
  assert.deepEqual((response.raw as any).candidates[0].content.parts, [{ text: "thinking…", thought: true }, { text: '{"systems":6}' }]);
});

test("chunks put together: parts that aren't plain text are kept apart, and no chunks is unreadable", () => {
  const merged = mergeChunks([
    { candidates: [{ content: { parts: [{ text: "a", thoughtSignature: "sig" }] } }] },
    { candidates: [{ content: { parts: [{ text: "b" }] } }] },
    { candidates: [{ content: { parts: [{ text: "c" }] }, finishReason: "STOP" }] },
  ] as any);
  assert.deepEqual(merged.candidates?.[0].content?.parts, [{ text: "a", thoughtSignature: "sig" }, { text: "bc" }]);
  assert.equal(merged.candidates?.[0].finishReason, "STOP");
  assert.throws(() => mergeChunks([]), (err: unknown) => err instanceof LlmError && err.kind === "unreadable_response");
});

test("an error in the stream is a typed error; a stream cut short is unreadable", async () => {
  const failing = (async () =>
    new Response(sse([chunks[0]]) + 'data: {"error":{"code":503,"message":"overloaded","status":"UNAVAILABLE"}}\r\n\r\n', { status: 200 })) as unknown as typeof fetch;
  await assert.rejects(new GoogleProvider({ apiKey: "k", fetch: failing }).send(request), (err: unknown) => err instanceof LlmError && err.kind === "overloaded");
  const cut = (async () => new Response(sse([chunks[0]]) + 'data: {"candidates":[', { status: 200 })) as unknown as typeof fetch;
  await assert.rejects(new GoogleProvider({ apiKey: "k", fetch: cut }).send(request), (err: unknown) => err instanceof LlmError && err.kind === "unreadable_response");
  const empty = (async () => new Response("", { status: 200 })) as unknown as typeof fetch;
  await assert.rejects(new GoogleProvider({ apiKey: "k", fetch: empty }).send(request), (err: unknown) => err instanceof LlmError && err.kind === "unreadable_response");
});

test("a response that isn't JSON is unreadable, a failed fetch is the network", async () => {
  const broken = (async () => new Response("data: {broken\r\n\r\n", { status: 200, headers: { "content-type": "text/event-stream" } })) as unknown as typeof fetch;
  const offline = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
  for (const [fetch, kind] of [[broken, "unreadable_response"], [offline, "network"]] as const) {
    const provider = new GoogleProvider({ apiKey: "k", fetch });
    await assert.rejects(provider.send(request), (err: unknown) => err instanceof LlmError && err.kind === kind && err.status === undefined);
  }
});
