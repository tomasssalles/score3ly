// Snapshots of what notation computes for the whole score, taken before the code review's batch 27 gave notation its
// whole-score entry points (splitting into pieces, the check chain, one walk over the stretches): the MEI of the rich
// score (whole, and each system alone), what the checks carry and find system by system, the links `review` is given,
// and the checks of the whole score. The same answers must give the same results, byte for byte; only a change meant to
// change them (a bug fix, with its own test) may update them.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { canonicalJson } from "@score3ly/core";
import { checkSystem, pieceStart, type CheckedSystem, type ScoreState } from "./lens.ts";
import { buildScore } from "./score.ts";
import { meiString } from "./mei.ts";
import { systemLinks } from "./links.ts";
import { checkScore } from "./scoreChecks.ts";
import { METADATA, richScore } from "./testScore.ts";

const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const STARTS = [1, 4];
const APP = { name: "score3ly", version: "0.1.0", url: "https://example.org/score3ly" };

function checked(): (CheckedSystem & { number: number })[] {
  let state: ScoreState = pieceStart();
  return richScore().map((s) => {
    if (STARTS.includes(s.number)) state = pieceStart();
    const result = checkSystem(s.answer, { system: s.number, stretches: s.answer.stretches.length, firstOfPiece: STARTS.includes(s.number), images: [] }, state);
    if ("problem" in result) assert.fail(result.problem);
    state = result.state;
    return { ...result, number: s.number };
  });
}

function snapshots(): Record<string, string> {
  const score = buildScore(richScore(), STARTS);
  const systems = checked();
  const out: Record<string, string> = { mei: sha(meiString(score, { metadata: METADATA, application: APP })) };
  for (const n of [1, 2, 3, 4]) out[`mei of system ${n}`] = sha(meiString(score, { systems: [n] }));
  out.checks = sha(canonicalJson(systems.map((c) => ({ number: c.number, codeIssues: c.codeIssues, warnings: c.warnings, state: c.state, closed: c.closed }))));
  out.links = sha(canonicalJson(Object.fromEntries(systemLinks(systems, STARTS))));
  out.scoreChecks = sha(canonicalJson(checkScore(systems, STARTS)));
  return out;
}

const EXPECTED: Record<string, string> = {
  mei: "2aba5b95318ccd5b7bae1da0fd2ac5b1da58037168a3dfd380d4806bd779ea15",
  "mei of system 1": "62528b77add7bc72c82159a607876ccb96d3f70be0ad892f3e3830716aa58c39",
  "mei of system 2": "543c734e29a622dcd9c5817ae266daed73559df7978f1600e3a5d3dbdddb6be2",
  "mei of system 3": "158148b20850e1b50a9aa8b6b1bb7beecc0bcb183a0a950f8a97ada1d6fba70a",
  "mei of system 4": "f15b3e48eabd8b9ed71e00d3f63eb76a06ef528972e029aa568a352161642016",
  checks: "f4e33f64af9ca52296d8983af0abee2176509e4c6d40a3623070bf0e8bc41c70",
  links: "9689d8d8201b692e5fd9f838c8277d41f53cca24d480a527cc36743d2b42dfdc",
  // Changed once on purpose (the code review's batch 29, D12): code issues carry their `kind`; the same without it.
  scoreChecks: "c99e620824d423298a07332ec952666425357b51ffa610410123f1299e2d8126",
};

test("the rich score's MEI, checks and links are as they were", () => {
  assert.deepEqual(snapshots(), EXPECTED);
});
