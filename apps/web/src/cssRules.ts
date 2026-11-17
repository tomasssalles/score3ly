// The rules of a style sheet, for the tests that guard what the CSS must or mustn't say (stageCardStyles, checkListStyles,
// colors, themes). Small, not a full CSS parser: comments are dropped, the rules inside @media, @supports, @container
// and @layer are read with the at-rules around them, @keyframes and statements (@import …;) are left out. A test
// that looks for a rule also checks that it found it, so a rule renamed or a parser that misses it fails the test
// rather than passing it.

import { readFileSync } from "node:fs";

// selectors: as written, split at the commas and trimmed. body: the declarations. within: the at-rules around it.
export type CssRule = { selectors: string[]; body: string; within: string[] };

const NESTING = /^@(media|supports|container|layer)\b/;

export function parseCss(css: string): CssRule[] {
  return rulesOf(css.replace(/\/\*[\s\S]*?\*\//g, ""), []);
}

export function cssRules(path: string): CssRule[] {
  return parseCss(readFileSync(path, "utf8"));
}

// The rules that have `selector` among their selectors.
export function rulesFor(rules: CssRule[], selector: string): CssRule[] {
  return rules.filter((r) => r.selectors.includes(selector));
}

function rulesOf(text: string, within: string[]): CssRule[] {
  const rules: CssRule[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ";") start = i + 1; // a statement at this level (@import, @charset)
    if (text[i] !== "{") continue;
    const prelude = text.slice(start, i).trim();
    const end = closing(text, i);
    const inner = text.slice(i + 1, end);
    if (NESTING.test(prelude)) rules.push(...rulesOf(inner, [...within, prelude]));
    else if (!prelude.startsWith("@keyframes")) rules.push({ selectors: prelude.split(",").map((s) => s.trim()), body: inner.trim(), within });
    i = end;
    start = end + 1;
  }
  return rules;
}

// The index of the brace that closes the one at `open`.
function closing(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    if (text[i] === "}" && --depth === 0) return i;
  }
  throw new Error(`an unclosed brace at ${open}`);
}
