// The MEI file as `engrave`'s artifact shows it (DESIGN.md §6, `engrave`): what doesn't need React. Each line's syntax
// highlighting, the places to go to (pieces and measures, from the file's own `mdiv` and `measure @n`), the elements
// and their ids (to go between a line and the engraving), and searching. The file is the builder's, one element per
// line, so lines are enough.

export type TokenKind = "tag" | "attr" | "value" | "text" | "punct";
export type Token = { kind: TokenKind; text: string };

// A line's tokens: tags and their names, attributes, values, the text between tags, and punctuation.
export function highlight(line: string): Token[] {
  const tokens: Token[] = [];
  const push = (kind: TokenKind, text: string) => {
    const last = tokens[tokens.length - 1];
    if (last && last.kind === kind) last.text += text;
    else tokens.push({ kind, text });
  };
  let i = 0;
  let inTag = false;
  while (i < line.length) {
    const rest = line.slice(i);
    let m: RegExpExecArray | null;
    if (!inTag) {
      if ((m = /^(<\?|<\/?)([\w:.-]*)/.exec(rest))) {
        push("punct", m[1]);
        if (m[2]) push("tag", m[2]);
        inTag = true;
      } else {
        m = /^[^<]+/.exec(rest)!;
        push("text", m[0]);
      }
    } else if ((m = /^\s+/.exec(rest))) {
      push("text", m[0]);
    } else if ((m = /^[\w:.-]+(?==)/.exec(rest))) {
      push("attr", m[0]);
    } else if ((m = /^"[^"]*"?/.exec(rest))) {
      push("value", m[0]);
    } else if ((m = /^(\/>|\?>|>)/.exec(rest))) {
      push("punct", m[0]);
      inTag = false;
    } else {
      m = /^./.exec(rest)!;
      push("punct", m[0]);
    }
    i += m[0].length;
  }
  return tokens;
}

const attr = (line: string, name: string): string | null => {
  const m = new RegExp(`\\s${name.replace(".", "\\.")}="([^"]*)"`).exec(line);
  return m ? unescape(m[1]) : null;
};

function unescape(text: string): string {
  return text.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#10;/g, "\n").replace(/&amp;/g, "&");
}

export type MeiIndex = {
  pieces: { n: number; label: string | null; line: number }[];
  measures: { piece: number; n: string; line: number }[];
  ids: Map<string, number>; // xml:id → the line of its element
  element: Int32Array; // per line: the line where the element it is part of starts (-1 for none)
  parent: Int32Array; // per line where an element starts: the line where its parent starts (-1 for the root)
  lineIds: (string | null)[]; // per line: the xml:id of the element starting there
  segments: Map<string, { system: number; stretch: number; line: number }[]>; // a measure's parts, by its id's prefix
};

// Where things are, by line (from 0): the pieces and the measures, every element's id, and which element each line is
// part of. The builder writes one element per line (its text on the same line), so the start and end tags are enough.
export function indexMei(lines: string[]): MeiIndex {
  const index: MeiIndex = {
    pieces: [],
    measures: [],
    ids: new Map(),
    element: new Int32Array(lines.length).fill(-1),
    parent: new Int32Array(lines.length).fill(-1),
    lineIds: lines.map(() => null),
    segments: new Map(),
  };
  const open: number[] = [];
  let piece = 0;
  for (const [i, line] of lines.entries()) {
    const text = line.trim();
    const top = open.length ? open[open.length - 1] : -1;
    if (text.startsWith("</")) {
      index.element[i] = top;
      open.pop();
      continue;
    }
    const tag = /^<([\w:.-]+)/.exec(text)?.[1];
    if (!tag) {
      index.element[i] = top;
      continue;
    }
    index.element[i] = i;
    index.parent[i] = top;
    if (!text.endsWith("/>") && !text.endsWith(`</${tag}>`)) open.push(i);
    const id = attr(line, "xml:id");
    if (id) {
      index.ids.set(id, i);
      index.lineIds[i] = id;
      const part = SEGMENT.exec(id);
      if (part) {
        const list = index.segments.get(part[1]) ?? [];
        list.push({ system: Number(part[2]), stretch: Number(part[3]), line: i });
        index.segments.set(part[1], list);
      }
    }
    if (tag === "mdiv") {
      piece = Number(attr(line, "n") ?? index.pieces.length + 1);
      index.pieces.push({ n: piece, label: attr(line, "label"), line: i });
    } else if (tag === "measure") {
      index.measures.push({ piece, n: attr(line, "n") ?? "", line: i });
    }
  }
  return index;
}

// A part of a measure divided at a bar line inside it, or at a system break: `<measure id>-s<system>t<stretch>`, the
// stretch where it starts (DESIGN.md §6, `engrave`).
const SEGMENT = /^(.+)-s(\d+)t(\d+)$/;

// The line of an element of the engraving, by its id. The engraving with the original's breaks has a measure split by
// a system break divided there, so a part the file doesn't have is the part of the file it falls in: the last one that
// starts at or before it.
export function lineOfId(index: MeiIndex, id: string): number | null {
  const exact = index.ids.get(id);
  if (exact !== undefined) return exact;
  const part = SEGMENT.exec(id);
  if (!part) return null;
  const [system, stretch] = [Number(part[2]), Number(part[3])];
  let found: number | null = null;
  for (const s of index.segments.get(part[1]) ?? []) {
    if (s.system < system || (s.system === system && s.stretch <= stretch)) found = s.line;
  }
  return found;
}

// The elements a line is part of, from its own outwards: the lines where they start, with their ids (if any).
export function elementsAt(index: MeiIndex, line: number): { line: number; id: string | null }[] {
  const out: { line: number; id: string | null }[] = [];
  for (let l = index.element[line] ?? -1; l >= 0; l = index.parent[l]) out.push({ line: l, id: index.lineIds[l] });
  return out;
}

// A measure by its number in a piece: the first MEI measure that has it (a measure divided by a bar line inside it has
// several), or that a multi-measure rest's range ("12–15") covers.
export function findMeasure(index: MeiIndex, piece: number, n: number): number | null {
  for (const m of index.measures) {
    if (m.piece !== piece) continue;
    const [from, to] = m.n.split("–").map(Number);
    if (from === n || (to !== undefined && from <= n && n <= to)) return m.line;
  }
  return null;
}

export type Match = { line: number; start: number; end: number };

// Every occurrence of the query, case ignored.
export function search(lines: string[], query: string): Match[] {
  const q = query.toLowerCase();
  if (!q) return [];
  const matches: Match[] = [];
  for (const [line, text] of lines.entries()) {
    const lower = text.toLowerCase();
    for (let at = lower.indexOf(q); at >= 0; at = lower.indexOf(q, at + q.length)) matches.push({ line, start: at, end: at + q.length });
  }
  return matches;
}

// A line's tokens cut at the matches on it: each piece says whether it is in a match, and in the current one.
export function marked(tokens: Token[], ranges: { start: number; end: number; current: boolean }[]): (Token & { mark: "" | "match" | "current" })[] {
  const out: (Token & { mark: "" | "match" | "current" })[] = [];
  let at = 0;
  for (const token of tokens) {
    const cuts = new Set([0, token.text.length]);
    for (const r of ranges) {
      if (r.start > at && r.start < at + token.text.length) cuts.add(r.start - at);
      if (r.end > at && r.end < at + token.text.length) cuts.add(r.end - at);
    }
    const points = [...cuts].sort((a, b) => a - b);
    for (let k = 0; k + 1 < points.length; k++) {
      const from = at + points[k];
      const range = ranges.find((r) => r.start <= from && from < r.end);
      out.push({ kind: token.kind, text: token.text.slice(points[k], points[k + 1]), mark: range ? (range.current ? "current" : "match") : "" });
    }
    at += token.text.length;
  }
  return out;
}
