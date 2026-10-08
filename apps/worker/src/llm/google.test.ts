import { test } from "node:test";
import assert from "node:assert/strict";
import { GoogleProvider } from "./google.ts";
import { LlmError, type LlmRequest } from "./types.ts";

type Captured = { url: string; headers: Headers; body: any };

function fakeFetch(reply: object, captured: Captured[], status = 200): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    const body = input instanceof Request ? await input.text() : String(init?.body);
    const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
    captured.push({ url, headers, body: JSON.parse(body) });
    return new Response(JSON.stringify(reply), { status, headers: { "content-type": "application/json" } });
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
  assert.match(url, /models\/gemini-3-pro:generateContent/);
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
});

test("the answer leaves out thoughts; cached tokens and thinking are counted where they are billed", async () => {
  const response = await new GoogleProvider({ apiKey: "k", fetch: fakeFetch(reply, []) }).send(request);
  assert.equal(response.text, '{"systems":6}');
  assert.deepEqual(response.json, { systems: 6 });
  assert.equal(response.stop, "end");
  assert.deepEqual(response.usage, [
    { model: "gemini-3-pro", inputTokens: 1000, outputTokens: 512, cacheReadTokens: 300, cacheWriteTokens: 0 },
  ]);
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
