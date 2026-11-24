// Snapshots of the request keys and of the recorded requests (docs/overview.md §5.2, docs/llm.md), taken before the
// code review's batch 7 moved the key, hash and base64 code into @score3ly/core: the same request must give the same
// key, or every LLM call is paid again. The requests are the replay fixture's (fixtures/replay/fake/requests: built by
// the app's prompts, schemas and stages), each image given bytes. Only a change that means to change request keys (the
// paid release) may update them.

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { testPlatform } from "./testPlatform.ts";
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

// For each fixture request and effort: the request key, and the hash of the request as recorded.
const EXPECTED: Record<string, [string, string]> = {
  "analyze-1-all-round1.json high": ["c114488c2ba339192fb4bf442a6f84c6f478c09410a803755d129ba2e2dcf6a0", "7b4f7afca6e67daf83bb8a5cc5f95f8981093daee489fad3ae5a366cd969ce72"],
  "analyze-1-p1-round1.json high": ["cd0ba59bd848913938aa53317d38ff1597a82a5827e1a7d9c90d247f795db67c", "325e9cb00d7d85b8246ae53107f92b4ade4819238dbd42ddafa54d567ccca7cd"],
  "apply_review-1-p1-s1-round1.json high": ["098dc72db0fda41bdea6d3cea7c64701132bd98e625130b8d25773decf0dec7d", "33da5b6409692887bb6d932bd8e3311b4c5a76d71d78e9f0774f6b497b76a926"],
  "apply_review-1-p1-s2-round1.json high": ["262f70d0b334a152ce3445de63cba3b7a1c19e47393b7bdae82a55534bb1f0ea", "f215a8c539330d9550387a56e2daeb167a6c8f2a9cd552f39272a0b4c214ff8f"],
  "extract-1-p1-s1-round1.json high": ["289f2fb59d784d83d1e154a754e5a8a596a502089ae0adb1d97b2489e72fcbf6", "4bc6050764a8cc14685777d41eb53f55f57cc141f2cb89e77de74e2dbe3a18f7"],
  "extract-1-p1-s2-round1.json high": ["a15919660cabb46a6bbc0014f5d1b9dfb9db92fefc7829f14de3f81b3ccb5484", "aab35bd9ab782380c2d23d48dfe2749425d2f2592f3c8328f1520b2a4a37db34"],
  "extract-1-p1-s3-round1.json high": ["c34ef0e35cfafb8ec59963d8b68c70886d8cc21c232a8519b6025525265e5ce5", "06f9d99cb826af4b22a9fcb40f20b273d51794cca355cd30f96c5200532cc0bc"],
  "extract-1-p1-s4-round1.json high": ["e7f6c12a5a45989508e6d8ff032fadaf11da1439ed667ce20b29aa37e4bac0d1", "e076e5b8bbacc1950f863c80b3779c433e814774113c3eeed9df5ec6d11f1fc2"],
  "extract-1-p1-s5-round1.json high": ["9777590671521b2bd7e0b5fd7b9a5d518d43172d2eb8ed85d7fbd8ab71b6e073", "546c9502a37b82d609fea18b9e88c16502857bc7ecac4fea21ecf82118e29338"],
  "extract-1-p1-s6-round1.json high": ["372dc54b622eb2d026be650dfbf63cd85fe5be0576e7e58c0dcc00e209ee354b", "3f77d7e70d71aabc6f713ac10f91115856dc3c0e30d967c00d014b796b0fccbc"],
  "layout-1-p1-round1.json high": ["4fe25eb0e71c9380920230d8a7c5e85a415236ef1fb6ac7f4df2ae8914da0170", "1efa73d7db79aee350f640673d108c655fc971b8ed7e67531b7413008625fe14"],
  "layout-1-p1-round2.json high": ["895aa451a46b510c988dd3fd6917b8c5f433f27db2b886e727c468ee63adbb5e", "1fdb42381b0ef46e352be94c219ad8231861c84bb45f873c8e2e3eed90a6656b"],
  "review-1-p1-s1-round1.json high": ["1cdab3ca21dc75e611869a724b885f2d0ea7f92c4d8e7022be4c17f577497c46", "50107e8f3abc45012460a68ac0ec059d1912dd9c47d79af5a107231933ba61cb"],
  "review-1-p1-s2-round1.json high": ["a382a0cfcadfbde38cb081914f1a5768dcf3ca65cf5706a20182b21760a09f5e", "4c0d865d28e3940159405c6742812da75c74d207a634ff7bca216394cf49ccd5"],
  "review-1-p1-s3-round1.json high": ["05c709759627d3625ab2ccf593c8531ac3f81eacba67e501399947fb972c712f", "1f5a351d2e5229cdf0a77634e6c3baa111968ba6a22652f42ec19527da516164"],
  "review-1-p1-s4-round1.json high": ["5464ce24a6b70953d284d4bc829ca8ec16cc69ff0e4fd1e3b164f1d33c08f6fe", "420f7e2df60976c52b3a30cddad908db6260fcea8e307124cb711714445e7159"],
  "review-1-p1-s5-round1.json high": ["4b80bcfbedbbc5879f51330e1851fd92322ce5103aee9bf2cdb7aacc3d819faf", "c6887ec284d4cd851552f98a20e029cbecd352eedef5969b774cdc90b366f8c4"],
  "review-1-p1-s6-round1.json high": ["2ae2fe8a53e1bfdef2a8364f99aedd614e4fbe3220bc383a84b179bd85a65916", "f7057ffd032a62de916e2779a7e2e1f114c8c9dff4562099bf8849750637e4f3"],
  "analyze-1-all-round1.json low": ["28a5f355262ddbc8f2f923a4efec5d56e9f571bf9d0da1df8b44206d0273888e", "7b4f7afca6e67daf83bb8a5cc5f95f8981093daee489fad3ae5a366cd969ce72"],
  "analyze-1-p1-round1.json low": ["8c71c72cebeab1e93765801efc0e3b3f10a65c11cad383915bb47d26e7e715c4", "325e9cb00d7d85b8246ae53107f92b4ade4819238dbd42ddafa54d567ccca7cd"],
  "apply_review-1-p1-s1-round1.json low": ["e2344c4bab47d662c017357680c0530f01306c588ed2305e9ba5248d6e19beb5", "33da5b6409692887bb6d932bd8e3311b4c5a76d71d78e9f0774f6b497b76a926"],
  "apply_review-1-p1-s2-round1.json low": ["5bd1bc353c239af87784a9a71241fc01f315c79a6cdce24250b73cecbcfb47a5", "f215a8c539330d9550387a56e2daeb167a6c8f2a9cd552f39272a0b4c214ff8f"],
  "extract-1-p1-s1-round1.json low": ["701bb6c81285f920c859fdbe63b1b958b2c1f4d7ddb7bdafdc4d40f6ffa3c588", "4bc6050764a8cc14685777d41eb53f55f57cc141f2cb89e77de74e2dbe3a18f7"],
  "extract-1-p1-s2-round1.json low": ["135eb36dd9dbdc7bffae4f4c783fe8542ed313da7a430c1352058bac13be37c1", "aab35bd9ab782380c2d23d48dfe2749425d2f2592f3c8328f1520b2a4a37db34"],
  "extract-1-p1-s3-round1.json low": ["696be6a72ce3ffa880806aa1555dc993a4b1f82d7b92913a0a4ac6d0af0ad808", "06f9d99cb826af4b22a9fcb40f20b273d51794cca355cd30f96c5200532cc0bc"],
  "extract-1-p1-s4-round1.json low": ["4e180b8eefb452f85591d659596fd28eda433b46fe10ba6e4e7ea21d2d08b97c", "e076e5b8bbacc1950f863c80b3779c433e814774113c3eeed9df5ec6d11f1fc2"],
  "extract-1-p1-s5-round1.json low": ["37e79cd19cad946e3ef541e30b90eec29e53ce401f30a7a2ded3b565d5cd11c1", "546c9502a37b82d609fea18b9e88c16502857bc7ecac4fea21ecf82118e29338"],
  "extract-1-p1-s6-round1.json low": ["ce91241ca52b0676442a62fc55780fc45068bf6923ccdb8712efb33f08066f7c", "3f77d7e70d71aabc6f713ac10f91115856dc3c0e30d967c00d014b796b0fccbc"],
  "layout-1-p1-round1.json low": ["6d0e3747e37fd05e1dbff892cdeca071e9580a090283bd8645c4ad1215a8ccfd", "1efa73d7db79aee350f640673d108c655fc971b8ed7e67531b7413008625fe14"],
  "layout-1-p1-round2.json low": ["af533f0fbe873b5cc45c87ab9b0db0005d258d91c80afd971b7a8a2f43008e29", "1fdb42381b0ef46e352be94c219ad8231861c84bb45f873c8e2e3eed90a6656b"],
  "review-1-p1-s1-round1.json low": ["11e9ff89a8b329e1cd68eeddf4e8dade3f43765d50e1baf1e49428565b041d75", "50107e8f3abc45012460a68ac0ec059d1912dd9c47d79af5a107231933ba61cb"],
  "review-1-p1-s2-round1.json low": ["5768799592386a42bea4c52511ffc9b6f32c30aba8f3a560831d7478c7284beb", "4c0d865d28e3940159405c6742812da75c74d207a634ff7bca216394cf49ccd5"],
  "review-1-p1-s3-round1.json low": ["b956d74eec92c37d247ff9aada3f994ef27dd778e2d485f919baf3a29bed1f7c", "1f5a351d2e5229cdf0a77634e6c3baa111968ba6a22652f42ec19527da516164"],
  "review-1-p1-s4-round1.json low": ["34fa2bab11311a6a66022445f1aa2a5e73ef21d9a89c2bfcde3b08ca5d004198", "420f7e2df60976c52b3a30cddad908db6260fcea8e307124cb711714445e7159"],
  "review-1-p1-s5-round1.json low": ["456fe3aa2104670b2dd4dd0e7c22101f4f709d042e0cba11b071ad650e876e57", "c6887ec284d4cd851552f98a20e029cbecd352eedef5969b774cdc90b366f8c4"],
  "review-1-p1-s6-round1.json low": ["653fe0c5070b58fe53830155c61d156479878a25c63c01500576b1931c524106", "f7057ffd032a62de916e2779a7e2e1f114c8c9dff4562099bf8849750637e4f3"],
};

test("the fixture's requests have the request keys and recorded hashes they had", async () => {
  const dir = join(import.meta.dirname, "../../../fixtures/replay/fake/requests");
  const got: Record<string, [string, string]> = {};
  for (const effort of ["high", "low"]) {
    const form = new FormData();
    const pdf = new TextEncoder().encode(`a pdf for the snapshots, ${effort}`);
    form.append("pdf", new File([pdf], "score.pdf"));
    form.append("sha256", [...new Uint8Array(await crypto.subtle.digest("SHA-256", pdf))].map((b) => b.toString(16).padStart(2, "0")).join(""));
    const project = (await (await app.request("/api/projects", { method: "POST", body: form }, env)).json()) as { id: string };
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
