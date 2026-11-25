// Snapshots of what the Worker makes of realistic requests (docs/llm.md, "Calling the providers"), taken before the code
// review's batch 13 split llmRoutes.ts: the request key, the hash of the request as recorded, and the provider's HTTP
// request (its URL and body) for each real provider's adapter, at several efforts, with adaptive thinking and without an
// effort; and the config Test's. The requests are the replay fixture's (built by the app's prompts, schemas and stages:
// several images, cache marks, an assistant turn), each image given bytes, and one with an image of each media type and
// a cache mark on an image. Every provider answers 400, so nothing is billed and the test needs no answer's format. Only
// a change that means to change requests (the paid release) may update them.

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sha256Hex } from "@score3ly/core";
import { createProject, testPlatform } from "./testPlatform.ts";
import app from "./index.ts";

let platform: Awaited<ReturnType<typeof testPlatform>>;
let env: Env;

before(async () => {
  platform = await testPlatform();
  env = platform.env;
  Object.assign(env as unknown as Record<string, string>, { SNAP_KEY: "snapshot-key" });
});

after(async () => {
  await platform.dispose();
});

function send(path: string, body?: unknown) {
  return app.request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }, env);
}

const BYTES = Uint8Array.from({ length: 333 }, (_, i) => (i * 11 + 5) & 0xff);
const BASE64 = btoa(String.fromCharCode(...BYTES));

type Content = { type: string; recipeKey?: string; image?: unknown; cacheUpTo?: true; text?: string };
type Request = { system?: string; messages: { role: string; content: Content[] }[]; maxOutputTokens?: number; jsonSchema?: unknown };

function withImages(request: Request): Request {
  return {
    ...request,
    messages: request.messages.map((m) => ({
      ...m,
      content: m.content.map((c) => (c.type === "image" ? { ...c, image: { mediaType: "image/png", base64: BASE64 } } : c)),
    })),
  };
}

// An image of each media type, a cache mark on an image and on a text, two user turns around an assistant's.
const MIXED: Request = {
  system: "You read music.\nAnswer in JSON.",
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Systems on the page, \"quoted\", ü, 𝄞." },
        { type: "image", recipeKey: "1".repeat(64), image: { mediaType: "image/png", base64: BASE64 } },
        { type: "image", recipeKey: "2".repeat(64), image: { mediaType: "image/jpeg", base64: BASE64 }, cacheUpTo: true },
        { type: "text", text: "And this one?", cacheUpTo: true },
      ],
    },
    { role: "assistant", content: [{ type: "text", text: "{\"systems\":[]}" }] },
    { role: "user", content: [{ type: "image", recipeKey: "3".repeat(64), image: { mediaType: "image/webp", base64: BASE64 } }, { type: "text", text: "Look again." }] },
  ],
  maxOutputTokens: 1234,
  jsonSchema: { type: "object", properties: { systems: { type: "array", items: { type: "object", properties: { top: { type: "number" } }, required: ["top"] } } }, required: ["systems"], additionalProperties: false },
};

const FIXTURE_DIR = join(import.meta.dirname, "../../../fixtures/replay/fake/requests");
const REQUESTS: [string, Request][] = [
  ...["layout-1-p1-round2.json", "analyze-1-all-round1.json", "extract-1-p1-s2-round1.json", "review-1-p1-s1-round1.json", "apply_review-1-p1-s1-round1.json"].map(
    (file): [string, Request] => [file, withImages(JSON.parse(readFileSync(join(FIXTURE_DIR, file), "utf8")))],
  ),
  ["mixed", MIXED],
];

const CONFIGS: [string, Record<string, unknown>][] = [
  ["anthropic opus 5.5 high", { provider: "anthropic", modelId: "claude-opus-5-5", effort: "high", pricing: { kind: "list" }, secrets: { apiKey: "SNAP_KEY" } }],
  ["anthropic opus 4.8 high (adaptive)", { provider: "anthropic", modelId: "claude-opus-4-8", effort: "high", pricing: { kind: "list" }, secrets: { apiKey: "SNAP_KEY" } }],
  ["anthropic haiku 4.5 (no effort)", { provider: "anthropic", modelId: "claude-haiku-4-5", pricing: { kind: "list" }, secrets: { apiKey: "SNAP_KEY" } }],
  ["bedrock opus 5.5 medium eu-central-1 geographic", { provider: "bedrock", modelId: "claude-opus-5-5", effort: "medium", region: "eu-central-1", routing: "geographic", pricing: { kind: "list" }, secrets: { apiKey: "SNAP_KEY" } }],
  ["ai-studio gemini 4 argon high", { provider: "ai-studio", modelId: "gemini-4-argon", effort: "high", pricing: { kind: "list" }, secrets: { apiKey: "SNAP_KEY" } }],
  ["openrouter opus 5.5 low", { provider: "openrouter", modelId: "claude-opus-5-5", effort: "low", account: "standard", pricing: { kind: "provider" }, secrets: { apiKey: "SNAP_KEY" } }],
];

// What each provider was sent, by its URL and body: the hash of both.
async function sentHash(input: RequestInfo | URL, init?: RequestInit): Promise<string> {
  let url: string;
  let body: string;
  if (input instanceof Request) {
    url = input.url;
    body = await input.text();
  } else {
    url = String(input);
    const b = init?.body;
    body = typeof b === "string" ? b : b instanceof Uint8Array ? new TextDecoder().decode(b) : b instanceof ArrayBuffer ? new TextDecoder().decode(new Uint8Array(b)) : String(b ?? "");
  }
  return sha256Hex(new TextEncoder().encode(`${url}\n${body}`));
}

// For each config and request: [request key, recorded request's hash, provider's request's hash]; the Test's last.
const EXPECTED: Record<string, string[]> = {
  "anthropic opus 5.5 high layout-1-p1-round2.json": ["4dff1f28b167d5ee4dc3c9fb81e85ffb2734fd0f6b12c304906994f2f9339ebd","3720fe12cd06cbd87c09e6d8bf13b90d7f8c20e1370150c289a0a5231955c846","ab8cc4c9b4605ad41a1c06614d252ec7cae608b3d65f3389d27f861af17c633d"],
  "anthropic opus 5.5 high analyze-1-all-round1.json": ["6619475dde812c9ea15063ec45643728e40df03df94dac3550dfd035e3cb2297","9794c15aa97f2952b54e46a037d0c2a8fd031cbe7e9bb1200bba9c1a987e71de","c128aaeca3054f212b5d82b74b5ec19d3bdeda427ea086deac910f389799397c"],
  "anthropic opus 5.5 high extract-1-p1-s2-round1.json": ["9afa828b909b3a3171cc1b69813e477d7bf55e5126e8fe6687a2dd337ef000ec","e96e12cf810b6a3e5ffab329eeceb0f0021e0e21ab73b61cf76a8f33d1a9f6b7","6beed3f6d102326c436a3e330d3377617b56febaf7126987cb6618f424abe292"],
  "anthropic opus 5.5 high review-1-p1-s1-round1.json": ["fb3d8c20f437d0aa88809fec9162fe5989bb861e8bad15d7701233fb78e9c86d","4c78d4c7c53da0ae052b9b0cd9117948f1b9ac3ea544690bb42c57123c4cef64","876cf0325ac8012376bf4d24a812ad1bdc082447f184fce7e68a91b35a0d3e7f"],
  "anthropic opus 5.5 high apply_review-1-p1-s1-round1.json": ["42d51edfd0bf2d10214447182767d304a10ab5758b223c578d05d720978f137f","ea7c93c02e14d969060f16559f0364e4da8051e7ee5a0101166a9dcb613e5965","b2f6eea8df09cb44a5c686b440f3d4f48ec0a30956ed76f7954d06234b82cd35"],
  "anthropic opus 5.5 high mixed": ["d76340165e45bc1dbb1e402e9f4160294a40353cdae70f020efad0f706329ee9","8f6f768960f4792450ff1cf4336e5f5d7d0af2308a9054253df3add4337459a2","39203e410aade93ea3e9c3243878b822aa20889ed568dafaaca33d45940f5ff0"],
  "anthropic opus 5.5 high test": ["test:<uuid>","f20f4609c94bbf2ad4de61e5b075815e90fd2777a50deea670e8708b26fbbaf7","2743547e7bffa560858b77037a750e19e9702c1cacf75423c966c417ca244bcf"],
  "anthropic opus 4.8 high (adaptive) layout-1-p1-round2.json": ["ead8a15b8fbf337600afd224c9a5ae3254ccef018757fc447d097a2d9eb8624b","3720fe12cd06cbd87c09e6d8bf13b90d7f8c20e1370150c289a0a5231955c846","acb5199e4505d1a669eb173eda2514919de3f5178f2408ac61c13309dde5b559"],
  "anthropic opus 4.8 high (adaptive) analyze-1-all-round1.json": ["b499084310d7d8598c269674605f4070ee83bbcccf06fbad8666890550e301f4","9794c15aa97f2952b54e46a037d0c2a8fd031cbe7e9bb1200bba9c1a987e71de","550e499ffe0b54399053b9f1b0b12b9553c236be41f31f9dd49186dafd95898e"],
  "anthropic opus 4.8 high (adaptive) extract-1-p1-s2-round1.json": ["5d81ae1851ad7800aff8b99680de86bbde39d81cd24be612d90cf1da88792f12","e96e12cf810b6a3e5ffab329eeceb0f0021e0e21ab73b61cf76a8f33d1a9f6b7","9957d365f4f6b192b26193ee18d0adcedde8d4ae46f5701f15a327ea4b3e7d50"],
  "anthropic opus 4.8 high (adaptive) review-1-p1-s1-round1.json": ["3f60dc214d45f51a55cbac3bc8ec1e3f80d072ebfe36d20c4373366cff50d166","4c78d4c7c53da0ae052b9b0cd9117948f1b9ac3ea544690bb42c57123c4cef64","8fa06de10272d83f208766a4a289203fc0575f6b29decac9c34d74873eaf918d"],
  "anthropic opus 4.8 high (adaptive) apply_review-1-p1-s1-round1.json": ["8992302d518384b152d08fcabe8bdb5fb6139bc65bd7d310f3c9e1c065ed4126","ea7c93c02e14d969060f16559f0364e4da8051e7ee5a0101166a9dcb613e5965","daa8618f774e36e22e61b095b866c47f6fe6674e960fa0e8f8497ee2089882c4"],
  "anthropic opus 4.8 high (adaptive) mixed": ["b17dcb1dfb6e099417e7f44a7c7d4aab8a873e2fce409bac1bebedeea44c5b39","8f6f768960f4792450ff1cf4336e5f5d7d0af2308a9054253df3add4337459a2","8df103b1110d3c6650ea4212b9dd861a7d8a2e5a782d5f14872a174d83e49e4f"],
  "anthropic haiku 4.5 (no effort) layout-1-p1-round2.json": ["1214796b794d1393afa3d8626acdedd35050d943626192e78d3109282bf9caf1","3720fe12cd06cbd87c09e6d8bf13b90d7f8c20e1370150c289a0a5231955c846","a3333c31c19f762c3498b8b81c32cb7e9538cca50de436ed466802ba1dd0f47c"],
  "anthropic haiku 4.5 (no effort) analyze-1-all-round1.json": ["a3c09554f876d7a5fc38f9e8e8f7ba3365239777df169c4d427f9280be290455","9794c15aa97f2952b54e46a037d0c2a8fd031cbe7e9bb1200bba9c1a987e71de","ddff328e3695427ba1cd947a520206b3f8952017a65ed849ecda335c55bba8c1"],
  "anthropic haiku 4.5 (no effort) extract-1-p1-s2-round1.json": ["0c838f81c7d0994a98680582e26649377cda6a4606828a6a0a113cd055a0be92","e96e12cf810b6a3e5ffab329eeceb0f0021e0e21ab73b61cf76a8f33d1a9f6b7","695c0845a202b70c1e0a9b544922bbe4eb4b5c800f68ff43672de7aa428d737c"],
  "anthropic haiku 4.5 (no effort) review-1-p1-s1-round1.json": ["bde113fbb467471dc9e2b97fefbcaa555ff49c41801412bb05d420f6505fa6f0","4c78d4c7c53da0ae052b9b0cd9117948f1b9ac3ea544690bb42c57123c4cef64","4972e363cb94a79e3ddc196e14fdce364f3ad7ebe4ffdc4facf72079b06b139d"],
  "anthropic haiku 4.5 (no effort) apply_review-1-p1-s1-round1.json": ["9af4d08fe9e8dac9469433caaeaa242d89ba05b1d124110aa38e070543a2d706","ea7c93c02e14d969060f16559f0364e4da8051e7ee5a0101166a9dcb613e5965","774e30097503aeb6d96a750bf1ce2799c4aa75d42d71fb853bdedff3b608c9df"],
  "anthropic haiku 4.5 (no effort) mixed": ["d84cf891837376d8572d826bc0610b123293c1271d9159d84149fc409af4be36","8f6f768960f4792450ff1cf4336e5f5d7d0af2308a9054253df3add4337459a2","b9c8eda01066ac16ef737385a7d5139f9611c26f548832cefb011dc09ebd41df"],
  "bedrock opus 5.5 medium eu-central-1 geographic layout-1-p1-round2.json": ["efedc68297ac73543f718bf15dac7544efb29c11bd8e8c36f4e265bcfe415ea6","3720fe12cd06cbd87c09e6d8bf13b90d7f8c20e1370150c289a0a5231955c846","f77fec9f2a34d6b52e8b3b580fe15dae152eab916a9a9e05e36cb42dbf1d00e4"],
  "bedrock opus 5.5 medium eu-central-1 geographic analyze-1-all-round1.json": ["98f3ed8916e36d9d39c28a748d3ec1a807748c65522c41e5e83ff10bb5a0c63f","9794c15aa97f2952b54e46a037d0c2a8fd031cbe7e9bb1200bba9c1a987e71de","31b655d4035fa8477ce1ca5d9800c3fa4a5036dcf66b1ab9bd83ae1197566420"],
  "bedrock opus 5.5 medium eu-central-1 geographic extract-1-p1-s2-round1.json": ["8be611687968b3ad0e0bf682b60431328bebbd907cfe696e83fb6e9a4aa17d52","e96e12cf810b6a3e5ffab329eeceb0f0021e0e21ab73b61cf76a8f33d1a9f6b7","74918eebdd2ce8e064a6fc17b842162bb3df03a03075dcdb5aeada9f5675ea9b"],
  "bedrock opus 5.5 medium eu-central-1 geographic review-1-p1-s1-round1.json": ["e4b4a5b2ec6f259f0b3c03f4ddbc0bf3cd5ef83ef6c293efcee8e80761fcbaa1","4c78d4c7c53da0ae052b9b0cd9117948f1b9ac3ea544690bb42c57123c4cef64","8e37a3999e8adcea6be12e5db4ec1a76ff49a3fd133335f78bc27d16acaffa67"],
  "bedrock opus 5.5 medium eu-central-1 geographic apply_review-1-p1-s1-round1.json": ["5349456fe45d1aa5f6a5de86b3b15f1492407982a25cdf98b9715466dcf8f9af","ea7c93c02e14d969060f16559f0364e4da8051e7ee5a0101166a9dcb613e5965","df93f23740c289c20199fdae25aaa201bbbdb7f1fcd2cfe34960d8daf7ff8370"],
  "bedrock opus 5.5 medium eu-central-1 geographic mixed": ["aee74bc9f7beebe0ffee6e7136cd1e0a38d93041e4754c3d21bca7f516e02561","8f6f768960f4792450ff1cf4336e5f5d7d0af2308a9054253df3add4337459a2","6deeff93b4b908b6cc450c85f8691e2d0b2b9dab586e4efe5b0ac627b29af81a"],
  "ai-studio gemini 4 argon high layout-1-p1-round2.json": ["96cb32f8254d75398bb7c35c7bddd2b1a24ea5ad8784a3d85dbdc279bddb1714","3720fe12cd06cbd87c09e6d8bf13b90d7f8c20e1370150c289a0a5231955c846","c18859927a9e9dd315e3209c9332d3862d879e912992d71d83e7d24f41aa6169"],
  "ai-studio gemini 4 argon high analyze-1-all-round1.json": ["ba26870ff0f27c600dadad12c688f3ac149f22f11ca856c11fb70152e9227454","9794c15aa97f2952b54e46a037d0c2a8fd031cbe7e9bb1200bba9c1a987e71de","2bdeb923efcd8e9cf160d0cfd309256fe5be58b812cd1b73119f62c657534cee"],
  "ai-studio gemini 4 argon high extract-1-p1-s2-round1.json": ["1719a5aa3f72e8e50bc84be478c862cbe0c690788335ee27e681c934a3aa910f","e96e12cf810b6a3e5ffab329eeceb0f0021e0e21ab73b61cf76a8f33d1a9f6b7","656e30a350bd4b57c5aeaeefb198e90fb9032ebffd176ca6d6920dd4c5257f1c"],
  "ai-studio gemini 4 argon high review-1-p1-s1-round1.json": ["09acd1bb6604a0c07bc3fa71fca00489c16a4b160f9481dd2195d6dfb49068ea","4c78d4c7c53da0ae052b9b0cd9117948f1b9ac3ea544690bb42c57123c4cef64","17a9d644496d09577e2eeb17dfdd90a7c467c5ad4e9e622fc28311425cff1d0d"],
  "ai-studio gemini 4 argon high apply_review-1-p1-s1-round1.json": ["1914a1d5a076c23fb224c2f73cfc5f9e5dc87269d3a30e5e31e3fa3dafd3acf9","ea7c93c02e14d969060f16559f0364e4da8051e7ee5a0101166a9dcb613e5965","0db1d7d082a32e34059a591610a3297c6bef988c4cb0cfd3f975921e41f0629a"],
  "ai-studio gemini 4 argon high mixed": ["698606f1a537e2b1c9769d1c4a3f8fe7a1c3edb65a1f38a3b7bc2261b5759582","8f6f768960f4792450ff1cf4336e5f5d7d0af2308a9054253df3add4337459a2","be224193981c7312e032196c4cf230ec9ddaa622f7c701d063152b889b145a72"],
  "openrouter opus 5.5 low layout-1-p1-round2.json": ["d51316031b211bac6d4790b80a2d553a7fbe248d31ceefa9dbc766f070ee85c0","3720fe12cd06cbd87c09e6d8bf13b90d7f8c20e1370150c289a0a5231955c846","9b22fe8b61ab7e8ef9f93b7681f5a225975b3a2f1ea23d1f82706099e5424c06"],
  "openrouter opus 5.5 low analyze-1-all-round1.json": ["20730e64228efe70792300919f1f313ecfe1cd0b7e98079189f9ff6d2192ea30","9794c15aa97f2952b54e46a037d0c2a8fd031cbe7e9bb1200bba9c1a987e71de","b70fd799b2dcc546d539855e6e40bc3a120cd09aab49fca0169a85b3ce4d3377"],
  "openrouter opus 5.5 low extract-1-p1-s2-round1.json": ["2eebc94135f9f2b02bde06a9fb9ce5a12fc1bf97d92598212dfc83f07c8e3cdd","e96e12cf810b6a3e5ffab329eeceb0f0021e0e21ab73b61cf76a8f33d1a9f6b7","fc152362718e3d2aa859cb2d0b58039bc6b7c26f21a4886acbd3f2741dcc062b"],
  "openrouter opus 5.5 low review-1-p1-s1-round1.json": ["9b6e41ad50a869a09519c2b77d529e1776a727200796c46a2d955cfddda46c79","4c78d4c7c53da0ae052b9b0cd9117948f1b9ac3ea544690bb42c57123c4cef64","e3d00c6d5caa61889ec2823ed601276010f82a524e3032be261bb26d130a1471"],
  "openrouter opus 5.5 low apply_review-1-p1-s1-round1.json": ["ade22433c9294fe76b5cd1ac034c9772448ce317b3819d5426e3081e952b07af","ea7c93c02e14d969060f16559f0364e4da8051e7ee5a0101166a9dcb613e5965","5896fc9026d2b082a3cb1dc85f8dd16304d4cc1ada436b2180b509a7a1cb85ba"],
  "openrouter opus 5.5 low mixed": ["6b9b9e60360d7d54d1579350602aae0cf6f3ab38e594b46b7bc321cd84dde272","8f6f768960f4792450ff1cf4336e5f5d7d0af2308a9054253df3add4337459a2","1c31fffa54184418e9936969d3112bb57f621c65ed74bb0f372d34228f73170c"],
};

test("realistic requests have the keys, records and provider requests they had", async () => {
  const realFetch = globalThis.fetch;
  const sent: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    sent.push(await sentHash(input, init));
    return new Response(JSON.stringify({ error: { type: "invalid_request_error", message: "snapshot", code: 400, status: "INVALID_ARGUMENT" } }), { status: 400, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  const got: Record<string, string[]> = {};
  try {
    for (const [label, fields] of CONFIGS) {
      const created = await send("/api/model-configs", { ...fields, name: label });
      assert.equal(created.status, 201, await created.clone().text());
      const config = (await created.json()) as { id: string };
      const pdf = new TextEncoder().encode(`a pdf for ${label}`);
      const project = (await (await createProject(env, pdf)).json()) as { id: string };
      const { stages } = (await (await app.request(`/api/projects/${project.id}/pipeline`, {}, env)).json()) as { stages: { id: string }[] };
      const started = await send(`/api/projects/${project.id}/stages/${stages[1].id}/start`, {
        stepVersion: 1,
        config: {},
        stageKey: crypto.randomUUID().replace(/-/g, "").repeat(2),
        pageCount: 1,
        inputIds: [],
        modelConfigId: config.id,
      });
      assert.equal(started.status, 200, await started.clone().text());
      for (const [name, request] of REQUESTS) {
        sent.length = 0;
        const response = await send(`/api/projects/${project.id}/stages/${stages[1].id}/llm`, { request, item: "p1", round: 1 });
        assert.equal(response.status, 200, await response.clone().text());
        await response.text();
        const row = await env.DB.prepare("SELECT request_key, request_sha256, status FROM llm_calls ORDER BY started_at DESC, rowid DESC LIMIT 1").first<{ request_key: string; request_sha256: string; status: string }>();
        assert.equal(row!.status, "error");
        assert.equal(sent.length, 1, `${label} ${name}: one request to the provider`);
        got[`${label} ${name}`] = [row!.request_key, row!.request_sha256, sent[0]];
      }
      if (label.startsWith("anthropic opus 5.5")) {
        sent.length = 0;
        await (await send(`/api/model-configs/${config.id}/test`)).text();
        const row = await env.DB.prepare("SELECT request_key, request_sha256 FROM llm_calls WHERE stage_id IS NULL").first<{ request_key: string; request_sha256: string }>();
        got[`${label} test`] = [row!.request_key.startsWith("test:") ? "test:<uuid>" : row!.request_key, row!.request_sha256, sent[0]];
      }
    }
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.deepEqual(got, EXPECTED);
});
