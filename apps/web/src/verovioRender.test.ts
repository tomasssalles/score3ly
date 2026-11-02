import { test } from "node:test";
import assert from "node:assert/strict";
import createVerovioModule from "verovio/wasm";
import { VerovioToolkit } from "verovio/esm";
import { pageOptions } from "./engrave.ts";
import { SYSTEM_OPTIONS } from "./rendering.ts";
import { renderWith } from "./verovioRender.ts";

const MEI = `<?xml version="1.0" encoding="UTF-8"?>
<mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.1">
  <meiHead><fileDesc><titleStmt><title>A Title</title></titleStmt><pubStmt/></fileDesc></meiHead>
  <music><body><mdiv><score>
    <scoreDef meter.count="4" meter.unit="4"><staffGrp><staffDef n="1" lines="5" clef.shape="G" clef.line="2"/></staffGrp></scoreDef>
    <section><measure n="1"><staff n="1"><layer n="1"><mRest/></layer></staff></measure></section>
  </score></mdiv></body></music>
</mei>`;

// One toolkit serves every rendering in the worker: the Transcription's systems (no title) and the engraving's pages
// (with it), in any order. Found 2026-11-01: after systems had been rendered, the engraving lost its title.
test("an engraving rendered after a system has its title, as when rendered first", async () => {
  const tk = new VerovioToolkit(await createVerovioModule());
  // A seed for Verovio's ids, so that the two engravings can be compared as they are.
  const page = { ...pageOptions({ pageSize: "a4" }), xmlIdSeed: 1 };
  const first = renderWith(tk, MEI, page, true);
  assert.match(first[0], /A Title/);
  assert.doesNotMatch(renderWith(tk, MEI, SYSTEM_OPTIONS, false)[0], /A Title/);
  assert.deepEqual(renderWith(tk, MEI, page, true), first);
});
