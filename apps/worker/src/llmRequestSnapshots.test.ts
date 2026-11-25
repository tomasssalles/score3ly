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
// which carry the images' bytes and not their keys, are as they were. Batch 34 (the prompts): analyze's, extract's,
// review's and apply_review's keys, records and providers' requests (their texts, schemas and issues, the replay's
// diff read); layout's, the mixed request and the Test unchanged.
const EXPECTED: Record<string, string[]> = {
  "anthropic opus 5.5 high layout-1-p1-round2.json": ["9e65dab634c423ed066f8b0554891471c6cdd3d7452c65c746b071b263cb18c0","09ec35dbeee1b504bb8511695e7be70790a08fc5e26e0140b7f965e399fed485","ab8cc4c9b4605ad41a1c06614d252ec7cae608b3d65f3389d27f861af17c633d"],
  "anthropic opus 5.5 high analyze-1-all-round1.json": ["5cbaea670ae6f13bf5520eeb5a8c039bde3a2c77c9a13f78d3d4d9afa4fdd2f0","a5a4e1492cf845d22a14b11559adcc42fcb697cae1ecda9ebca1cf682ce7ec9b","92df0e61e0b18ed759c15f6ec3e8ac706b89dc7468a584481a7fd3333a54f5b9"],
  "anthropic opus 5.5 high extract-1-p1-s2-round1.json": ["8682efc96a47d944a7bb3aa348709b82fcbf98afb25ea36710e27064d34f115b","94bc69e8686fff6cea912e2a06838e5d20727cf02e97fcdf46858d8f45720fb5","2b667c845410a412fa0eb1d4cac332df46dd765b9c8b07cc170626cb7955cb7e"],
  "anthropic opus 5.5 high review-1-p1-s1-round1.json": ["fa7459ee808a4b925296200559f50539ab205b53d609a0f5367482b389222c1b","bb26b360cdd3f92f38490f40b11985a9eafca69f61513070d52bddb7134a5ecd","d5d003a28611baffefe0ce357aa41baf74277a5c090d1a6163b8e78387e61109"],
  "anthropic opus 5.5 high apply_review-1-p1-s1-round1.json": ["9e050d033505f7ad47786034436f92d686972adec38b7e2cdeca9ac5c7855a39","159c62fc620ea64af3bd11c13120ff72a537d38ae75ceee9257d0c2c3a99843a","c71e3dc6a22373f62fd6afa4f9fe8dfa4c09104a78b46c372150af84c557ec3b"],
  "anthropic opus 5.5 high mixed": ["d76340165e45bc1dbb1e402e9f4160294a40353cdae70f020efad0f706329ee9","8f6f768960f4792450ff1cf4336e5f5d7d0af2308a9054253df3add4337459a2","39203e410aade93ea3e9c3243878b822aa20889ed568dafaaca33d45940f5ff0"],
  "anthropic opus 5.5 high test": ["test:<uuid>","f20f4609c94bbf2ad4de61e5b075815e90fd2777a50deea670e8708b26fbbaf7","2743547e7bffa560858b77037a750e19e9702c1cacf75423c966c417ca244bcf"],
  "anthropic opus 4.8 high (adaptive) layout-1-p1-round2.json": ["bf4208496155e419b6de2716062924e98c541ea224e2a60f4f91aba90f376429","09ec35dbeee1b504bb8511695e7be70790a08fc5e26e0140b7f965e399fed485","acb5199e4505d1a669eb173eda2514919de3f5178f2408ac61c13309dde5b559"],
  "anthropic opus 4.8 high (adaptive) analyze-1-all-round1.json": ["60a6aee000b3d8aae4166700f716102b0f17af793ca77fa71422c909ce261d9a","a5a4e1492cf845d22a14b11559adcc42fcb697cae1ecda9ebca1cf682ce7ec9b","1ebddf9d4a5b0bcdd195eca981a9d512de5fb214af14fa37eb6d8bbe992eb389"],
  "anthropic opus 4.8 high (adaptive) extract-1-p1-s2-round1.json": ["904ca3bc5a219e85260bf3a50830eed85d2335223472a7fdf9a0a7ca015e5264","94bc69e8686fff6cea912e2a06838e5d20727cf02e97fcdf46858d8f45720fb5","4f8159d4a36abdeab227d96d51ade07868056f7a9c1731e39eb0dbbebeb2de39"],
  "anthropic opus 4.8 high (adaptive) review-1-p1-s1-round1.json": ["b95876e4af2a891144514864b111a2fe5797bf4a8bcac68ad56a82fddb8ceb62","bb26b360cdd3f92f38490f40b11985a9eafca69f61513070d52bddb7134a5ecd","9b9e1d3a207785f93e70a5341321c95ac7ee6f4907fe9c7e292ce73529819088"],
  "anthropic opus 4.8 high (adaptive) apply_review-1-p1-s1-round1.json": ["8dddc9d0a6e960c2ba2cae68c8e52da3690820ec849d39ec035519725ce386e2","159c62fc620ea64af3bd11c13120ff72a537d38ae75ceee9257d0c2c3a99843a","3ba42a3db6073246973eae31bcaf668008f40524155feb898fbc95ef91a0ff81"],
  "anthropic opus 4.8 high (adaptive) mixed": ["b17dcb1dfb6e099417e7f44a7c7d4aab8a873e2fce409bac1bebedeea44c5b39","8f6f768960f4792450ff1cf4336e5f5d7d0af2308a9054253df3add4337459a2","8df103b1110d3c6650ea4212b9dd861a7d8a2e5a782d5f14872a174d83e49e4f"],
  "anthropic haiku 4.5 (no effort) layout-1-p1-round2.json": ["308aa2a10a60b31749854231a0998286c7ccaa4a843e329f9924a6c8f70e4c12","09ec35dbeee1b504bb8511695e7be70790a08fc5e26e0140b7f965e399fed485","a3333c31c19f762c3498b8b81c32cb7e9538cca50de436ed466802ba1dd0f47c"],
  "anthropic haiku 4.5 (no effort) analyze-1-all-round1.json": ["e6b2cd0c834db854df29517b24b6751bea3674d85cc302d4985d9962caf0911d","a5a4e1492cf845d22a14b11559adcc42fcb697cae1ecda9ebca1cf682ce7ec9b","03089d8a85636687d73755eb3e9ce2d6aec795f2960c39aaf621bd69efa411e3"],
  "anthropic haiku 4.5 (no effort) extract-1-p1-s2-round1.json": ["0d25d30defd89790b1ca947a63c0acc9959669a04e6d113af0b9d15270dd0d10","94bc69e8686fff6cea912e2a06838e5d20727cf02e97fcdf46858d8f45720fb5","ef60ccdd92ec84b15eb4a47d14e8d0ed74efa8556061c8ec2ed130d09c4a4790"],
  "anthropic haiku 4.5 (no effort) review-1-p1-s1-round1.json": ["af02071890ff9ad0d4ee3d6eacd6a179eab6dfa3e1a508a6ff98137ff314f4bb","bb26b360cdd3f92f38490f40b11985a9eafca69f61513070d52bddb7134a5ecd","c8a8342e305d39b12034fc34fab8da1b2f25108fef4bce6c7f25df2d176b86f4"],
  "anthropic haiku 4.5 (no effort) apply_review-1-p1-s1-round1.json": ["d8bac20e34c1ef76655ac2318f42d687da6ed7df9beeb966de55637c73969da2","159c62fc620ea64af3bd11c13120ff72a537d38ae75ceee9257d0c2c3a99843a","3d4e79e82c356cb579b01aa6542bd029a191c0e9b77b50784e5b85a35fa710e9"],
  "anthropic haiku 4.5 (no effort) mixed": ["d84cf891837376d8572d826bc0610b123293c1271d9159d84149fc409af4be36","8f6f768960f4792450ff1cf4336e5f5d7d0af2308a9054253df3add4337459a2","b9c8eda01066ac16ef737385a7d5139f9611c26f548832cefb011dc09ebd41df"],
  "bedrock opus 5.5 medium eu-central-1 geographic layout-1-p1-round2.json": ["92c2565cfc431fbd43b63915191617b67f06efb5cd2189cb1dc2070cf71b63db","09ec35dbeee1b504bb8511695e7be70790a08fc5e26e0140b7f965e399fed485","f77fec9f2a34d6b52e8b3b580fe15dae152eab916a9a9e05e36cb42dbf1d00e4"],
  "bedrock opus 5.5 medium eu-central-1 geographic analyze-1-all-round1.json": ["15103b3a418d60b1b0086a0a8772ffe609cf7c279a913f21c2356552ea7742c0","a5a4e1492cf845d22a14b11559adcc42fcb697cae1ecda9ebca1cf682ce7ec9b","6528e45ca0b56c6fc390479e89ca54ffa1bc931f349cc72affb5329fadc35c45"],
  "bedrock opus 5.5 medium eu-central-1 geographic extract-1-p1-s2-round1.json": ["c37676e8ee1479efc552830e51e6adb096acf3a43b18ac4e68d6dd95777358f3","94bc69e8686fff6cea912e2a06838e5d20727cf02e97fcdf46858d8f45720fb5","0a4213ddc0d4950f762a5523c9e7cbd0ddc7fc6fa5c6eadee085b610f9982cd4"],
  "bedrock opus 5.5 medium eu-central-1 geographic review-1-p1-s1-round1.json": ["bffe72e8895cc9dc37b616e8b235c0fc2034ba10c91825d702203a76d08b543a","bb26b360cdd3f92f38490f40b11985a9eafca69f61513070d52bddb7134a5ecd","9f8db0354eac2c113613ae70e3e38489112079ca168c63ec87562569b038a7b2"],
  "bedrock opus 5.5 medium eu-central-1 geographic apply_review-1-p1-s1-round1.json": ["e163fed6f7a8950bc8e5e9c8a93171d0a818496991328411ed6343073323ae79","159c62fc620ea64af3bd11c13120ff72a537d38ae75ceee9257d0c2c3a99843a","f4461484dcb2715b6b9068ee8b763bda413cb5981e10b7402658ec57c6f3bf07"],
  "bedrock opus 5.5 medium eu-central-1 geographic mixed": ["aee74bc9f7beebe0ffee6e7136cd1e0a38d93041e4754c3d21bca7f516e02561","8f6f768960f4792450ff1cf4336e5f5d7d0af2308a9054253df3add4337459a2","6deeff93b4b908b6cc450c85f8691e2d0b2b9dab586e4efe5b0ac627b29af81a"],
  "ai-studio gemini 4 argon high layout-1-p1-round2.json": ["9c5f4b9c427aa3c1cc7eca18f492e6bcbb551a8103f1bc292b03c3b9570274e1","09ec35dbeee1b504bb8511695e7be70790a08fc5e26e0140b7f965e399fed485","c18859927a9e9dd315e3209c9332d3862d879e912992d71d83e7d24f41aa6169"],
  "ai-studio gemini 4 argon high analyze-1-all-round1.json": ["5ca9fb39d5b1969120a222de374579d69b3fd1c4d69ca0aae8a4e3ccfa5580ad","a5a4e1492cf845d22a14b11559adcc42fcb697cae1ecda9ebca1cf682ce7ec9b","d563948ded68e47af4b6c19643e49d526adc4bcfa18217e2635616c87ee33a2e"],
  "ai-studio gemini 4 argon high extract-1-p1-s2-round1.json": ["a2c08f84a7fcbd06d4765e97a583731ab94167c2d83855d9c77256b6af8f8fb2","94bc69e8686fff6cea912e2a06838e5d20727cf02e97fcdf46858d8f45720fb5","b008f884de0bbddea6b24499230cf79607a7b23b51bd3aa8d933aff15027da2c"],
  "ai-studio gemini 4 argon high review-1-p1-s1-round1.json": ["62f57f3c54af6e281c0f1f361819568881475d17a0632466b5d25d40abe80922","bb26b360cdd3f92f38490f40b11985a9eafca69f61513070d52bddb7134a5ecd","c7ac7d657bae124eb95cf41b7a3c1067f5c771e22f498b398cec0b53bb34b780"],
  "ai-studio gemini 4 argon high apply_review-1-p1-s1-round1.json": ["c6b5f6d0e1ffb6a30301824be7386815a0ff5425a6790d90b827d339570f90e7","159c62fc620ea64af3bd11c13120ff72a537d38ae75ceee9257d0c2c3a99843a","6c8281d5b4c681c6d2655ea3f095d9c33783a51a2fe77f9cc1b1569d95bd831b"],
  "ai-studio gemini 4 argon high mixed": ["698606f1a537e2b1c9769d1c4a3f8fe7a1c3edb65a1f38a3b7bc2261b5759582","8f6f768960f4792450ff1cf4336e5f5d7d0af2308a9054253df3add4337459a2","be224193981c7312e032196c4cf230ec9ddaa622f7c701d063152b889b145a72"],
  "openrouter opus 5.5 low layout-1-p1-round2.json": ["5ef80c3fab380cd71cbaf8ba38c62d08ea7ecdc5592752d8e898105c19259848","09ec35dbeee1b504bb8511695e7be70790a08fc5e26e0140b7f965e399fed485","9b22fe8b61ab7e8ef9f93b7681f5a225975b3a2f1ea23d1f82706099e5424c06"],
  "openrouter opus 5.5 low analyze-1-all-round1.json": ["0e95c49d299cc5e1ff24b9ea2cc11949f7b92747ee2c448728ad502a26e0a617","a5a4e1492cf845d22a14b11559adcc42fcb697cae1ecda9ebca1cf682ce7ec9b","816b43b5978678440eb0163983c50848aad95fec818dd22bb76a6d93030e4472"],
  "openrouter opus 5.5 low extract-1-p1-s2-round1.json": ["c06e43ac247f2ca2e855aa8e9451aa95cecc4d289a3222f2cb41eeed631d8f95","94bc69e8686fff6cea912e2a06838e5d20727cf02e97fcdf46858d8f45720fb5","5f2a3e69595ab446d20428df7557e7a91bf59a35d88ad51da376d28db4b2811e"],
  "openrouter opus 5.5 low review-1-p1-s1-round1.json": ["4f112aab95dea6546e960c7613bd63fcc9efb67a430db869c3a1f3a923db4549","bb26b360cdd3f92f38490f40b11985a9eafca69f61513070d52bddb7134a5ecd","9fa8ee363b2af1aecc69ed50f5c17757c53d52eb853a58794c0715488b4ca175"],
  "openrouter opus 5.5 low apply_review-1-p1-s1-round1.json": ["7d3519d7750a54f5089c0da063adc87a56bc50acc094351a904ad86bc073d1f0","159c62fc620ea64af3bd11c13120ff72a537d38ae75ceee9257d0c2c3a99843a","4a917ab1ff9638225c879176433a5fc2c8e35d6263d36daa0e385de599062570"],
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
