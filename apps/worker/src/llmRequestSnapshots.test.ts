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
// Changed once on purpose by the paid release (batch 33): the fixture's requests name their images by new recipe keys
// (the straightened pages' recipes without a deskew version), so their keys and records; the providers' requests,
// which carry the images' bytes and not their keys, are as they were.
const EXPECTED: Record<string, string[]> = {
  "anthropic opus 5.5 high layout-1-p1-round2.json": ["9e65dab634c423ed066f8b0554891471c6cdd3d7452c65c746b071b263cb18c0","09ec35dbeee1b504bb8511695e7be70790a08fc5e26e0140b7f965e399fed485","ab8cc4c9b4605ad41a1c06614d252ec7cae608b3d65f3389d27f861af17c633d"],
  "anthropic opus 5.5 high analyze-1-all-round1.json": ["1ae8b7b2e393187806242833e08a29f685e288b19c30b4134ed0a854711289f6","4a3eaebd2b711f6e7ee55ea9d05d8c2433983893373bb6eaef9a37dee434e87d","c128aaeca3054f212b5d82b74b5ec19d3bdeda427ea086deac910f389799397c"],
  "anthropic opus 5.5 high extract-1-p1-s2-round1.json": ["d77346d768af83fb14344c6a05d2bcceec3d2c10aabff3251dad94785f025e57","69113d6d5a93a67906652e1fe0be0fce4a42e5b0a2f5190e8c4649e6a4a583de","6beed3f6d102326c436a3e330d3377617b56febaf7126987cb6618f424abe292"],
  "anthropic opus 5.5 high review-1-p1-s1-round1.json": ["94d51a5de5a423878a24504158c4a6066db72c63c335f96194b3ed0ae6db24e0","2a63b510968a5dad87f9f907e5793455f79c507826f1cb2605297aea5b4524e6","876cf0325ac8012376bf4d24a812ad1bdc082447f184fce7e68a91b35a0d3e7f"],
  "anthropic opus 5.5 high apply_review-1-p1-s1-round1.json": ["9dcf2e861227f53e2ea2f3353229e65d1bb01618ef7101bfe17dacb62d9ee98d","95182be44287cb3e85b46c6c8014864af81c696c801ff812411a92d876dd9dae","b2f6eea8df09cb44a5c686b440f3d4f48ec0a30956ed76f7954d06234b82cd35"],
  "anthropic opus 5.5 high mixed": ["d76340165e45bc1dbb1e402e9f4160294a40353cdae70f020efad0f706329ee9","8f6f768960f4792450ff1cf4336e5f5d7d0af2308a9054253df3add4337459a2","39203e410aade93ea3e9c3243878b822aa20889ed568dafaaca33d45940f5ff0"],
  "anthropic opus 5.5 high test": ["test:<uuid>","f20f4609c94bbf2ad4de61e5b075815e90fd2777a50deea670e8708b26fbbaf7","2743547e7bffa560858b77037a750e19e9702c1cacf75423c966c417ca244bcf"],
  "anthropic opus 4.8 high (adaptive) layout-1-p1-round2.json": ["bf4208496155e419b6de2716062924e98c541ea224e2a60f4f91aba90f376429","09ec35dbeee1b504bb8511695e7be70790a08fc5e26e0140b7f965e399fed485","acb5199e4505d1a669eb173eda2514919de3f5178f2408ac61c13309dde5b559"],
  "anthropic opus 4.8 high (adaptive) analyze-1-all-round1.json": ["967daf22fd0775ad450774fca033660f2efc13ed23921d1f76425e02d4041754","4a3eaebd2b711f6e7ee55ea9d05d8c2433983893373bb6eaef9a37dee434e87d","550e499ffe0b54399053b9f1b0b12b9553c236be41f31f9dd49186dafd95898e"],
  "anthropic opus 4.8 high (adaptive) extract-1-p1-s2-round1.json": ["066602ac8c76d8a840f73f9552d1fa94031874a731d25b4de0f63539fb416877","69113d6d5a93a67906652e1fe0be0fce4a42e5b0a2f5190e8c4649e6a4a583de","9957d365f4f6b192b26193ee18d0adcedde8d4ae46f5701f15a327ea4b3e7d50"],
  "anthropic opus 4.8 high (adaptive) review-1-p1-s1-round1.json": ["8d7ee0be5b99046ea55e1481627e1428c0da134993bd2f8281f5b00fe69223dd","2a63b510968a5dad87f9f907e5793455f79c507826f1cb2605297aea5b4524e6","8fa06de10272d83f208766a4a289203fc0575f6b29decac9c34d74873eaf918d"],
  "anthropic opus 4.8 high (adaptive) apply_review-1-p1-s1-round1.json": ["10797bc4d5fad7d6de096fe448e6910627d6bd1caaf1c44c89a6afcef6b675b2","95182be44287cb3e85b46c6c8014864af81c696c801ff812411a92d876dd9dae","daa8618f774e36e22e61b095b866c47f6fe6674e960fa0e8f8497ee2089882c4"],
  "anthropic opus 4.8 high (adaptive) mixed": ["b17dcb1dfb6e099417e7f44a7c7d4aab8a873e2fce409bac1bebedeea44c5b39","8f6f768960f4792450ff1cf4336e5f5d7d0af2308a9054253df3add4337459a2","8df103b1110d3c6650ea4212b9dd861a7d8a2e5a782d5f14872a174d83e49e4f"],
  "anthropic haiku 4.5 (no effort) layout-1-p1-round2.json": ["308aa2a10a60b31749854231a0998286c7ccaa4a843e329f9924a6c8f70e4c12","09ec35dbeee1b504bb8511695e7be70790a08fc5e26e0140b7f965e399fed485","a3333c31c19f762c3498b8b81c32cb7e9538cca50de436ed466802ba1dd0f47c"],
  "anthropic haiku 4.5 (no effort) analyze-1-all-round1.json": ["de4d0011622cbfdbdbcb549915256c9f51220d8063962f89ddfe454683213be5","4a3eaebd2b711f6e7ee55ea9d05d8c2433983893373bb6eaef9a37dee434e87d","ddff328e3695427ba1cd947a520206b3f8952017a65ed849ecda335c55bba8c1"],
  "anthropic haiku 4.5 (no effort) extract-1-p1-s2-round1.json": ["cdfe7c105b429bf77ba295282aff0ab260948beb88dd8215b2871356e75507d3","69113d6d5a93a67906652e1fe0be0fce4a42e5b0a2f5190e8c4649e6a4a583de","695c0845a202b70c1e0a9b544922bbe4eb4b5c800f68ff43672de7aa428d737c"],
  "anthropic haiku 4.5 (no effort) review-1-p1-s1-round1.json": ["1854ed934a0bda758bdf12c795236654bc5cd34dc65a915c803bec9114f08b14","2a63b510968a5dad87f9f907e5793455f79c507826f1cb2605297aea5b4524e6","4972e363cb94a79e3ddc196e14fdce364f3ad7ebe4ffdc4facf72079b06b139d"],
  "anthropic haiku 4.5 (no effort) apply_review-1-p1-s1-round1.json": ["be3180f066a4f0d16b564fbb1e0a5229917f626e15aacc7f57723b3576e1f916","95182be44287cb3e85b46c6c8014864af81c696c801ff812411a92d876dd9dae","774e30097503aeb6d96a750bf1ce2799c4aa75d42d71fb853bdedff3b608c9df"],
  "anthropic haiku 4.5 (no effort) mixed": ["d84cf891837376d8572d826bc0610b123293c1271d9159d84149fc409af4be36","8f6f768960f4792450ff1cf4336e5f5d7d0af2308a9054253df3add4337459a2","b9c8eda01066ac16ef737385a7d5139f9611c26f548832cefb011dc09ebd41df"],
  "bedrock opus 5.5 medium eu-central-1 geographic layout-1-p1-round2.json": ["92c2565cfc431fbd43b63915191617b67f06efb5cd2189cb1dc2070cf71b63db","09ec35dbeee1b504bb8511695e7be70790a08fc5e26e0140b7f965e399fed485","f77fec9f2a34d6b52e8b3b580fe15dae152eab916a9a9e05e36cb42dbf1d00e4"],
  "bedrock opus 5.5 medium eu-central-1 geographic analyze-1-all-round1.json": ["f77fcd513267776e5f65dccbfd71864a985404e1f122dc1a9a1dfcf7f8adb465","4a3eaebd2b711f6e7ee55ea9d05d8c2433983893373bb6eaef9a37dee434e87d","31b655d4035fa8477ce1ca5d9800c3fa4a5036dcf66b1ab9bd83ae1197566420"],
  "bedrock opus 5.5 medium eu-central-1 geographic extract-1-p1-s2-round1.json": ["c53056908b871b8f6867ca92bbfebef4512155cdcebb74df1151dc86616f1a4a","69113d6d5a93a67906652e1fe0be0fce4a42e5b0a2f5190e8c4649e6a4a583de","74918eebdd2ce8e064a6fc17b842162bb3df03a03075dcdb5aeada9f5675ea9b"],
  "bedrock opus 5.5 medium eu-central-1 geographic review-1-p1-s1-round1.json": ["d7d5965744386e6c3be2851be35b5591c722e417cd8f85af46fb3ef1042e6936","2a63b510968a5dad87f9f907e5793455f79c507826f1cb2605297aea5b4524e6","8e37a3999e8adcea6be12e5db4ec1a76ff49a3fd133335f78bc27d16acaffa67"],
  "bedrock opus 5.5 medium eu-central-1 geographic apply_review-1-p1-s1-round1.json": ["bf3a8f59caeb25fe313f8130458dea0e881d03c76470d4bc0696a02bcd5ac237","95182be44287cb3e85b46c6c8014864af81c696c801ff812411a92d876dd9dae","df93f23740c289c20199fdae25aaa201bbbdb7f1fcd2cfe34960d8daf7ff8370"],
  "bedrock opus 5.5 medium eu-central-1 geographic mixed": ["aee74bc9f7beebe0ffee6e7136cd1e0a38d93041e4754c3d21bca7f516e02561","8f6f768960f4792450ff1cf4336e5f5d7d0af2308a9054253df3add4337459a2","6deeff93b4b908b6cc450c85f8691e2d0b2b9dab586e4efe5b0ac627b29af81a"],
  "ai-studio gemini 4 argon high layout-1-p1-round2.json": ["9c5f4b9c427aa3c1cc7eca18f492e6bcbb551a8103f1bc292b03c3b9570274e1","09ec35dbeee1b504bb8511695e7be70790a08fc5e26e0140b7f965e399fed485","c18859927a9e9dd315e3209c9332d3862d879e912992d71d83e7d24f41aa6169"],
  "ai-studio gemini 4 argon high analyze-1-all-round1.json": ["50337352c34e821a0a37b4091555a38f3f9ca6288da51f9c718a7f4de880c7ed","4a3eaebd2b711f6e7ee55ea9d05d8c2433983893373bb6eaef9a37dee434e87d","2bdeb923efcd8e9cf160d0cfd309256fe5be58b812cd1b73119f62c657534cee"],
  "ai-studio gemini 4 argon high extract-1-p1-s2-round1.json": ["5ad48faf1fafdc5b9dc89e8d40f3cf05e441017052ffc82dc5dbe5044e026696","69113d6d5a93a67906652e1fe0be0fce4a42e5b0a2f5190e8c4649e6a4a583de","656e30a350bd4b57c5aeaeefb198e90fb9032ebffd176ca6d6920dd4c5257f1c"],
  "ai-studio gemini 4 argon high review-1-p1-s1-round1.json": ["4cb3037237986720c8a4cd36c42df1e255b5a09adb9343cfc8be53b1a0a2dd42","2a63b510968a5dad87f9f907e5793455f79c507826f1cb2605297aea5b4524e6","17a9d644496d09577e2eeb17dfdd90a7c467c5ad4e9e622fc28311425cff1d0d"],
  "ai-studio gemini 4 argon high apply_review-1-p1-s1-round1.json": ["2be3c3eafcbea73772c20184b814889b8da058db5ee619dca8562354dc0a23b4","95182be44287cb3e85b46c6c8014864af81c696c801ff812411a92d876dd9dae","0db1d7d082a32e34059a591610a3297c6bef988c4cb0cfd3f975921e41f0629a"],
  "ai-studio gemini 4 argon high mixed": ["698606f1a537e2b1c9769d1c4a3f8fe7a1c3edb65a1f38a3b7bc2261b5759582","8f6f768960f4792450ff1cf4336e5f5d7d0af2308a9054253df3add4337459a2","be224193981c7312e032196c4cf230ec9ddaa622f7c701d063152b889b145a72"],
  "openrouter opus 5.5 low layout-1-p1-round2.json": ["5ef80c3fab380cd71cbaf8ba38c62d08ea7ecdc5592752d8e898105c19259848","09ec35dbeee1b504bb8511695e7be70790a08fc5e26e0140b7f965e399fed485","9b22fe8b61ab7e8ef9f93b7681f5a225975b3a2f1ea23d1f82706099e5424c06"],
  "openrouter opus 5.5 low analyze-1-all-round1.json": ["8c5cb5e32a2f828f2d833d56ab8a27d420093b1311ec91eab020c05952dd23c5","4a3eaebd2b711f6e7ee55ea9d05d8c2433983893373bb6eaef9a37dee434e87d","b70fd799b2dcc546d539855e6e40bc3a120cd09aab49fca0169a85b3ce4d3377"],
  "openrouter opus 5.5 low extract-1-p1-s2-round1.json": ["7c6221f3831bc2cc27d0aeb47c7753aa82d6f57e25cba110d5243e6da0e7198d","69113d6d5a93a67906652e1fe0be0fce4a42e5b0a2f5190e8c4649e6a4a583de","fc152362718e3d2aa859cb2d0b58039bc6b7c26f21a4886acbd3f2741dcc062b"],
  "openrouter opus 5.5 low review-1-p1-s1-round1.json": ["34a8a5dfd877e4172d9526d8904295546d74a5fb951bf4024ea45881dbf78c80","2a63b510968a5dad87f9f907e5793455f79c507826f1cb2605297aea5b4524e6","e3d00c6d5caa61889ec2823ed601276010f82a524e3032be261bb26d130a1471"],
  "openrouter opus 5.5 low apply_review-1-p1-s1-round1.json": ["0536eeef45d1c910a52ce83baae9faa79de5d0c33b85e459288fe246b060874d","95182be44287cb3e85b46c6c8014864af81c696c801ff812411a92d876dd9dae","5896fc9026d2b082a3cb1dc85f8dd16304d4cc1ada436b2180b509a7a1cb85ba"],
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
