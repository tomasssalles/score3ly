// The builder's file through its readers (level 2 group 21 #9): the rich score's MEI, with metadata, passes the
// checks `fix_mei` applies, and the MEI view finds in it every piece, every measure and every id.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildScore, meiString, pieceTitle } from "@score3ly/notation";
import { METADATA, richScore } from "@score3ly/notation/testScore";
import { checkMei } from "./meiChecks.ts";
import { meiValidator } from "./meiSchema.ts";
import { findMeasure, indexMei } from "./meiView.ts";

const validator = meiValidator(readFileSync(new URL("../../../packages/notation/schemas/mei-all.rng", import.meta.url), "utf8"));
const APP = { name: "score3ly", version: "0.1.0", url: "https://github.com/tomasssalles/score3ly" };

test("the rich score's MEI passes fix_mei's checks, and Go to finds every piece and measure in it", async () => {
  const score = buildScore(richScore(), [1, 4]);
  const text = meiString(score, { metadata: METADATA, application: APP });
  assert.deepEqual(await checkMei(text, async (t) => validator(t)), []);
  const lines = text.split("\n");
  const index = indexMei(lines);
  assert.deepEqual(
    index.pieces.map((p) => [p.n, p.label]),
    score.pieces.map((p) => [p.index + 1, pieceTitle(METADATA, p.systems[0].number) ?? null]),
  );
  for (const piece of score.pieces) {
    for (const m of piece.measures) {
      for (let n = m.n; n < m.n + m.count; n++) {
        const line = findMeasure(index, piece.index + 1, n);
        assert.notEqual(line, null, `piece ${piece.index + 1}, measure ${n}`);
        assert.match(lines[line!], /<measure /);
      }
    }
  }
  // Every id the file gives, at its line.
  const ids = lines.flatMap((l, i) => [...l.matchAll(/xml:id="([^"]+)"/g)].map((m) => [m[1], i] as const));
  assert.ok(ids.length > 100);
  for (const [id, line] of ids) assert.equal(index.ids.get(id), line, id);
});
