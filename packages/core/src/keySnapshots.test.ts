// Snapshots of canonical JSON and keys (docs/overview.md §5.2), taken before the code review's batch 7 moved and
// fixed the key code: every key of valid JSON must stay byte-identical, or every stage and request key changes (and
// every LLM call is paid again). Only a change that means to change keys (the paid release) may update them.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalJson, keyOf } from "./keys.ts";

const VALUES: unknown[] = [
  null, true, false, 0, -0, 1, -1.5, 0.1 + 0.2, 1e21, 1e-7, 123456789012345680000, Number.MAX_SAFE_INTEGER, NaN, Infinity,
  "", "plain", "quote \" backslash \\ slash / tab \t newline \n nul \u0000 \u001f", "é ü 中 🎵 \u2028\u2029", "\ud800",
  [], {}, [[], {}], { "": 1, a: { "": [] } },
  { b: 1, a: 2, B: 3, A: 4, "10": 5, "9": 6, é: 7, e: 8, "a b": 9, _: 10, "-": 11 },
  { nested: [{ z: [3, 2, 1], y: { x: null } }, "s", 4.25, false], skipped: undefined },
  { date: "2026-11-17T00:00:00.000Z", text: "Allegro con brio", numbers: [0.333333, 0.5, 1 / 3] },
];

// Each value's canonical JSON and key, in the same order.
const EXPECTED: [string, string][] = [
  ["null", "74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b"],
  ["true", "b5bea41b6c623f7c09f1bf24dcae58ebab3c0cdd90ad966bc43a45b44867e12b"],
  ["false", "fcbcf165908dd18a9e49f7ff27810176db8e9f63b4352213741664245224f8aa"],
  ["0", "5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b46729d73a27fb57e9"],
  ["0", "5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b46729d73a27fb57e9"],
  ["1", "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b"],
  ["-1.5", "37c2b212b94e5372b33df924ea2a91182d90c237d0bf942c1768e794ebef2376"],
  ["0.30000000000000004", "06bad31060c1212ae832de4c031f7b31e3b48aed57858294478cb19450cf34ca"],
  ["1e+21", "241c4643fa70b1dcde1205b71be4e3bebb17e9f880c8e1a33d0ead6c27271d3c"],
  ["1e-7", "5b33e02f2c5103a05d32f6ba9cb058294452bfbf393967f68bb30c1bdcbbab22"],
  ["123456789012345680000", "725abf175290195635e55a971cf88e02a46d6d56e964ec2d8bc47614b9559062"],
  ["9007199254740991", "f40b423c2dd95ff2b2f027e22208f438cf7242862e5e746860e697308c9add26"],
  ["null", "74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b"],
  ["null", "74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b"],
  ["\"\"", "12ae32cb1ec02d01eda3581b127c1fee3b0dc53572ed6baf239721a03d82e126"],
  ["\"plain\"", "945603a8f587786b463c3f94fce115c0fae88fac2728cc96ddf5981cf7f61741"],
  ["\"quote \\\" backslash \\\\ slash / tab \\t newline \\n nul \\u0000 \\u001f\"", "22a47b5aa8f03bb6c608ab64c20a6a21c14657ed6f6abfe05407ed6f4f33b014"],
  ["\"é ü 中 🎵   \"", "8ebf14df1994e29953bc2e95358fdfd88b2012c8f62ad1290cd83b900d316a46"],
  ["\"\\ud800\"", "8c0c59dd0d275aadcd462a5fe12eb352cbdfeaf961eae4f85a4660521df7d2f5"],
  ["[]", "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"],
  ["{}", "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a"],
  ["[[],{}]", "5eed25f9aa1c68139fe47d7ea93769c16d4ddd46c01693921e0b40d9aaa39beb"],
  ["{\"\":1,\"a\":{\"\":[]}}", "31b58c7468d6de799597fcc09a291e4300cb1a21fdce48287753303c3b7515b7"],
  ["{\"-\":11,\"10\":5,\"9\":6,\"A\":4,\"B\":3,\"_\":10,\"a\":2,\"a b\":9,\"b\":1,\"e\":8,\"é\":7}", "1992f39666b7bf5013c7e52194598ef95c5d6d545d7f34bc476b3b8cb80a1386"],
  ["{\"nested\":[{\"y\":{\"x\":null},\"z\":[3,2,1]},\"s\",4.25,false]}", "fc2decd52aa1dc3e43005d939e848029a653fb0dd0c9e31173538e98dcfbf42b"],
  ["{\"date\":\"2026-11-17T00:00:00.000Z\",\"numbers\":[0.333333,0.5,0.3333333333333333],\"text\":\"Allegro con brio\"}", "4f81507da779d14c8bb7141d3cc8cf410234048956b5d9232c506fd3f091af0c"],
];

test("canonical JSON and keys of valid JSON of every kind are as they were", async () => {
  assert.equal(VALUES.length, EXPECTED.length);
  for (const [i, value] of VALUES.entries()) {
    assert.equal(canonicalJson(value), EXPECTED[i][0], `value ${i}`);
    assert.equal(await keyOf(value), EXPECTED[i][1], `value ${i}`);
  }
});

// The replay fixture's requests (fixtures/replay/fake/requests: built by the app's prompts, schemas and stages), keyed.
// Changed once on purpose by the paid release (batch 33): the requests name their images by new recipe keys, and
// nothing else in them changed. Changed once more by batch 34 (the prompts): the 16 requests of analyze, extract, review
// and apply_review (their texts, schemas and issues, each diff read); layout's two unchanged.
const REQUESTS: [string, string][] = [
  ["analyze-1-all-round1.json", "cd83d8ee9d5f95453b16a6675e5034e2fb4946451eae8665798ff37e0af4b5ea"],
  ["analyze-1-p1-round1.json", "05d5cf693a14843cf7f9ea115c9fecc5713e18440ad1e26fc7c2403f58367d96"],
  ["apply_review-1-p1-s1-round1.json", "35d430cc3fe11994cdd4c05e3da71427749c3a07c270ce05e240cecb4d9b637e"],
  ["apply_review-1-p1-s2-round1.json", "747c850bfc25c940b7a1d5444cb0efbf9eee0540ae694b48375f67aa0b66e76b"],
  ["extract-1-p1-s1-round1.json", "eef83fa77e45c0796ebcafa0d74fb28ad0d34c87303bee92c4d5284d57f4438e"],
  ["extract-1-p1-s2-round1.json", "8e025df3f609047b8608a9944b6800630a6bfab3ee2a76ac0e07acc299a84382"],
  ["extract-1-p1-s3-round1.json", "d3633a02131a5028d2ece02cae52433c3dbedca48b06a509bec5246baa9283c9"],
  ["extract-1-p1-s4-round1.json", "a281a9cd39208d2207c6df2972dc162e58d141705a5daefb684a6f93fd0a83df"],
  ["extract-1-p1-s5-round1.json", "b9264c491e906496730b7d836342a79ecb9dcace6619266ac7ed5470b93a7791"],
  ["extract-1-p1-s6-round1.json", "3803be8b741c8038eddb712555cf52955882370c8fc72a75accf9b2563fc4e10"],
  ["layout-1-p1-round1.json", "39f1834db0a3e49842dd0dce7a6b1665a0e3aa0bc3498ad5b54f7a6627b2731d"],
  ["layout-1-p1-round2.json", "3c872093f2ef26d315eae75079754acf97037d0144835f1d95dedf51c2d05c2a"],
  ["review-1-p1-s1-round1.json", "58d844f69f16bf94add697c15d4dc327c97efbcc0d13740b4a44a52493ddaa9b"],
  ["review-1-p1-s2-round1.json", "ee7d5749a90bcb5c517e5e311ea0a672af34183a5d4f4274886ca61b557af25d"],
  ["review-1-p1-s3-round1.json", "443c3cacedbf80ac672003f42b1916dbc1cf7e5456c7971d96598563e0d33c46"],
  ["review-1-p1-s4-round1.json", "a69a5a3994935980a377716cc423570b12d7bcb43b8c4297f5f839562026609f"],
  ["review-1-p1-s5-round1.json", "ced4444f8487cb551bf3e8485928bf5ed27e358a16d8959ea53a3c85a8b936da"],
  ["review-1-p1-s6-round1.json", "bf45ebc2fa6dd29282fc990037de4fc0ad83f4240312d0cf92fa7433f0fe9e94"],
];

test("the replay fixture's requests have the keys they had", async () => {
  const dir = join(import.meta.dirname, "../../../fixtures/replay/fake/requests");
  assert.deepEqual(readdirSync(dir).sort(), REQUESTS.map(([file]) => file));
  for (const [file, key] of REQUESTS) assert.equal(await keyOf(JSON.parse(readFileSync(join(dir, file), "utf8"))), key, file);
});
