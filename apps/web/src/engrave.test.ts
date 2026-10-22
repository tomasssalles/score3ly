import { test } from "node:test";
import assert from "node:assert/strict";
import type { ApiStage } from "./api.ts";
import { engraveInput, meiNote } from "./engrave.ts";

const stage = (step: string, status: ApiStage["status"], outputs: { id: string; type: string; sha: string }[] = []): ApiStage =>
  ({
    id: step,
    step,
    status,
    outputs: outputs.map((o) => ({ id: o.id, item: "", type: o.type, contentSha256: o.sha, recipeKey: null, recipe: null })),
  }) as ApiStage;

test("engrave takes the MEI of final touches right before it, once they are finished", () => {
  const touches = stage("final_touches", "done", [
    { id: "b", type: "mei_base", sha: "1".repeat(64) },
    { id: "m", type: "mei", sha: "2".repeat(64) },
  ]);
  assert.deepEqual(engraveInput([stage("extract", "done"), touches]), { edited: { id: "m", sha256: "2".repeat(64) } });
  assert.deepEqual(engraveInput([stage("extract", "done"), { ...touches, status: "wip" }]), { missing: "the final touches aren't finished yet." });
  assert.ok("missing" in engraveInput([stage("extract", "failed")]));
});

test("an edited MEI's result: its pieces and measures, a multi-measure rest counting each", () => {
  const mei = [
    '<mdiv xml:id="piece-1" n="1">',
    '  <measure xml:id="p1m1" n="1">',
    '  <measure xml:id="p1m2-s1t2" n="2">',
    '  <measure xml:id="p1m2-s1t3" n="2">',
    '  <measure xml:id="p1m3" n="3–5">',
    '<mdiv xml:id="piece-2" n="2">',
    '  <measure xml:id="p2m1" n="1">',
  ].join("\n");
  assert.equal(meiNote(mei), "2 pieces · 6 measures");
  assert.equal(meiNote('<mdiv n="1">\n<measure n="1">'), "1 measure");
});
