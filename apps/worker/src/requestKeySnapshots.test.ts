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
// straightened pages' recipes without a deskew version), and nothing else in them changed. Batch 34 (the prompts): every
// request of analyze, extract, review and apply_review (texts, schemas, issues: the replay's diff read); layout's not.
const EXPECTED: Record<string, [string, string]> = {
  "analyze-1-all-round1.json high": ["b2b15ef8bd2bff7f8d8f1728378eb442ede2f11032662cfd9884e8c07b55ef62", "15c31301b609a96f88647eb7a55139f92c8dc74bc16f5bb3982b257c350c596b"],
  "analyze-1-p1-round1.json high": ["dff7ce7d553569e6a1c118106cd87fd5e75b87e2a443b88316cbe2314d1ba1a5", "25888a19562516ff11b0ae00353817d3a133541c0b1602513f7b69c0ca736607"],
  "apply_review-1-p1-s1-round1.json high": ["ddc52d2b234410b85cf8218791da58afcf23aef9bd981d3a6a0cb85487b33626", "8f61a9ef6ac425e9aa914650b383e3c0594acac0934ce7edec9f161aeeb1351c"],
  "apply_review-1-p1-s2-round1.json high": ["4d28b8d4646de240f59f80897ce9e03ff2e2a374b0464251b1bed919813f5b71", "caf6656fc188ae81d3128a90b75c0381fc63bb8adc9d84d90e9d941c22378d92"],
  "extract-1-p1-s1-round1.json high": ["f26334853dba434154139675ee0a83c888a74629932626046770f7f355ada2da", "c71d2e875ff75a8f4a308c4e29a14c872d0ff2a2dc99aa092faa54080f3835a4"],
  "extract-1-p1-s2-round1.json high": ["117d0760b42498b2599c0d7607a65b2d6b7eb0a099b46a7f1f5d16651f4cdead", "29d863a37f66b3f035a05d89ada5452db053f508fb4f86e3ad72b0efadaa38e7"],
  "extract-1-p1-s3-round1.json high": ["4e65ad4a1076127927daeac44913fccef0f086ae66a6d6e884e06ccd0ddc959a", "1d323a54de1e171cd225fee5eb9ada4c258859bd6904df1dcd107ce68025a4a3"],
  "extract-1-p1-s4-round1.json high": ["732b3cfaa0951ccfd840c1f49e7696225c7096a48bb5042052b749dfda95b2da", "b0690fd29395a88c37f2e6af8968b69593144668c14a6d67513e8ad37cb15645"],
  "extract-1-p1-s5-round1.json high": ["9b300576ca2ccbb4237e8c0e93b89b1750b463a4af7c86e224cee69b41ba51d7", "60458b82e865c0012be2bcab4eeeadd4e3850623bd8886acb306f687c0e03f0b"],
  "extract-1-p1-s6-round1.json high": ["ac778fa3d8a6bf44a7707a95a7a124f1bb5a6e38238df1085e371faa9371bf0f", "724ada37f08a0f0927415c67fff54b4f8af6f356a9067bb1e334c8a2057b06cc"],
  "layout-1-p1-round1.json high": ["d54b705bd5fcba30a9a6f8ff662cfc4051663571d994605cd4b6a12f2ee22a32", "fa225b1d733ef18987df0dbd3c9f16ce7ce4b8d1dd2e460ae479ab5c57595a38"],
  "layout-1-p1-round2.json high": ["771f3232997dc318381b3e109189635c04a0ac6250e6eac8985a8679b348a639", "07c011d52bdca484596d2ee77ca0381b94dd34c77ea7ee9221d44ec2accefdc0"],
  "review-1-p1-s1-round1.json high": ["52383dc8025f2fc3e9716e99f7a873f868be0c118d228cfccdc350940c0dc1f2", "3e8ff4ade42b36a35a75bef2f0e3e5f86ef88ae60432dc857c03a4aaede96ed9"],
  "review-1-p1-s2-round1.json high": ["5b2a05521a29ed179fad9367480311634b277d3d70ecbb225d1e3d844a628226", "09e4dd67e4ec2650b20df74e095959416c80fa7a61ed33422dc56004cebfb438"],
  "review-1-p1-s3-round1.json high": ["bfd46f67100279f573e6df5a07fb9c61f19c8f122be71cfe59695979d3713429", "68a2a6ce199c11b14419a848dba25418ebd4098d811d28bb92f8596a96e4b476"],
  "review-1-p1-s4-round1.json high": ["1a8aa9c53bfda556444f40f38c453a415d93f3f231813ddaa5e842fe98b556ce", "983410b91d51c7868885219ff8e05da7b730d209da5ad8eae2342a4436b1abe5"],
  "review-1-p1-s5-round1.json high": ["aab7dab5fccb862af323e2c01f91e2cae03b51d46daa36c152c425bb9d79fa6e", "88f2ed630d891a1b3592021d1a054d646247a0f1f496ee1b7dae040a22a2cb6c"],
  "review-1-p1-s6-round1.json high": ["f172b3e53d68680e4a2488c3a69ee1226f065d872d9340b50690c1840e08d425", "a5d9466452876110ee7e059a61ebb93648f06bf98fd83652ecda95b192594f0d"],
  "analyze-1-all-round1.json low": ["ac6654dde848572ea70d05361916a5b2762de90ef4b7fb3aa7b5169471293088", "15c31301b609a96f88647eb7a55139f92c8dc74bc16f5bb3982b257c350c596b"],
  "analyze-1-p1-round1.json low": ["24f7ca55f10f435a1546fa2082cd5045b79575b80735e6561add81940f6c9932", "25888a19562516ff11b0ae00353817d3a133541c0b1602513f7b69c0ca736607"],
  "apply_review-1-p1-s1-round1.json low": ["c10a6dd25ff2a925fedc5b67e84febc3740d79e6534cad56d221055d829ceeef", "8f61a9ef6ac425e9aa914650b383e3c0594acac0934ce7edec9f161aeeb1351c"],
  "apply_review-1-p1-s2-round1.json low": ["73eec41c58c4d6c4287c60d18204e0af9884113fce9aca8a7217d481fc82911c", "caf6656fc188ae81d3128a90b75c0381fc63bb8adc9d84d90e9d941c22378d92"],
  "extract-1-p1-s1-round1.json low": ["26ba0c967e3d66f8c3f5fc88791c2c2afeaebb8905b35e62a46cb32cc7b0620f", "c71d2e875ff75a8f4a308c4e29a14c872d0ff2a2dc99aa092faa54080f3835a4"],
  "extract-1-p1-s2-round1.json low": ["135d76f9d52685cb289dba87c24db3df5b9704f2a4d5254a84f4eb556073e7af", "29d863a37f66b3f035a05d89ada5452db053f508fb4f86e3ad72b0efadaa38e7"],
  "extract-1-p1-s3-round1.json low": ["5815d32a4590779e5a725b60365b966fe0452e6912005da4a6c2b06d7553192b", "1d323a54de1e171cd225fee5eb9ada4c258859bd6904df1dcd107ce68025a4a3"],
  "extract-1-p1-s4-round1.json low": ["7dc1b85d19ef64c534cc105bb5b81f6d1623c5e58513631e829179d0359de608", "b0690fd29395a88c37f2e6af8968b69593144668c14a6d67513e8ad37cb15645"],
  "extract-1-p1-s5-round1.json low": ["7ef2bd78062ad4ed28611f88f3d91b9b39b9ff3af0d3b54563740239356d3bc9", "60458b82e865c0012be2bcab4eeeadd4e3850623bd8886acb306f687c0e03f0b"],
  "extract-1-p1-s6-round1.json low": ["b07adba2524ccc74fbfa07d4fc8161970c30952f2e2336b39b9a3e0f7f9606d8", "724ada37f08a0f0927415c67fff54b4f8af6f356a9067bb1e334c8a2057b06cc"],
  "layout-1-p1-round1.json low": ["ebb22810b825cf1b7f2a79d73a2153e77ed163df308a654aa34090bdbe06bfaf", "fa225b1d733ef18987df0dbd3c9f16ce7ce4b8d1dd2e460ae479ab5c57595a38"],
  "layout-1-p1-round2.json low": ["fb02753d5310c74baadf54b84e0b1dfe64eb7c7287f5130b5f17be31ad9a0baa", "07c011d52bdca484596d2ee77ca0381b94dd34c77ea7ee9221d44ec2accefdc0"],
  "review-1-p1-s1-round1.json low": ["bcc2822cd5e2f8e26c204733e9555fed5b5e13a15b1accc84967b375925d7174", "3e8ff4ade42b36a35a75bef2f0e3e5f86ef88ae60432dc857c03a4aaede96ed9"],
  "review-1-p1-s2-round1.json low": ["8c2dd267008ad5edcb6a354153019413cca1dc2281d47e74872c55734a7dc327", "09e4dd67e4ec2650b20df74e095959416c80fa7a61ed33422dc56004cebfb438"],
  "review-1-p1-s3-round1.json low": ["0c2e1ab4b6c44e0abfb36123b8c8030a8dfefc76b0dfe512f5bf3d50dd8e7879", "68a2a6ce199c11b14419a848dba25418ebd4098d811d28bb92f8596a96e4b476"],
  "review-1-p1-s4-round1.json low": ["fe03aebf15f620b526e3a7f811a79491ddd81cdf6a0adc8b09b9129a77e264c5", "983410b91d51c7868885219ff8e05da7b730d209da5ad8eae2342a4436b1abe5"],
  "review-1-p1-s5-round1.json low": ["ec67ac8719a2573876876b1108c3a1618506791db7b29c33996aa649c32527ba", "88f2ed630d891a1b3592021d1a054d646247a0f1f496ee1b7dae040a22a2cb6c"],
  "review-1-p1-s6-round1.json low": ["d912aabb0329ce1f21f810c3cd2fa7c83dbaec0dd1261b387f86c6e4b48ea8e0", "a5d9466452876110ee7e059a61ebb93648f06bf98fd83652ecda95b192594f0d"],
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
