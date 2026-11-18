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
const EXPECTED: Record<string, string> = {
  "anthropic layout-1-p1-round2.json": "856972335ccc1fd987182c0d903f9c18d50dc76949d81093914ca1ef8cc918c6",
  "anthropic analyze-1-all-round1.json": "9a616aa9c1b70b2930dded4246fbaee35a162b38fbfa7b7ce299cc905afd1516",
  "anthropic extract-1-p1-s2-round1.json": "9cd30978e1e08e1deec6b27cade91d029765ad12f2501c9c21ae8ee752e5851b",
  "anthropic review-1-p1-s1-round1.json": "bffa2a449c669ce48585c0718e5c51cf4c07737d22b30ced241f779ae01d2eb9",
  "anthropic apply_review-1-p1-s1-round1.json": "be15012e601412b020955e335b3fa14afeb560d99540d239287a094ce2e67384",
  "anthropic mixed": "bca2f193069355e4414f18a3a4db1f1674194d9a2f03ecf6e280bf08d875c855",
  "anthropic plain": "31c4f19c5fc5c2c3b024c3fd37dd10caa62de7ab2392f499db9b5a8bd550451d",
  "bedrock key layout-1-p1-round2.json": "415774978b9597a964c13375cc6f22121c72582472fcc951ada0f2b372268d32",
  "bedrock key analyze-1-all-round1.json": "762780339542f8172d05836cf9827dbf77d5754a1ae48885e41a4f01592b51b3",
  "bedrock key extract-1-p1-s2-round1.json": "b86b178aa84ea33593628b84a834dfb63322785a9ab0825349992455f2f35817",
  "bedrock key review-1-p1-s1-round1.json": "03fe58ffef37e1a4ec3611879e9fdff9c561c4a7f20341769d1abbd112447ffc",
  "bedrock key apply_review-1-p1-s1-round1.json": "afcdcc72b19e35d56b718e6ef47d7402161ab3608ea106154e1f5cc89e496982",
  "bedrock key mixed": "950c10bbb95c6d5c4044c51cb59694658848e9b3fe9d7dd8a599a4b8e20a8088",
  "bedrock key plain": "d51e7376bf4a70193a281218015cb2490d5130023057911a64afccf53842d5a1",
  "bedrock key pair layout-1-p1-round2.json": "cb3619901b58ff93664b7877a111603483a33e73ea56c5d5b21f491c5b58a01d",
  "bedrock key pair analyze-1-all-round1.json": "278e05ed8ecceab1d603e4b65c74850c67624992a3a88f80f4eba8fcad3e4c3e",
  "bedrock key pair extract-1-p1-s2-round1.json": "223a8185f1b259e0a7b7b31e8973a8be1fd72cde2ac8318dc8af298360dcc561",
  "bedrock key pair review-1-p1-s1-round1.json": "140951abe72c36d0391c5e1ed9113468b6bc6767715e7869d04fab1670c46872",
  "bedrock key pair apply_review-1-p1-s1-round1.json": "deba20969e843a5ea260c6e2f98998cf31556c8c5384152f1788aa28700a55ce",
  "bedrock key pair mixed": "a36ff68181ee586cd76b6e2cc1333c1be549cd97815351928ffbf61d71e362e4",
  "bedrock key pair plain": "b0debee17d9ad2e532e9e407e4aff8f0f9f1910d3b1112abe312e2715b376ca1",
  "ai-studio layout-1-p1-round2.json": "5381e7be4cc01363eabb5c24c6e6026458032c3e774a58e8f7f355469706194c",
  "ai-studio analyze-1-all-round1.json": "c1a61095a23fc3cdefb6b8fd135dfd8b977012a4d144379b7dc282e69c136c45",
  "ai-studio extract-1-p1-s2-round1.json": "bd2f46c0365535a27493267e05449247aeeec391e9d2b49748c3c79dd4c513f0",
  "ai-studio review-1-p1-s1-round1.json": "8b110b4422c36e8b7524583657b49922872b1035aa88b19fc09a03b4473b6eee",
  "ai-studio apply_review-1-p1-s1-round1.json": "3143b0f50697a6ff35ebe58ae7d5600b39e914836d9e528250b8cedc7cc92aba",
  "ai-studio mixed": "04053f111fa150973fc62cfab1514dfbbebbb10b10b129576ca3b94b8542e3a2",
  "ai-studio plain": "fdd31486d0d3c262dfbc902a936673e50a9a2be310ea6926b9bc9e8dc9b20c0b",
  "vertex europe-west4 layout-1-p1-round2.json": "0e7fdf58289f5d57abacfcc428da0d6f2282e458e285f35c9e1e338f76537143",
  "vertex europe-west4 analyze-1-all-round1.json": "f40e121213010608e6f1e91e677d4d64fde0bc0e74ef6f2c2ee5cd58e621a4eb",
  "vertex europe-west4 extract-1-p1-s2-round1.json": "a628b1d51a75db8aecb6d95cf8085412204a30544bcc051f05e7c2156e73c095",
  "vertex europe-west4 review-1-p1-s1-round1.json": "9a5c7ae8513bf85d562eafe33684149deb59d4d86acaefda14a7f8d4d102cca0",
  "vertex europe-west4 apply_review-1-p1-s1-round1.json": "a25df8f0f4e7cf65879fd87e1394195e696e374d67052e8b09edbe1df97f1dd6",
  "vertex europe-west4 mixed": "5233432527993c17b46924860de507aafa067dc3ab636d8ff68bf6ca23b4b24c",
  "vertex europe-west4 plain": "329e04e06e7470cd5f59c40dda730d66d972cc08bd65ce35aa80fdba4350a019",
  "vertex eu, another project layout-1-p1-round2.json": "9feb1a9140a5ba725134032f94a9d9f0bd3a20510946eea425d99cb27711dc2d",
  "vertex eu, another project analyze-1-all-round1.json": "39d33498274e23b49b620401f49198f94c7f69c36e3e96a4d17635f6c4a1e360",
  "vertex eu, another project extract-1-p1-s2-round1.json": "38af18c10a33fe9cbd3c58c3c154077b1c24fa46c6454e20a71459685ac41193",
  "vertex eu, another project review-1-p1-s1-round1.json": "7c522612df4b365a5d74402c2e4bf5a767fc59dd784904022553f4aa2092aa27",
  "vertex eu, another project apply_review-1-p1-s1-round1.json": "1cf3314e47db0a3fe5ba6d98f075058936cf0b63a2f9846506d03423614e56f0",
  "vertex eu, another project mixed": "21524d88dc0440454202081fe8ed637bef2421f7235f6c0760d03727dde25458",
  "vertex eu, another project plain": "2df3eee567e7ff61e63d842ea62955abd6b393d7557a52fae2bb04ae9feae15f",
  "openrouter claude layout-1-p1-round2.json": "527df51d8f38f00884a755e51555cad624bc9d59ed624e37d60de5eaac2ac335",
  "openrouter claude analyze-1-all-round1.json": "e4c762efc1126dc4a9bfff4b5d9659ebf81a9773862e2afe6cc9d784d6d0c267",
  "openrouter claude extract-1-p1-s2-round1.json": "6364ba2ba2d88a0608dbd9cd11d6951005565fdba7821ea4844b17a0c3d51e34",
  "openrouter claude review-1-p1-s1-round1.json": "dd334f6ef616e9f2ae9471404e09cb8b493ca1120e8f3b4bb37274c2cf61e100",
  "openrouter claude apply_review-1-p1-s1-round1.json": "a64249667cde7325b2f96ac715e528681a903bd278f5833eb6c6a2625a35069b",
  "openrouter claude mixed": "175eed0d7bea93b93fa1808882e40e91eeb284dae813d90f422633aa73604c6c",
  "openrouter claude plain": "8eb6a61ccf494a7afad8e3f9e429420c06ccf075758ca0016d7073edf7f0cfcd",
  "openrouter gemini eu layout-1-p1-round2.json": "fcef35c1777d19d7475d4b068d82255400518580de86aa59dfc47dddcf19e160",
  "openrouter gemini eu analyze-1-all-round1.json": "c54b5ff7c6a548bb05a34edd336efc1ce89ec8cc44949a44cc1273ac12df186d",
  "openrouter gemini eu extract-1-p1-s2-round1.json": "b72244e37f81bb3a148b33947de59d800e10b4c1f2cce4378e5ca57b2fc7ba98",
  "openrouter gemini eu review-1-p1-s1-round1.json": "893f525932a8a56644a255da1160674489f8d550c7daf64a9bf96d4feabdf6a2",
  "openrouter gemini eu apply_review-1-p1-s1-round1.json": "fb3a0c8821cdca73d879356b1183255ad31790b2e403db33a150a0d101e41bd7",
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
