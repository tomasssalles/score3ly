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
// nothing else in them changed.
const REQUESTS: [string, string][] = [
  ["analyze-1-all-round1.json", "cbd730f2f25c7d04f198773e9e449c40c0513f41143c4818b27fffa8d97e09d7"],
  ["analyze-1-p1-round1.json", "8157a37e44b0301076a07373386fafdaf25f914471af9cf1ad5e93557fd42738"],
  ["apply_review-1-p1-s1-round1.json", "182f66990045c35a19e5277256f171d1ada93defaadc0f0f4ab1b1bf6e8834c8"],
  ["apply_review-1-p1-s2-round1.json", "471ccb7dc4b499e57602b4263dc74bfa131f179519903e93a8c7995f01dd20f2"],
  ["extract-1-p1-s1-round1.json", "751db1cdec496f47769bb02d888f0a8b1dbbe454e57947ecae51d3d4e61f66fc"],
  ["extract-1-p1-s2-round1.json", "85a343d02016a1bef6f72dd2f5b616382f55d5255ef21f55f1a13dd5379ca5ab"],
  ["extract-1-p1-s3-round1.json", "cec8cd8b5fae187d4336d318d1831f034b1be7a23d97b232bc822e727245fee5"],
  ["extract-1-p1-s4-round1.json", "1b7965ce455e732f76ae2a350f1be88fa8947016c9c0af3bf5d4f178d554538c"],
  ["extract-1-p1-s5-round1.json", "409c280fa9ebccaa7fd647966f75c40b35391ecc81f1e3e1ad3d88876bab4c6b"],
  ["extract-1-p1-s6-round1.json", "7c5a5537e1b1de0e38d09ceb5cefa77ab10370ed94a1df516ac9713cb886c135"],
  ["layout-1-p1-round1.json", "39f1834db0a3e49842dd0dce7a6b1665a0e3aa0bc3498ad5b54f7a6627b2731d"],
  ["layout-1-p1-round2.json", "3c872093f2ef26d315eae75079754acf97037d0144835f1d95dedf51c2d05c2a"],
  ["review-1-p1-s1-round1.json", "c99f1666892a04c17c872f4cb84bce19ebe7f3933860d9c79d5c2bf4d8d94e32"],
  ["review-1-p1-s2-round1.json", "8e0d1b98335d079f5a5adf986a2f8d9f440f010d2f9937ae9c38f11fcb91cde4"],
  ["review-1-p1-s3-round1.json", "20fce28dd109aacecfed0dbc8f658b30405944344dc3d952032e6c2cf444b83c"],
  ["review-1-p1-s4-round1.json", "a63931f5232fc2336703aa5721759c274e55814ac89c72bb54fbacd7301b13fa"],
  ["review-1-p1-s5-round1.json", "c37b434128a9b54d27f0a429385948fb7f2af1ba167b52b8987609c4f9b57b10"],
  ["review-1-p1-s6-round1.json", "5b5176eec80603a2053da121d0cad9ed6d0e03a920f21ed7e5d13454178faf66"],
];

test("the replay fixture's requests have the keys they had", async () => {
  const dir = join(import.meta.dirname, "../../../fixtures/replay/fake/requests");
  assert.deepEqual(readdirSync(dir).sort(), REQUESTS.map(([file]) => file));
  for (const [file, key] of REQUESTS) assert.equal(await keyOf(JSON.parse(readFileSync(join(dir, file), "utf8"))), key, file);
});
