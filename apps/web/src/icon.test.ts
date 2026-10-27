import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The icon is the same in every theme (docs/style.md): its brackets' coral is halfway between the dark and the light
// theme's accents, so that it stands for both. It is a separate image, so it can't use the app's CSS variables.
// Both editions' icons (docs/desktop.md, "Editions"): they differ in the tile and the note, not the brackets.
for (const file of ["icon.svg", "icon-cadenza.svg"]) test(`${file}: the coral is halfway between the themes' accents`, () => {
  const icon = readFileSync(join(import.meta.dirname, "../public", file), "utf8");
  const themes = readFileSync(join(import.meta.dirname, "themes.css"), "utf8");

  const inIcon = /\.accent\s*\{\s*stroke:\s*(#[0-9a-f]{6})\s*;/i.exec(icon)?.[1];
  const accents = [...themes.matchAll(/:root\[data-theme="(dark|light)"\]\s*\{[^}]*?--accent:\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => m[2]);

  assert.ok(inIcon, `${file} has no .accent { stroke: #rrggbb; } rule`);
  assert.equal(accents.length, 2, "themes.css has no --accent: #rrggbb; in the dark and the light theme");
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [a, b] = accents.map(rgb);
  const halfway = a.map((v, i) => Math.floor((v + b[i]) / 2));
  assert.deepEqual(rgb(inIcon), halfway);
});
