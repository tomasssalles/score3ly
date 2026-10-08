import { test } from "node:test";
import assert from "node:assert/strict";
import { createProvider } from "./index.ts";
import { parseServiceAccount, tokenSource } from "./googleServiceAccount.ts";
import { LlmError } from "./types.ts";

// A service account with a freshly made key, and its public key to check signatures with.
async function makeAccount() {
  const keys = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const der = new Uint8Array((await crypto.subtle.exportKey("pkcs8", keys.privateKey)) as ArrayBuffer);
  const pem = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(der)
    .toString("base64")
    .replace(/(.{64})/g, "$1\n")}\n-----END PRIVATE KEY-----\n`;
  const json = JSON.stringify({
    type: "service_account",
    project_id: "my-project",
    client_email: "score3ly@my-project.iam.gserviceaccount.com",
    private_key: pem,
    token_uri: "https://oauth2.googleapis.com/token",
  });
  return { json, publicKey: keys.publicKey };
}

function decode(part: string): any {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

type Call = { url: string; headers: Headers; body: string };

// Google's token endpoint and Vertex AI, faked. Vertex answers with a stream of server-sent events.
function fakeGoogle(calls: Call[], model = "claude-opus-5-5", text = '{"systems":6}'): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: new Headers(init?.headers), body: String(init?.body) });
    if (url === "https://oauth2.googleapis.com/token") {
      return Response.json({ access_token: `token-${calls.length}`, expires_in: 3600, token_type: "Bearer" });
    }
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
          usage: { input_tokens: 900, output_tokens: 1 },
        },
      },
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } },
      { type: "content_block_stop", index: 0 },
      { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 30 } },
      { type: "message_stop" },
    ];
    const sse = events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
    return new Response(sse, { headers: { "content-type": "text/event-stream" } });
  }) as typeof fetch;
}

test("a token is a signed claim exchanged at Google's token endpoint, and reused until near its end", async () => {
  const { json, publicKey } = await makeAccount();
  const calls: Call[] = [];
  let now = Date.parse("2026-10-08T12:00:00Z");
  const source = tokenSource(parseServiceAccount(json), fakeGoogle(calls), () => now);

  const first = await source.getRequestHeaders();
  assert.equal(first.get("authorization"), "Bearer token-1");
  const form = new URLSearchParams(calls[0].body);
  assert.equal(form.get("grant_type"), "urn:ietf:params:oauth:grant-type:jwt-bearer");
  const [header, claims, signature] = form.get("assertion")!.split(".");
  assert.deepEqual(decode(header), { alg: "RS256", typ: "JWT" });
  assert.deepEqual(decode(claims), {
    iss: "score3ly@my-project.iam.gserviceaccount.com",
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now / 1000,
    exp: now / 1000 + 3600,
  });
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    Buffer.from(signature, "base64url"),
    new TextEncoder().encode(`${header}.${claims}`),
  );
  assert.ok(valid, "the signature checks out with the public key");

  now += 50 * 60_000;
  assert.equal((await source.getRequestHeaders()).get("authorization"), "Bearer token-1");
  assert.equal(calls.length, 1);
  now += 10 * 60_000; // a minute before the end it is renewed
  assert.equal((await source.getRequestHeaders()).get("authorization"), "Bearer token-2");
});

test("a key file that isn't a service account's is refused", () => {
  assert.throws(() => parseServiceAccount("{"), LlmError);
  assert.throws(() => parseServiceAccount('{"type":"authorized_user"}'), /service account key lacks/);
});

test("Claude on Vertex AI: the EU endpoint, the project, the token, and the same answer as from Anthropic", async () => {
  const { json } = await makeAccount();
  const calls: Call[] = [];
  const provider = createProvider(
    { provider: "anthropic-vertex", serviceAccount: json, region: "eu" },
    { fetch: fakeGoogle(calls) },
  );
  const response = await provider.send({
    model: "claude-opus-5-5",
    messages: [{ role: "user", content: [{ type: "text", text: "How many systems?" }] }],
    effort: "high",
    jsonSchema: { type: "object", properties: { systems: { type: "integer" } }, required: ["systems"] },
  });

  const call = calls.find((c) => c.url.includes("aiplatform"))!;
  assert.equal(
    call.url,
    "https://aiplatform.eu.rep.googleapis.com/v1/projects/my-project/locations/eu/publishers/anthropic/models/claude-opus-5-5:streamRawPredict",
  );
  assert.equal(call.headers.get("authorization"), "Bearer token-1");
  assert.equal(call.headers.get("x-api-key"), null);
  const body = JSON.parse(call.body);
  assert.equal(body.model, undefined); // in the URL on Vertex
  assert.match(body.anthropic_version, /^vertex-/);
  assert.equal(body.output_config.effort, "high");
  assert.equal(body.output_config.format.type, "json_schema");

  assert.equal(response.provider, "anthropic-vertex");
  assert.equal(response.model, "claude-opus-5-5");
  assert.deepEqual(response.json, { systems: 6 });
  assert.deepEqual(response.usage, { inputTokens: 900, outputTokens: 30, cacheReadTokens: 0, cacheWriteTokens: 0 });
});

test("another region and project can be chosen", async () => {
  const { json } = await makeAccount();
  const calls: Call[] = [];
  const provider = createProvider(
    { provider: "anthropic-vertex", serviceAccount: json, region: "europe-west1", projectId: "other" },
    { fetch: fakeGoogle(calls, "claude-opus-5-5", "hi") },
  );
  await provider.send({
    model: "claude-opus-5-5",
    messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
  });
  assert.match(
    calls.find((c) => c.url.includes("aiplatform"))!.url,
    /^https:\/\/europe-west1-aiplatform\.googleapis\.com\/v1\/projects\/other\/locations\/europe-west1\//,
  );
});

test("a refused service account is an auth error", async () => {
  const { json } = await makeAccount();
  const refuse = (async () => new Response("no", { status: 400 })) as unknown as typeof fetch;
  const provider = createProvider(
    { provider: "anthropic-vertex", serviceAccount: json, region: "eu" },
    { fetch: refuse },
  );
  await assert.rejects(
    provider.send({ model: "claude-opus-5-5", messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }] }),
    (err: unknown) => err instanceof LlmError && err.kind === "auth" && !err.retryable,
  );
});
