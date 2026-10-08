// Makes the PNG app icons from public/icon.svg, for phones' home screens.
// Run `npm run icons` after changing the icon. Existing PNGs are only replaced with `npm run icons -- --force`.

import { existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

// 180: iPhone and iPad home screen. 192 and 512: Android, listed in public/manifest.webmanifest.
const SIZES = [180, 192, 512];
const SVG_SIZE = 64; // the icon's viewBox

const publicDir = join(import.meta.dirname, "../public");
const targets = SIZES.map((size) => ({ size, file: join(publicDir, `icon-${size}.png`) }));

const existing = targets.filter((target) => existsSync(target.file));
if (existing.length > 0 && !process.argv.includes("--force")) {
  console.error("These icons exist already. Nothing was written. To replace them: npm run icons -- --force");
  for (const target of existing) console.error(`  ${target.file}`);
  process.exit(1);
}

for (const { size, file } of targets) {
  // The density makes the SVG be drawn at the target size right away, not drawn small and enlarged.
  await sharp(join(publicDir, "icon.svg"), { density: (72 * size) / SVG_SIZE })
    .resize(size, size)
    .png()
    .toFile(file);
  console.log(`wrote ${file}`);
}
