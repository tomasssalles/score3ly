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
const REQUESTS: [string, string][] = [
  ["analyze-1-all-round1.json", "63993f29e2310f873e553cb13dc96b200ff14b260daadfbe7f421a2c6030a2ad"],
  ["analyze-1-p1-round1.json", "07e509c4fb8ba26d899340b4e607d03c1b4c3184e667ab7003dcfce461e0953e"],
  ["apply_review-1-p1-s1-round1.json", "399efcddc2e0a1cd98b96e3787b01271113b7474d2f970e50dd30ad0c4cdbb32"],
  ["apply_review-1-p1-s2-round1.json", "fe4727971f10613358292696a70babfca13436164651e91a32e72257c28c800c"],
  ["extract-1-p1-s1-round1.json", "99f603e95d06c1c16bdb7a854f9ef89702cb798e103e2dd855d6c7601c303c62"],
  ["extract-1-p1-s2-round1.json", "965b37efa7029c78184cb491da91efb343ec584794c2beb7772426e06207d867"],
  ["extract-1-p1-s3-round1.json", "ddf6f81dbed89e4c10a8f29503ed86faeda791a6b1db65bd7af31068a0fbe009"],
  ["extract-1-p1-s4-round1.json", "b3e9e62f19ee5659e7761aaf018bc0a31568a6e9c121f6ef510bf43604aa41de"],
  ["extract-1-p1-s5-round1.json", "298f1e043d564a60fe28524a6e1db08089e942f27b762769dba0cad81160bf34"],
  ["extract-1-p1-s6-round1.json", "6624b5f05589042de65a1579d6c3b11120587c492bf0470b197e375866b71f52"],
  ["layout-1-p1-round1.json", "6bc78e9a988c6f1f0e6347261c47fdc7639e8ef300606c1177b3cca02f0208f8"],
  ["layout-1-p1-round2.json", "42b3a9fdfd39cb096480725e77f6a61ebdd232f42a774244b976ab6c4d430736"],
  ["review-1-p1-s1-round1.json", "3aa00656347294176f9c95baa14dca6f4275d62fba5d4b6f5aff31c8b4a2fbf2"],
  ["review-1-p1-s2-round1.json", "b9de76837c965d88737720571a2e2491115cd00746c11470afb0f6b3f34f020a"],
  ["review-1-p1-s3-round1.json", "9abb2257334e4d323a82755bedd1ca5156484941862421dbcdb5b64fc1bed458"],
  ["review-1-p1-s4-round1.json", "2bf83964611f068bb01c5ead4bc201af925c8dbdd5341ae032cfe7aefd2d67fd"],
  ["review-1-p1-s5-round1.json", "eb7454f4ab2f38430e44aab3f11f0beefb73051903695ca67f871672792aa078"],
  ["review-1-p1-s6-round1.json", "1ecf45d178bad7f1b760d7740cea1c9dc192c6040d59253f7cd1dc45b89a6fcc"],
];

test("the replay fixture's requests have the keys they had", async () => {
  const dir = join(import.meta.dirname, "../../../fixtures/replay/fake/requests");
  assert.deepEqual(readdirSync(dir).sort(), REQUESTS.map(([file]) => file));
  for (const [file, key] of REQUESTS) assert.equal(await keyOf(JSON.parse(readFileSync(join(dir, file), "utf8"))), key, file);
});
