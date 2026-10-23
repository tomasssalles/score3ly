// Makes src/metronomeFont.ts: the metronome glyphs of Verovio's music font (Leipzig, SIL Open Font License 1.1), as a
// small TrueType font, for the PDFs made from Verovio's SVG (DESIGN.md §6, "Tempo marks"). Verovio draws a tempo
// mark's note in that font, which it embeds in the SVG as WOFF2; the PDF libraries can't read it from there.
// Run `npm run metronome-font` after updating Verovio. Needs Python's fontTools: `pip install fonttools brotli`.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import createVerovioModule from "verovio/wasm";
import { VerovioToolkit } from "verovio/esm";

const MEI = `<?xml version="1.0"?><mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.1"><meiHead><fileDesc><titleStmt><title/></titleStmt><pubStmt/></fileDesc></meiHead><music><body><mdiv><score><scoreDef><staffGrp><staffDef n="1" lines="5" clef.shape="G" clef.line="2"/></staffGrp></scoreDef><section><measure><staff n="1"><layer n="1"><note dur="1" pname="c" oct="5"/></layer></staff><tempo tstamp="1" staff="1"><rend glyph.auth="smufl"></rend></tempo></measure></section></score></mdiv></body></music></mei>`;

const toolkit = new VerovioToolkit(await createVerovioModule());
toolkit.loadData(MEI);
const woff2 = /font-family: 'Leipzig';\s*src: url\(data:application\/font-woff2;charset=utf-8;base64,([A-Za-z0-9+/=]+)\)/.exec(toolkit.renderToSVG(1));
if (!woff2) throw new Error("Verovio's SVG has no embedded Leipzig font");

const dir = mkdtempSync(join(tmpdir(), "metronome-font-"));
writeFileSync(join(dir, "leipzig.woff2"), Buffer.from(woff2[1], "base64"));
// The metronome notes and the augmentation dot (SMuFL's "Metronome marks" range).
execFileSync("python3", [
  "-m",
  "fontTools.subset",
  join(dir, "leipzig.woff2"),
  "--unicodes=U+E1D0-E1E7",
  "--layout-features=",
  "--no-hinting",
  "--flavor=",
  `--output-file=${join(dir, "metronome.ttf")}`,
]);
const ttf = readFileSync(join(dir, "metronome.ttf")).toString("base64");
writeFileSync(
  join(import.meta.dirname, "../src/metronomeFont.ts"),
  `// Made by scripts/metronomeFont.ts: the metronome glyphs (U+E1D0–U+E1E7) of Leipzig, Verovio's music font, as
// TrueType, base64. Leipzig is released under the SIL Open Font License 1.1.
export const METRONOME_FONT = "${ttf}";
`,
);
console.log(`src/metronomeFont.ts: ${ttf.length} characters`);
