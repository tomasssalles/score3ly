import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Every colour of the app is a token of the themes (themes.css, DESIGN.md §5.7), so that a new theme covers everything.
// Out of reach of this test: the app icon (public/icon.svg, with its own test), the manifest (public/), and the layout's
// box colours, which are drawn on the pages for the models too (packages/imaging, LAYOUT_COLORS).

const SRC = import.meta.dirname;
const LITERAL = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{1,5})?\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/;
const NAMED = ["white", "black", "red", "green", "blue", "gray", "grey", "yellow", "orange", "purple", "pink", "brown", "silver", "maroon", "navy", "teal", "olive", "lime", "aqua", "fuchsia", "cyan", "magenta", "gold"];
const COLOR_PROPERTY = "color|background|background-color|border|border-color|border-top|border-bottom|border-left|border-right|outline|fill|stroke|box-shadow|text-shadow|caret-color|accent-color";

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));
}

const sources = files(SRC).filter((f) => /\.(css|ts|tsx)$/.test(f) && !f.endsWith(".test.ts") && !f.endsWith("themes.css") && !f.endsWith("metronomeFont.ts"));

// Named colours: in a CSS declaration of a colour property, or a JSX or style attribute for one (tokens' names, as
// in var(--green), don't count).
const NAMED_COLOR = new RegExp(`(?:^|[\\s{;"'])(?:${COLOR_PROPERTY}|backgroundColor|borderColor)\\s*[:=]\\s*["'{]?[^;"'}]*\\b(?:${NAMED.join("|")})\\b`, "i");

function hasColour(line: string): boolean {
  const withoutTokens = line.replace(/var\(--[\w-]+\)/g, "var()");
  return LITERAL.test(withoutTokens) || NAMED_COLOR.test(withoutTokens);
}

test("what counts as a colour", () => {
  for (const line of ["color: #000;", "  background: #1a1b1e;", "fill: rgba(0, 0, 0, 0.5);", 'stroke="white"', "color: red;", 'background: "#fff"', "border: 1px solid hsl(0 0% 50%);"]) {
    assert.ok(hasColour(line), line);
  }
  for (const line of ["color: var(--green);", "fill: currentColor;", "background: transparent;", 'window.location.replace("#/");', "white-space: nowrap;", "// the green progress bar"]) {
    assert.ok(!hasColour(line), line);
  }
});

test("no colour is written anywhere but in the themes", () => {
  const found: string[] = [];
  for (const file of sources) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => hasColour(line) && found.push(`${file.slice(SRC.length + 1)}:${i + 1}: ${line.trim()}`));
  }
  assert.deepEqual(found, [], "colours outside themes.css: use a token (var(--…)), adding it to every theme");
});

test("themes.css holds only themes: blocks for :root of tokens", () => {
  const css = readFileSync(join(SRC, "themes.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    for (const selector of selectors.split(",")) assert.match(selector.trim(), /^:root(\[data-theme="[\w-]+"\])?$/);
    for (const declaration of body.split(";").map((d) => d.trim()).filter(Boolean)) {
      assert.match(declaration, /^(--[\w-]+|color-scheme)\s*:/, `not a token: ${declaration}`);
    }
  }
});
