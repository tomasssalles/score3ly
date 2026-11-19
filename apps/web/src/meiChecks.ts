// The checks of an MEI file edited by hand, before `fix_mei` applies it (docs/stages/engrave.md): well
// formed and valid against MEI 5.1 (the full schema, given as `validate`: meiSchema.ts), every `xml:id` unique, every
// `#id` reference pointing to an element that exists. And how many lines an edit changed, for the card.

import { count } from "./format.ts";

// line: counted from 1. syntax: the file isn't well formed (nothing after it is checked).
export type MeiProblem = { line: number | null; message: string; syntax?: true };

// An element of the parsed file (meiSchema.ts): the line it starts on and its attributes, by their qualified names
// ("xml:id").
export type MeiElement = { line: number; attrs: { name: string; value: string }[] };

// What the schema's check gives: its problems, and the file's elements (none when the file isn't well formed).
export type Validated = { problems: MeiProblem[]; elements: MeiElement[] };

// The attributes that point to elements: MEI 5's of type data.URI or data.URIs (in mei-all.rng), whose tokens starting
// with "#" name an id in the file. Every other attribute is text, however it starts (a colour, `label="#1"`).
// Left out: the namespace's `name`, a URI that is never a fragment.
const POINTERS = new Set([
  "altsym", "auth.uri", "chordref", "class", "copyof", "corresp", "data", "decls", "def", "endid", "facs", "follows",
  "glyph.uri", "hand", "head.altsym", "inner.recto", "inner.verso", "instr", "join", "new", "next", "nymref", "old",
  "origin.endid", "origin.startid", "outer.recto", "outer.verso", "plist", "precedes", "prev", "recto", "resp",
  "sameas", "scheme", "since", "source", "startid", "state", "stem.sameas", "synch", "target", "verso", "when",
  "xlink:role", "xml:base",
]);

// Duplicate ids and references to ids nothing has, on the elements as libxml2 parsed them (any quoting, any layout); in
// the order found (`checkMei` sorts every problem by line).
export function idProblems(elements: MeiElement[]): MeiProblem[] {
  const ids = new Map<string, number>();
  const problems: MeiProblem[] = [];
  for (const e of elements) {
    for (const a of e.attrs) {
      if (a.name !== "xml:id") continue;
      const first = ids.get(a.value);
      if (first !== undefined) problems.push({ line: e.line, message: `The id "${a.value}" is already used on line ${first}.` });
      else ids.set(a.value, e.line);
    }
  }
  for (const e of elements) {
    for (const a of e.attrs) {
      if (!POINTERS.has(a.name)) continue;
      for (const token of a.value.split(/\s+/)) {
        if (token.startsWith("#") && token.length > 1 && !ids.has(token.slice(1))) {
          problems.push({ line: e.line, message: `@${a.name} points to "${token}", but no element has that id.` });
        }
      }
    }
  }
  return problems;
}

// Every check: the schema's first (a file that isn't well formed has nothing else worth checking), then the ids.
export async function checkMei(text: string, validate: (text: string) => Promise<Validated>): Promise<MeiProblem[]> {
  const { problems, elements } = await validate(text);
  if (problems.some((p) => p.syntax)) return problems;
  return [...problems, ...idProblems(elements)].sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
}

// The lines that differ between two texts, a changed line counting once: the larger of the lines removed and the lines
// added, by the shortest edit script (Myers), after the lines both share at the start and the end.
export function linesChanged(before: string, after: string): number {
  let a = before.split("\n");
  let b = after.split("\n");
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let end = 0;
  while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end++;
  a = a.slice(start, a.length - end);
  b = b.slice(start, b.length - end);
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return Math.max(n, m);
  // Myers: the fewest lines removed and added (d) that turn a into b; then the lines both keep are (n + m - d) / 2.
  const max = n + m;
  const v = new Int32Array(2 * max + 2);
  for (let d = 0; d <= max; d++) {
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[max + k - 1] < v[max + k + 1]) ? v[max + k + 1] : v[max + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[max + k] = x;
      if (x >= n && y >= m) {
        const kept = (n + m - d) / 2;
        return Math.max(n - kept, m - kept);
      }
    }
  }
  return Math.max(n, m);
}

// The card's result: "14 lines changed", "1 line changed" or "no changes".
export function changesNote(lines: number): string {
  return lines === 0 ? "no changes" : `${count(lines, "line")} changed`;
}
