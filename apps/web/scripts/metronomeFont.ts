// Makes src/metronomeFont.ts: the metronome glyphs of Verovio's music font (Leipzig, SIL Open Font License 1.1), as a
// small TrueType font, for the PDFs made from Verovio's SVG (DESIGN.md §6, "Tempo marks"). Verovio draws a tempo
// mark's note in that font, which it embeds in the SVG as WOFF2; the PDF libraries can't read it from there.
// Run `npm run metronome-font` when the test in src/metronomeFont.test.ts says so (Verovio's font changed, e.g. after
// updating Verovio). Needs Python's fontTools: `pip install fonttools brotli`.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { leipzigWoff2, sha256Hex } from "./leipzig.ts";

const woff2 = await leipzigWoff2();
const dir = mkdtempSync(join(tmpdir(), "metronome-font-"));
writeFileSync(join(dir, "leipzig.woff2"), woff2);
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

// The SHA-256 of the font it was made from (Verovio's WOFF2): a test checks it against the installed Verovio's.
export const METRONOME_FONT_SOURCE = "${sha256Hex(woff2)}";
`,
);
console.log(`src/metronomeFont.ts: ${ttf.length} characters`);
