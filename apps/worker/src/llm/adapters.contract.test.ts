// The contract every provider's adapter keeps (docs/llm.md, "Calling the providers"): the same events on the wire, each
// in its provider's own format, give the same response or the same kind of error, on Claude (Anthropic's API, through
// its SDK), Gemini (AI Studio and Vertex AI) and OpenRouter. The route records the kind as the call's `error_kind`
// (the Usage tab's reasons) and its HTTP status as `http_status` (whether the call was billed), so a provider that
// told one apart differently would count the same failure differently.

import { test } from "node:test";
import assert from "node:assert/strict";
import { sseData } from "@score3ly/core";
import { createAdapter, type AdapterSettings } from "./index.ts";
import { LlmError, type LlmErrorKind, type LlmRequest, type LlmResponse } from "./types.ts";

type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number };
type Stop = "end" | "max_tokens" | "refusal";

// What the provider does, said once for every adapter.
type Scenario =
  | { kind: "answer"; text: string; stop: Stop; usage: Usage }
  | { kind: "status"; status: number } // an HTTP error before anything was streamed
  | { kind: "stream error"; code: number } // an error sent as an event, after a first piece of the answer
  | { kind: "cut" } // the connection breaks after a first piece
  | { kind: "ends early" } // the stream ends cleanly after a first piece, without the answer's end
  | { kind: "broken" } // an event that isn't JSON, after a first piece
  | { kind: "offline" } // fetch fails: no connection
  | { kind: "abort" }; // the caller's signal, after a first piece

// One provider's wire format: the events of an answer, of a first piece, of an error in the stream, and the body of an
// HTTP error.
type Wire = {
  settings: Omit<AdapterSettings, "secrets"> & { secrets: Record<string, string> };
  model: string;
  cacheWrites: boolean; // whether the provider reports cache writes (Gemini doesn't)
  answer(text: string, stop: Stop, usage: Usage): string;
  first: string;
  streamError(code: number): string;
  errorBody(status: number): string;
};

const ev = (e: { type: string }) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`;
const claudeStart = (usage: Usage) => ({
  type: "message_start",
  message: { id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: usage.input, output_tokens: 1, cache_read_input_tokens: usage.cacheRead, cache_creation_input_tokens: usage.cacheWrite } },
});
const CLAUDE_STOPS: Record<Stop, string> = { end: "end_turn", max_tokens: "max_tokens", refusal: "refusal" };
const CLAUDE_ERRORS: Record<number, string> = { 400: "invalid_request_error", 401: "authentication_error", 429: "rate_limit_error", 500: "api_error", 529: "overloaded_error" };

const claude: Wire = {
  settings: { provider: "anthropic", family: "claude", region: "", project: null, secrets: { apiKey: "k" } },
  model: "claude-opus-5-5",
  cacheWrites: true,
  answer: (text, stop, usage) =>
    [
      claudeStart(usage),
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } },
      { type: "content_block_stop", index: 0 },
      { type: "message_delta", delta: { stop_reason: CLAUDE_STOPS[stop], stop_sequence: null }, usage: { output_tokens: usage.output } },
      { type: "message_stop" },
    ].map(ev).join(""),
  first: [claudeStart({ input: 1, output: 1, cacheRead: 0, cacheWrite: 0 }), { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }, { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Six" } }].map(ev).join(""),
  streamError: (code) => ev({ type: "error", error: { type: CLAUDE_ERRORS[code], message: "In the stream." } } as { type: string }),
  errorBody: (status) => JSON.stringify({ type: "error", error: { type: CLAUDE_ERRORS[status] ?? "api_error", message: "Refused." } }),
};

const GEMINI_STOPS: Record<Stop, string> = { end: "STOP", max_tokens: "MAX_TOKENS", refusal: "SAFETY" };
function gemini(settings: Wire["settings"]): Wire {
  return {
    settings,
    model: "gemini-4-argon",
    cacheWrites: false,
    answer: (text, stop, usage) =>
      sseData({ candidates: [{ content: { role: "model", parts: [{ text: text.slice(0, 3) }] } }] }) +
      sseData({
        candidates: [{ content: { role: "model", parts: [{ text: text.slice(3) }] }, finishReason: GEMINI_STOPS[stop] }],
        usageMetadata: { promptTokenCount: usage.input + usage.cacheRead, cachedContentTokenCount: usage.cacheRead, candidatesTokenCount: usage.output },
        modelVersion: "gemini-4-argon",
      }),
    first: sseData({ candidates: [{ content: { role: "model", parts: [{ text: "Six" }] } }] }),
    streamError: (code) => sseData({ error: { code, message: "In the stream.", status: "RESOURCE_EXHAUSTED" } }),
    errorBody: (status) => JSON.stringify({ error: { code: status, message: "Refused.", status: "X" } }),
  };
}

const OPENROUTER_STOPS: Record<Stop, string> = { end: "stop", max_tokens: "length", refusal: "content_filter" };
const openRouter: Wire = {
  settings: { provider: "openrouter", family: "claude", region: "", project: null, secrets: { apiKey: "k" } },
  model: "anthropic/claude-opus-5.5",
  cacheWrites: true,
  answer: (text, stop, usage) =>
    [
      { model: "anthropic/claude-opus-5.5", choices: [{ delta: { content: text.slice(0, 3) }, finish_reason: null }] },
      { model: "anthropic/claude-opus-5.5", choices: [{ delta: { content: text.slice(3) }, finish_reason: OPENROUTER_STOPS[stop] }] },
      { model: "anthropic/claude-opus-5.5", choices: [], usage: { prompt_tokens: usage.input + usage.cacheRead + usage.cacheWrite, completion_tokens: usage.output, prompt_tokens_details: { cached_tokens: usage.cacheRead, cache_write_tokens: usage.cacheWrite } } },
      "[DONE]",
    ].map(sseData).join(""),
  first: sseData({ model: "anthropic/claude-opus-5.5", choices: [{ delta: { content: "Six" }, finish_reason: null }] }),
  streamError: (code) => sseData({ error: { code, message: "In the stream." } }),
  errorBody: (status) => JSON.stringify({ error: { code: status, message: "Refused." } }),
};

// A key file whose key is made once: only the faked token endpoint sees what is signed with it.
const keys = (await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign"])) as CryptoKeyPair;
const pem = `-----BEGIN PRIVATE KEY-----\n${Buffer.from((await crypto.subtle.exportKey("pkcs8", keys.privateKey)) as ArrayBuffer).toString("base64")}\n-----END PRIVATE KEY-----\n`;
const SERVICE_ACCOUNT = JSON.stringify({ type: "service_account", project_id: "p", client_email: "c@p.iam.gserviceaccount.com", private_key: pem, token_uri: "https://oauth2.googleapis.com/token" });

const WIRES: [string, Wire][] = [
  ["Claude", claude],
  ["Gemini API", gemini({ provider: "ai-studio", family: "gemini", region: "", project: null, secrets: { apiKey: "k" } })],
  ["Vertex AI", gemini({ provider: "vertex", family: "gemini", region: "eu", project: null, secrets: { serviceAccount: SERVICE_ACCOUNT } })],
  ["OpenRouter", openRouter],
];

const encode = (text: string) => new TextEncoder().encode(text);

// A fetch that plays the scenario in the wire's format.
function playing(wire: Wire, scenario: Scenario): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "t", expires_in: 3600, token_type: "Bearer" });
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    if (scenario.kind === "offline") throw new TypeError("fetch failed");
    if (signal?.aborted) throw new DOMException("This operation was aborted", "AbortError");
    const stream = { status: 200, headers: { "content-type": "text/event-stream" } };
    switch (scenario.kind) {
      case "answer":
        return new Response(wire.answer(scenario.text, scenario.stop, scenario.usage), stream);
      case "status":
        return new Response(wire.errorBody(scenario.status), { status: scenario.status, headers: { "content-type": "application/json" } });
      case "stream error":
        return new Response(wire.first + wire.streamError(scenario.code), stream);
      case "ends early":
        return new Response(wire.first, stream);
      case "broken":
        return new Response(wire.first + "data: {broken\n\n", stream);
      case "cut":
      case "abort":
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(encode(wire.first));
              if (scenario.kind === "cut") setTimeout(() => controller.error(new TypeError("terminated")), 5);
              else signal?.addEventListener("abort", () => controller.error(new DOMException("This operation was aborted", "AbortError")));
            },
          }),
          stream,
        );
    }
  }) as typeof fetch;
}

async function play(wire: Wire, scenario: Scenario, request: Partial<LlmRequest> = {}): Promise<LlmResponse | LlmError> {
  const adapter = createAdapter(wire.settings, { fetch: playing(wire, scenario) })!;
  const controller = new AbortController();
  if (scenario.kind === "abort") setTimeout(() => controller.abort(), 20);
  try {
    return await adapter.send({ model: wire.model, messages: [{ role: "user", content: [{ type: "text", text: "How many systems?" }] }], maxOutputTokens: 100, ...request }, controller.signal);
  } catch (err) {
    assert.ok(err instanceof LlmError, `an LlmError, not ${String(err)}`);
    return err;
  }
}

const USAGE: Usage = { input: 1000, output: 50, cacheRead: 300, cacheWrite: 200 };

for (const [name, wire] of WIRES) {
  test(`${name}: an answer, its stop and its usage (cache reads and writes apart from the input)`, async () => {
    for (const stop of ["end", "max_tokens", "refusal"] as const) {
      const response = await play(wire, { kind: "answer", text: "Six systems.", stop, usage: USAGE });
      assert.ok(!(response instanceof LlmError), String(response));
      assert.equal(response.text, "Six systems.");
      assert.equal(response.stop, stop);
      assert.deepEqual(response.usage, { inputTokens: 1000, outputTokens: 50, cacheReadTokens: 300, cacheWriteTokens: wire.cacheWrites ? 200 : 0 });
      assert.equal(response.json, undefined);
    }
  });

  test(`${name}: with a schema, a finished answer is parsed, or says why it can't be`, async () => {
    const schema = { request: { jsonSchema: { type: "object" } } };
    const parsed = await play(wire, { kind: "answer", text: '{"systems":6}', stop: "end", usage: USAGE }, schema.request);
    assert.ok(!(parsed instanceof LlmError));
    assert.deepEqual(parsed.json, { systems: 6 });
    const broken = await play(wire, { kind: "answer", text: '{"systems":', stop: "end", usage: USAGE }, schema.request);
    assert.ok(!(broken instanceof LlmError));
    assert.equal(broken.json, undefined);
    assert.match(broken.invalidJson ?? "", /isn't valid JSON/);
    const cut = await play(wire, { kind: "answer", text: '{"systems":', stop: "max_tokens", usage: USAGE }, schema.request);
    assert.ok(!(cut instanceof LlmError));
    assert.equal(cut.invalidJson, undefined);
  });

  test(`${name}: failures have the same kind and status on every provider`, async () => {
    const cases: [Scenario, LlmErrorKind, number | undefined][] = [
      [{ kind: "status", status: 400 }, "bad_request", 400],
      [{ kind: "status", status: 401 }, "auth", 401],
      [{ kind: "status", status: 429 }, "rate_limit", 429],
      [{ kind: "status", status: 500 }, "server", 500],
      [{ kind: "status", status: 524 }, "timeout", 524],
      [{ kind: "status", status: 529 }, "overloaded", 529],
      // An error in a stream that began with 200: its kind from the error, no HTTP status (the provider answered 200).
      [{ kind: "stream error", code: 429 }, "rate_limit", undefined],
      [{ kind: "stream error", code: 529 }, "overloaded", undefined],
      // The provider answered, but its answer couldn't be read.
      [{ kind: "cut" }, "unreadable_response", undefined],
      [{ kind: "ends early" }, "unreadable_response", undefined],
      [{ kind: "broken" }, "unreadable_response", undefined],
      [{ kind: "offline" }, "network", undefined],
      [{ kind: "abort" }, "aborted", undefined],
    ];
    const got = [];
    for (const [scenario] of cases) {
      const result = await play(wire, scenario);
      got.push(result instanceof LlmError ? [result.kind, result.status] : ["answered", result.stop]);
    }
    assert.deepEqual(got, cases.map(([, kind, status]) => [kind, status]));
  });

  test(`${name}: a mistake in the caller's progress callback is no network error`, async () => {
    const adapter = createAdapter(wire.settings, { fetch: playing(wire, { kind: "answer", text: "Six systems.", stop: "end", usage: USAGE }) })!;
    const result = await adapter
      .send({ model: wire.model, messages: [{ role: "user", content: [{ type: "text", text: "?" }] }], maxOutputTokens: 100 }, undefined, () => {
        throw new TypeError("a bug");
      })
      .catch((err: unknown) => err);
    assert.ok(result instanceof LlmError);
    assert.equal(result.kind, "unknown");
  });
}
