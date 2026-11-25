// Snapshots of the request keys and of the recorded requests (docs/overview.md §5.2, docs/llm.md), taken before the
// code review's batch 7 moved the key, hash and base64 code into @score3ly/core: the same request must give the same
// key, or every LLM call is paid again. The requests are the replay fixture's (fixtures/replay/fake/requests: built by
// the app's prompts, schemas and stages), each image given bytes. Only a change that means to change request keys (the
// paid release) may update them.

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createProject, testPlatform } from "./testPlatform.ts";
import app from "./index.ts";

let platform: Awaited<ReturnType<typeof testPlatform>>;
let env: Env;

before(async () => {
  platform = await testPlatform();
  env = platform.env;
  (env as unknown as Record<string, string>).DEV_PROVIDERS = "true";
});

after(async () => {
  await platform.dispose();
});

function send(path: string, body: unknown) {
  return app.request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, env);
}

// Every byte value, so that the base64 decoding before the recorded hash is tested whole.
const BYTES = Uint8Array.from({ length: 777 }, (_, i) => (i * 7 + (i >> 8)) & 0xff);
const BASE64 = btoa(String.fromCharCode(...BYTES));

type Content = { type: string; recipeKey?: string; image?: unknown };

function withImages(request: { messages: { content: Content[] }[] }): unknown {
  return {
    ...request,
    messages: request.messages.map((m) => ({
      ...m,
      content: m.content.map((c) => (c.type === "image" ? { ...c, image: { mediaType: "image/png", base64: BASE64 } } : c)),
    })),
  };
}

// For each fixture request and effort: the request key, and the hash of the request as recorded. Changed once on
// purpose by the paid release (batch 33): the fixture's requests name their images by new recipe keys (the
// straightened pages' recipes without a deskew version), and nothing else in them changed.
const EXPECTED: Record<string, [string, string]> = {
  "analyze-1-all-round1.json high": ["5912eec1310630120fccdb0ed89b832f2f0e91272bab294d3624deb502506d0b", "910abad9583b2a2ad3ac50e3661a72507a83644158f629eb43f17f16ad207460"],
  "analyze-1-p1-round1.json high": ["3c6bb17ae8da7dcc3adc453d2fd89336d4375728b28a1091abea6571d6e467b4", "5f8e97792b36792de7bd2a7f9d25d8b74f112fac9487c6d2c0c9a3525b9d528b"],
  "apply_review-1-p1-s1-round1.json high": ["a62b60eb7108bb4f5de4365b9cb6eb133cb16ce4e0c3a7ef9ebba823b32c2c1f", "fff702e45b158e0b5a492d8dc7eb524dd44363a9e264a4d4b57523442bfc1f1e"],
  "apply_review-1-p1-s2-round1.json high": ["ce42ee13efb1a4a19aafdc1027377ee2de0dbc8fd4d1f910a82a0a88411ddbad", "111bbf0646a6647b46ec9360fb8659758704fcac0497fe64132b0eba205245ab"],
  "extract-1-p1-s1-round1.json high": ["e63bbe9e0769d24f389d101b2c6a6e046e9bcabcf84971f7415d014544da8cc6", "4428c2522e63204474535d5663d0c0c98565559006139ed0e2ff5e96642dbd1b"],
  "extract-1-p1-s2-round1.json high": ["f1b570e20c8ecc3e16d98cd29b002ff0786911bedc6cb59244291ecf94559f2e", "120afc6c65bd70b1f2508c6a5f194997a1cde089d4af0f4fac483c57797aa355"],
  "extract-1-p1-s3-round1.json high": ["3f6d864f2b4b8267e2cc6e385cf2852b77997998dad13b8e1749d0c3dcca71a6", "309a1d92b6dd7247033b1c7d439a25970839f0829331383fe9cd1b8308aa0913"],
  "extract-1-p1-s4-round1.json high": ["aa5d664d98a90a46cfb68f4c21ef202648dc5d6c050ecd2b9cbf3fc5fb1d9efa", "7f331fa4f17d03e629f167c660ad4d5486db1258eadb523127fdc876b0763a2e"],
  "extract-1-p1-s5-round1.json high": ["33f81a995c96133638952cf3d0cd7844a3d383ee0f67f80bdbd00cfc0d163ac8", "d90af5f83fac06194ea1f2e3bb563eca79db5124d7be3bde743888e409e0d66b"],
  "extract-1-p1-s6-round1.json high": ["67bd0c9eda982e48453968927572e8d707775952e93e253188fb853c6cb15f13", "54139170229d27d0cfd3a5ce202bf39b0f2add321bcd05e932f9bc17fcc43332"],
  "layout-1-p1-round1.json high": ["d54b705bd5fcba30a9a6f8ff662cfc4051663571d994605cd4b6a12f2ee22a32", "fa225b1d733ef18987df0dbd3c9f16ce7ce4b8d1dd2e460ae479ab5c57595a38"],
  "layout-1-p1-round2.json high": ["771f3232997dc318381b3e109189635c04a0ac6250e6eac8985a8679b348a639", "07c011d52bdca484596d2ee77ca0381b94dd34c77ea7ee9221d44ec2accefdc0"],
  "review-1-p1-s1-round1.json high": ["6fca79c3829776ad6f5e1993cb4f54acbfd88a136a366fad40576a2fdf8c407d", "70aed73796bc2492326237f504aa9da4e189d7a045cebb8aa8c23a30a0161109"],
  "review-1-p1-s2-round1.json high": ["f3e59cd94f6ac80a97552185550fb078c1add69b2c0774d37590319a6d360fe5", "65f9123dce67de8cea01cfb576f28843d9e963fdd4023404b237ca902a1f85fe"],
  "review-1-p1-s3-round1.json high": ["834fa294600497c7cf8f3b75741275cdd2e7fa678e4bb6f50682f6e583f6f83d", "d69ba2bf3d8f11455fec48158abe26a125d348285aa6d5b535f44ae0bc86d01d"],
  "review-1-p1-s4-round1.json high": ["ccd8724c777b889aa46f1895bf89dcddd3b7530c7445f980079403e1e785519e", "3de83f8330258dc6d6e1efd2452c6a40326b0dd1240089cc6870c05b8b474c69"],
  "review-1-p1-s5-round1.json high": ["2be0a2647bb562e3b3f392d334882888f9ed2df17cbc09db9ebe70ea735e4994", "dbdd656e86471f63dd05e046ecb2fdb17a4523174c492b15be6dfb821c62af1b"],
  "review-1-p1-s6-round1.json high": ["da46163825254298800e8989d6d1ab43481dadb09f8aea98a5f3d7a449713fac", "b7fa492781e603ea1fe00de07944425221c97fe9b2068876ee9fa80a5e5895c2"],
  "analyze-1-all-round1.json low": ["8b7f234a15e780ff99c68e3b803e1eae48f76ad86af0b5dfdd7e28a0d909867e", "910abad9583b2a2ad3ac50e3661a72507a83644158f629eb43f17f16ad207460"],
  "analyze-1-p1-round1.json low": ["7baa055c2e87492c324e6321a2025eb8cac8a1ebc53ef51cc66498953093519a", "5f8e97792b36792de7bd2a7f9d25d8b74f112fac9487c6d2c0c9a3525b9d528b"],
  "apply_review-1-p1-s1-round1.json low": ["4e0906ca39a65058bd27fce43bc330c09c72c3266a1543c861860288efa5d029", "fff702e45b158e0b5a492d8dc7eb524dd44363a9e264a4d4b57523442bfc1f1e"],
  "apply_review-1-p1-s2-round1.json low": ["7361c65acdeac228d798723baee790d08a48f4d94c61fa91b177b614cf9cc216", "111bbf0646a6647b46ec9360fb8659758704fcac0497fe64132b0eba205245ab"],
  "extract-1-p1-s1-round1.json low": ["68e8e5ba9a03f27b153a5911e88161c3a38cdd85f3a1681b1e64209c3129f68c", "4428c2522e63204474535d5663d0c0c98565559006139ed0e2ff5e96642dbd1b"],
  "extract-1-p1-s2-round1.json low": ["b5b83950a639f1f11de87d6fc0a8320ab5b543798bc7bda39d1028ba33d72425", "120afc6c65bd70b1f2508c6a5f194997a1cde089d4af0f4fac483c57797aa355"],
  "extract-1-p1-s3-round1.json low": ["9df6017218406d30114c79731a86871fcdd6229af141380ede6f25c32415e7d5", "309a1d92b6dd7247033b1c7d439a25970839f0829331383fe9cd1b8308aa0913"],
  "extract-1-p1-s4-round1.json low": ["86398d32402d25e3ad72f66caae8073d9c5a7ed30dc5d91596e44cb4e9e59245", "7f331fa4f17d03e629f167c660ad4d5486db1258eadb523127fdc876b0763a2e"],
  "extract-1-p1-s5-round1.json low": ["7fcee6b350019eb3d1c28bc62c8c94e10148786794d095428833958dcb855f53", "d90af5f83fac06194ea1f2e3bb563eca79db5124d7be3bde743888e409e0d66b"],
  "extract-1-p1-s6-round1.json low": ["cf047c2ba4e0bbf8431da34dd74801837958829d4829a66d8326a4ebf0622459", "54139170229d27d0cfd3a5ce202bf39b0f2add321bcd05e932f9bc17fcc43332"],
  "layout-1-p1-round1.json low": ["ebb22810b825cf1b7f2a79d73a2153e77ed163df308a654aa34090bdbe06bfaf", "fa225b1d733ef18987df0dbd3c9f16ce7ce4b8d1dd2e460ae479ab5c57595a38"],
  "layout-1-p1-round2.json low": ["fb02753d5310c74baadf54b84e0b1dfe64eb7c7287f5130b5f17be31ad9a0baa", "07c011d52bdca484596d2ee77ca0381b94dd34c77ea7ee9221d44ec2accefdc0"],
  "review-1-p1-s1-round1.json low": ["20f4312c38fdb52a8e531fca6f561229dc3336681763cbf6d1959f3527f4ed6f", "70aed73796bc2492326237f504aa9da4e189d7a045cebb8aa8c23a30a0161109"],
  "review-1-p1-s2-round1.json low": ["8e3fe512a1d1f750e3c4ce5a34468da47815c6f6f0f7bc6c8ae51cd97fc56d1a", "65f9123dce67de8cea01cfb576f28843d9e963fdd4023404b237ca902a1f85fe"],
  "review-1-p1-s3-round1.json low": ["17532ec3b0c74264939181b922167b50902bbe3d513efc431223bc6479bbc5fc", "d69ba2bf3d8f11455fec48158abe26a125d348285aa6d5b535f44ae0bc86d01d"],
  "review-1-p1-s4-round1.json low": ["181d31bbf1ea72bf8cddf93ffedeca18983eb7569e120928a30cafd16e5a6784", "3de83f8330258dc6d6e1efd2452c6a40326b0dd1240089cc6870c05b8b474c69"],
  "review-1-p1-s5-round1.json low": ["402d02bba7d285eaf9b96de4688a068b6f9e5ce0b21d451da1001108c95c673e", "dbdd656e86471f63dd05e046ecb2fdb17a4523174c492b15be6dfb821c62af1b"],
  "review-1-p1-s6-round1.json low": ["e0ab412368527d0e7ac05200a47c43ed04bf47a848d82c99f1f9cfa5e622ec9c", "b7fa492781e603ea1fe00de07944425221c97fe9b2068876ee9fa80a5e5895c2"],
};

test("the fixture's requests have the request keys and recorded hashes they had", async () => {
  const dir = join(import.meta.dirname, "../../../fixtures/replay/fake/requests");
  const got: Record<string, [string, string]> = {};
  for (const effort of ["high", "low"]) {
    const pdf = new TextEncoder().encode(`a pdf for the snapshots, ${effort}`);
    const project = (await (await createProject(env, pdf)).json()) as { id: string };
    const config = (await (
      await send("/api/model-configs", { provider: "fake-dev", modelString: "fake-model", family: "fake", effort, pricing: { kind: "free" } })
    ).json()) as { id: string };
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
    for (const file of readdirSync(dir).sort()) {
      const request = withImages(JSON.parse(readFileSync(join(dir, file), "utf8")));
      const response = await send(`/api/projects/${project.id}/stages/${stages[1].id}/llm`, { request, item: "p1", round: 1 });
      await response.text();
      const row = await env.DB.prepare("SELECT request_key, request_sha256 FROM llm_calls ORDER BY started_at DESC, rowid DESC LIMIT 1").first<{ request_key: string; request_sha256: string }>();
      got[`${file} ${effort}`] = [row!.request_key, row!.request_sha256];
    }
  }
  assert.deepEqual(got, EXPECTED);
});
