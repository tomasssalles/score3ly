import { test } from "node:test";
import assert from "node:assert/strict";
import { leipzigWoff2, sha256Hex } from "../scripts/leipzig.ts";
import { METRONOME_FONT_SOURCE } from "./metronomeFont.ts";

test("the metronome font was made from the installed Verovio's music font", async () => {
  const installed = sha256Hex(await leipzigWoff2());
  assert.equal(METRONOME_FONT_SOURCE, installed, "Verovio's music font changed: run `npm run metronome-font -w apps/web`");
});
