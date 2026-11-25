// Snapshots of the HTTP request each provider's adapter sends (docs/llm.md, "Calling the providers"), taken before the
// code review's batch 19 rebuilt the adapters on one skeleton: the URL, the method, the headers that don't vary by
// machine or time, and the body, for realistic requests (the replay fixture's, built by the app's prompts, schemas and
// stages, each image given bytes; one with an image of each media type, cache marks and an assistant turn; that one
// without a schema), at every effort and none, with and without adaptive thinking, on every adapter: Claude on
// Anthropic's API and on Bedrock (an API key, a key pair), Gemini on AI Studio and Vertex AI (two places), OpenRouter
// (both hosts). Every provider answers 400, so the test needs no answer's format. Only a change that means to change
// requests (the paid release) may update them. Batch 13's snapshots (llmRequestSnapshots.test.ts) cover the route.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sha256Hex } from "@score3ly/core";
import { createAdapter, type AdapterSettings } from "./index.ts";
import type { Effort, LlmContent, LlmRequest } from "./types.ts";

const BYTES = Uint8Array.from({ length: 333 }, (_, i) => (i * 11 + 5) & 0xff);
const BASE64 = btoa(String.fromCharCode(...BYTES));

type FixtureRequest = { system?: string; messages: { role: "user" | "assistant"; content: (LlmContent & { recipeKey?: string })[] }[]; maxOutputTokens: number; jsonSchema?: Record<string, unknown> };

// A request as the route sends it to an adapter: images with bytes, no recipe keys.
function toLlm(request: FixtureRequest, model: string): LlmRequest {
  return {
    model,
    ...(request.system ? { system: request.system } : {}),
    messages: request.messages.map((m) => ({
      role: m.role,
      content: m.content.map((c): LlmContent => {
        const mark = c.cacheUpTo ? { cacheUpTo: true as const } : {};
        return c.type === "image" ? { type: "image", image: { mediaType: c.image?.mediaType ?? "image/png", base64: BASE64 }, ...mark } : { type: "text", text: c.text, ...mark };
      }),
    })),
    maxOutputTokens: request.maxOutputTokens,
    ...(request.jsonSchema ? { jsonSchema: request.jsonSchema } : {}),
  };
}

const MIXED: FixtureRequest = {
  system: "You read music.\nAnswer in JSON.",
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Systems on the page, \"quoted\", ü, 𝄞." },
        { type: "image", image: { mediaType: "image/png", base64: "" } },
        { type: "image", image: { mediaType: "image/jpeg", base64: "" }, cacheUpTo: true },
        { type: "text", text: "And this one?", cacheUpTo: true },
      ],
    },
    { role: "assistant", content: [{ type: "text", text: "{\"systems\":[]}" }] },
    { role: "user", content: [{ type: "image", image: { mediaType: "image/webp", base64: "" } }, { type: "text", text: "Look again." }] },
  ],
  maxOutputTokens: 1234,
  jsonSchema: { type: "object", properties: { systems: { type: "array", items: { type: "object", properties: { top: { type: "number" } }, required: ["top"] } } }, required: ["systems"], additionalProperties: false },
};
const { jsonSchema: _, ...PLAIN } = MIXED;

const FIXTURE_DIR = join(import.meta.dirname, "../../../../fixtures/replay/fake/requests");
const REQUESTS: [string, FixtureRequest][] = [
  ...["layout-1-p1-round2.json", "analyze-1-all-round1.json", "extract-1-p1-s2-round1.json", "review-1-p1-s1-round1.json", "apply_review-1-p1-s1-round1.json"].map(
    (file): [string, FixtureRequest] => [file, JSON.parse(readFileSync(join(FIXTURE_DIR, file), "utf8"))],
  ),
  ["mixed", MIXED],
  ["plain", PLAIN],
];

// A service account's key file, with a key made for the test: only the token endpoint sees what is signed with it.
async function serviceAccount(): Promise<string> {
  const keys = (await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const der = new Uint8Array((await crypto.subtle.exportKey("pkcs8", keys.privateKey)) as ArrayBuffer);
  const pem = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(der).toString("base64")}\n-----END PRIVATE KEY-----\n`;
  return JSON.stringify({ type: "service_account", project_id: "my-project", client_email: "snap@my-project.iam.gserviceaccount.com", private_key: pem, token_uri: "https://oauth2.googleapis.com/token" });
}

type Adapter = [label: string, settings: Omit<AdapterSettings, "secrets"> & { secrets: Record<string, string> | "service account" }, model: string];

const ADAPTERS: Adapter[] = [
  ["anthropic", { provider: "anthropic", family: "claude", region: "", project: null, secrets: { apiKey: "snap-key" } }, "claude-opus-5-5"],
  ["bedrock key", { provider: "bedrock", family: "claude", region: "eu-central-1", project: null, secrets: { apiKey: "snap-key" } }, "eu.anthropic.claude-opus-5-5"],
  ["bedrock key pair", { provider: "bedrock", family: "claude", region: "eu-west-1", project: null, secrets: { accessKeyId: "AKIASNAP", secretAccessKey: "snap-secret" } }, "anthropic.claude-haiku-4-5-20251001-v1:0"],
  ["ai-studio", { provider: "ai-studio", family: "gemini", region: "", project: null, secrets: { apiKey: "snap-key" } }, "gemini-4-argon"],
  ["vertex europe-west4", { provider: "vertex", family: "gemini", region: "europe-west4", project: null, secrets: "service account" }, "gemini-4-argon"],
  ["vertex eu, another project", { provider: "vertex", family: "gemini", region: "eu", project: "other-project", secrets: "service account" }, "gemini-3.1-pro"],
  ["openrouter claude", { provider: "openrouter", family: "claude", region: "", project: null, secrets: { apiKey: "snap-key" } }, "anthropic/claude-opus-5.5"],
  ["openrouter gemini eu", { provider: "openrouter", family: "gemini", region: "eu", project: null, secrets: { apiKey: "snap-key" } }, "google/gemini-4-argon"],
];

const EFFORTS: (Effort | undefined)[] = [undefined, "low", "medium", "high", "xhigh", "max"];

// Headers that differ by machine, run or time (the SDKs' platform headers; AWS's signature and date), left out.
const VARYING = /^(x-stainless-|x-amz-date$|x-amz-security-token$)/;

async function describe(input: RequestInfo | URL, init?: RequestInit): Promise<string> {
  const request = new Request(input, init);
  const body = await request.text();
  const headers = [...request.headers.entries()]
    .filter(([name]) => !VARYING.test(name))
    // An AWS signature changes with the date: only which headers it signs is kept.
    .map(([name, value]) => [name, name === "authorization" && value.startsWith("AWS4-") ? value.replace(/Credential=[^,]*|Signature=\w+/g, "…") : value])
    .sort(([a], [b]) => (a < b ? -1 : 1));
  return [`${request.method} ${request.url}`, ...headers.map(([n, v]) => `${n}: ${v}`), "", body].join("\n");
}

// For each adapter and request: the hash of what was sent, for every effort, with and without adaptive thinking.
// Changed by the paid release's batch 34 (the prompts): every adapter's body for analyze, extract, review and
// apply_review (the replay's requests' texts, schemas and issues, diff read); layout's and the others unchanged.
const EXPECTED: Record<string, string> = {
  "anthropic layout-1-p1-round2.json": "856972335ccc1fd987182c0d903f9c18d50dc76949d81093914ca1ef8cc918c6",
  "anthropic analyze-1-all-round1.json": "6b07a0c0fd4b74ce83ec822e92503898dcfce01c20ffc5b3e40d6ae5c2833e11",
  "anthropic extract-1-p1-s2-round1.json": "734745f74f60b97f02d0c8bd62c068bef433437fbb85f09bb22453f042c5c45b",
  "anthropic review-1-p1-s1-round1.json": "acf3aeea6c494ca360730ec3e00d983e08dad7e9668d380bcd1514938887a72d",
  "anthropic apply_review-1-p1-s1-round1.json": "1e678835f3db1d79c9ddabd718e9b648778fb45c27ebff6cd10602ec50f35e4d",
  "anthropic mixed": "bca2f193069355e4414f18a3a4db1f1674194d9a2f03ecf6e280bf08d875c855",
  "anthropic plain": "31c4f19c5fc5c2c3b024c3fd37dd10caa62de7ab2392f499db9b5a8bd550451d",
  "bedrock key layout-1-p1-round2.json": "415774978b9597a964c13375cc6f22121c72582472fcc951ada0f2b372268d32",
  "bedrock key analyze-1-all-round1.json": "78368cb593d65bb87a271af813948af237aa5ed3b88d9fbfe6d236728127b653",
  "bedrock key extract-1-p1-s2-round1.json": "f1927eda9da839bd60d17bd3bd3357395ba6d3d9c1ae64b5fcad1605864ef68f",
  "bedrock key review-1-p1-s1-round1.json": "1c6173a772a5ead52177bfc735f1b63fd3882db36bd87b8b3ed546cbe0fbe320",
  "bedrock key apply_review-1-p1-s1-round1.json": "b3ae8ff74b841e2785c1b1054bf3a4878a08604d1c953ea2e7c180ea3a18cdcc",
  "bedrock key mixed": "950c10bbb95c6d5c4044c51cb59694658848e9b3fe9d7dd8a599a4b8e20a8088",
  "bedrock key plain": "d51e7376bf4a70193a281218015cb2490d5130023057911a64afccf53842d5a1",
  "bedrock key pair layout-1-p1-round2.json": "cb3619901b58ff93664b7877a111603483a33e73ea56c5d5b21f491c5b58a01d",
  "bedrock key pair analyze-1-all-round1.json": "4b4cdc2ae39b2cc7772be20b3e7b7b435354a808ad0da96797c08149f7c5884c",
  "bedrock key pair extract-1-p1-s2-round1.json": "14ee1be4ed9228466f4a7be245b4495b7461f50359521e689425f0d1bf70627b",
  "bedrock key pair review-1-p1-s1-round1.json": "cb6fc4af9f935e60a04398a4599ff9cd336dfd53df428458f0a37a4e9454305d",
  "bedrock key pair apply_review-1-p1-s1-round1.json": "2e1d77f1f3608a31a40e3263b108896bc2bd59554c817aebf3a7af66d4506f20",
  "bedrock key pair mixed": "a36ff68181ee586cd76b6e2cc1333c1be549cd97815351928ffbf61d71e362e4",
  "bedrock key pair plain": "b0debee17d9ad2e532e9e407e4aff8f0f9f1910d3b1112abe312e2715b376ca1",
  "ai-studio layout-1-p1-round2.json": "5381e7be4cc01363eabb5c24c6e6026458032c3e774a58e8f7f355469706194c",
  "ai-studio analyze-1-all-round1.json": "a367a54bc8bacc45dced240e4dbcf2d799aa1e3fcbee424b4c62c3942c6d8269",
  "ai-studio extract-1-p1-s2-round1.json": "5306ea9a153bbddc51c4ce1ce3c11edf158c18a3578bd945d8c485014f0c3776",
  "ai-studio review-1-p1-s1-round1.json": "5869666c565b0f82c6058a3251c4a0c1643d75adc676a580616935bcc0d1f33f",
  "ai-studio apply_review-1-p1-s1-round1.json": "0be8b75e73e1fb144a5e431504d3b1cc91c3905cd0ffe58d5069936d9f30cd32",
  "ai-studio mixed": "04053f111fa150973fc62cfab1514dfbbebbb10b10b129576ca3b94b8542e3a2",
  "ai-studio plain": "fdd31486d0d3c262dfbc902a936673e50a9a2be310ea6926b9bc9e8dc9b20c0b",
  "vertex europe-west4 layout-1-p1-round2.json": "0e7fdf58289f5d57abacfcc428da0d6f2282e458e285f35c9e1e338f76537143",
  "vertex europe-west4 analyze-1-all-round1.json": "d23f79499c5696b5d71974fa901d1cdd9a1811129adb31a8dbb52eb310b8d028",
  "vertex europe-west4 extract-1-p1-s2-round1.json": "7642667ee716eeb609b5c8687f07366a708bb2eb75af638449adddbf16c49a5f",
  "vertex europe-west4 review-1-p1-s1-round1.json": "068d6f73f7833a9beec7aff73b7aed931cda56026a462595641857279493aa14",
  "vertex europe-west4 apply_review-1-p1-s1-round1.json": "2606f4c110c9faa2028a229cfd989f780fcc3c0aa3bfefde14212a0fab79438a",
  "vertex europe-west4 mixed": "5233432527993c17b46924860de507aafa067dc3ab636d8ff68bf6ca23b4b24c",
  "vertex europe-west4 plain": "329e04e06e7470cd5f59c40dda730d66d972cc08bd65ce35aa80fdba4350a019",
  "vertex eu, another project layout-1-p1-round2.json": "9feb1a9140a5ba725134032f94a9d9f0bd3a20510946eea425d99cb27711dc2d",
  "vertex eu, another project analyze-1-all-round1.json": "f32ab9e17483d2b542a030c916a7b7319d604023966a406c8a34156c96ea3739",
  "vertex eu, another project extract-1-p1-s2-round1.json": "c867af19ea39d8e940b6a736fdf3e162b7ced513ab856a74669d3ab8790a30d5",
  "vertex eu, another project review-1-p1-s1-round1.json": "5989d7becd8bd05246033b7f67203b1c7a8f3ba8e06d7964cb6530af0d1b0e48",
  "vertex eu, another project apply_review-1-p1-s1-round1.json": "a94074e3cfbd477ce35fcb24739d01ae6bef7573d94982c91163d1a719f4e23f",
  "vertex eu, another project mixed": "21524d88dc0440454202081fe8ed637bef2421f7235f6c0760d03727dde25458",
  "vertex eu, another project plain": "2df3eee567e7ff61e63d842ea62955abd6b393d7557a52fae2bb04ae9feae15f",
  "openrouter claude layout-1-p1-round2.json": "527df51d8f38f00884a755e51555cad624bc9d59ed624e37d60de5eaac2ac335",
  "openrouter claude analyze-1-all-round1.json": "53554072213269c15e140b6acd4e7519e1ad473d48cce1c3f711b4f413ffbb16",
  "openrouter claude extract-1-p1-s2-round1.json": "fbafb15bad22375301ffe92613ed244501bec3e9da0a374008cd98489fcde610",
  "openrouter claude review-1-p1-s1-round1.json": "2e5bc2d6c29117b926acc45ac3dcaf8e9fe49e194fb53338c9e88013b96738bf",
  "openrouter claude apply_review-1-p1-s1-round1.json": "3735f3dc64c15f6cf068899759fee1031f3fd101f54fb67a36df734efa135b2a",
  "openrouter claude mixed": "175eed0d7bea93b93fa1808882e40e91eeb284dae813d90f422633aa73604c6c",
  "openrouter claude plain": "8eb6a61ccf494a7afad8e3f9e429420c06ccf075758ca0016d7073edf7f0cfcd",
  "openrouter gemini eu layout-1-p1-round2.json": "fcef35c1777d19d7475d4b068d82255400518580de86aa59dfc47dddcf19e160",
  "openrouter gemini eu analyze-1-all-round1.json": "cc8d2c6656510f4db2410dc66de0fa78773031212ebe6257cc830f52121b86c0",
  "openrouter gemini eu extract-1-p1-s2-round1.json": "299450956fef3ecf7211d04aa71f82cbd331e4fa8c4768f7053af6fff6a478be",
  "openrouter gemini eu review-1-p1-s1-round1.json": "778c5ca17b9457a18ef71f35fde3b9ccf4f5fa76fc9f11d30e7620b962b7addb",
  "openrouter gemini eu apply_review-1-p1-s1-round1.json": "3e747eb442adcbdcf06b99a064ab496afa2b36c7eeb6c2fb6cee9b022767a690",
  "openrouter gemini eu mixed": "0f175a7ae5a46818b702ddbc46340d32b5598a9863b42787aebff5460f999eb4",
  "openrouter gemini eu plain": "244eb036a4a4869e15b6f69f2bf82427d070d79830cb97f1592c4d4dc672a554",
};

test("every adapter sends the requests it sent", async () => {
  const account = await serviceAccount();
  const got: Record<string, string> = {};
  for (const [label, settings, model] of ADAPTERS) {
    const sent: string[] = [];
    const fake = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input instanceof Request ? input.url : input) === "https://oauth2.googleapis.com/token") {
        return Response.json({ access_token: "snap-token", expires_in: 3600, token_type: "Bearer" });
      }
      sent.push(await describe(input, init));
      return new Response(JSON.stringify({ error: { type: "invalid_request_error", message: "snapshot", code: 400, status: "INVALID_ARGUMENT" } }), { status: 400, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    const secrets = settings.secrets === "service account" ? { serviceAccount: account } : settings.secrets;
    const adapter = createAdapter({ ...settings, secrets }, { fetch: fake })!;
    for (const [name, request] of REQUESTS) {
      sent.length = 0;
      for (const effort of EFFORTS) {
        for (const adaptive of [false, true]) {
          const llm = { ...toLlm(request, model), ...(effort ? { effort } : {}), ...(adaptive ? { adaptiveThinking: true as const } : {}) };
          await assert.rejects(adapter.send(llm));
        }
      }
      assert.equal(sent.length, EFFORTS.length * 2, `${label} ${name}: one request per call`);
      got[`${label} ${name}`] = await sha256Hex(new TextEncoder().encode(sent.join("\n\n")));
    }
  }
  assert.deepEqual(got, EXPECTED);
});
