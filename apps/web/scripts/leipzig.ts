// Verovio's music font (Leipzig), as Verovio embeds it in its SVG (WOFF2): the source of src/metronomeFont.ts, for
// scripts/metronomeFont.ts and the test that says when it must run again.

import { createHash } from "node:crypto";
import createVerovioModule from "verovio/wasm";
import { VerovioToolkit } from "verovio/esm";

const MEI = `<?xml version="1.0"?><mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.1"><meiHead><fileDesc><titleStmt><title/></titleStmt><pubStmt/></fileDesc></meiHead><music><body><mdiv><score><scoreDef><staffGrp><staffDef n="1" lines="5" clef.shape="G" clef.line="2"/></staffGrp></scoreDef><section><measure><staff n="1"><layer n="1"><note dur="1" pname="c" oct="5"/></layer></staff><tempo tstamp="1" staff="1"><rend glyph.auth="smufl"></rend></tempo></measure></section></score></mdiv></body></music></mei>`;

export async function leipzigWoff2(): Promise<Buffer> {
  const toolkit = new VerovioToolkit(await createVerovioModule());
  toolkit.loadData(MEI);
  const woff2 = /font-family: 'Leipzig';\s*src: url\(data:application\/font-woff2;charset=utf-8;base64,([A-Za-z0-9+/=]+)\)/.exec(toolkit.renderToSVG(1));
  if (!woff2) throw new Error("Verovio's SVG has no embedded Leipzig font");
  return Buffer.from(woff2[1], "base64");
}

export function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
