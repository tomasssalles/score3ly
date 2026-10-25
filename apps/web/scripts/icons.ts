// Makes the PNG app icons from public/icon.svg (concerto, for phones' home screens) and public/icon-cadenza.svg (the
// desktop app's window and dock). Run `npm run icons` after changing an icon: it writes the missing PNGs; existing ones
// are only replaced with `npm run icons -- --force`.

import { existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

// 180: iPhone and iPad home screen. 192 and 512: Android, listed in public/manifest.webmanifest.
const SIZES = [180, 192, 512];
const SVG_SIZE = 64; // the icon's viewBox

const publicDir = join(import.meta.dirname, "../public");
const targets = ["icon", "icon-cadenza"].flatMap((name) =>
  SIZES.map((size) => ({ size, svg: join(publicDir, `${name}.svg`), file: join(publicDir, `${name}-${size}.png`) })),
);
const force = process.argv.includes("--force");

for (const { size, svg, file } of targets) {
  if (existsSync(file) && !force) {
    console.log(`kept ${file} (exists; --force replaces it)`);
    continue;
  }
  // The density makes the SVG be drawn at the target size right away, not drawn small and enlarged.
  await sharp(svg, { density: (72 * size) / SVG_SIZE })
    .resize(size, size)
    .png()
    .toFile(file);
  console.log(`wrote ${file}`);
}
