// The MEI file as `engrave`'s artifact shows it (DESIGN.md §6, `engrave`): what doesn't need React. Each line's syntax
// highlighting, the places to go to (pieces, pages, systems, measures, from the file's own `mdiv`, `measure @n` and
// the facsimile's zones), and searching. The file is the builder's, one element per line, so lines are enough.

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
  pages: Map<number, number>; // page → the line of its first measure
  systems: Map<number, number>; // system → the line of its first measure
  measures: { piece: number; n: string; line: number }[];
};

// Where things are, by line (from 0): the pieces, and the page and system of each measure (the zones of its @facs,
// whose ids name the system: z<system>t<stretches>, DESIGN.md §6, "facsimile").
export function indexMei(lines: string[]): MeiIndex {
  const index: MeiIndex = { pieces: [], pages: new Map(), systems: new Map(), measures: [] };
  const zonePage = new Map<string, number>();
  let surface = 0;
  let piece = 0;
  for (const [i, line] of lines.entries()) {
    const tag = /^\s*<([\w:.-]+)/.exec(line)?.[1];
    if (tag === "surface") surface = Number(attr(line, "n") ?? 0);
    else if (tag === "zone") {
      const id = attr(line, "xml:id");
      if (id) zonePage.set(id, surface);
    } else if (tag === "mdiv") {
      piece = Number(attr(line, "n") ?? index.pieces.length + 1);
      index.pieces.push({ n: piece, label: attr(line, "label"), line: i });
    } else if (tag === "measure") {
      index.measures.push({ piece, n: attr(line, "n") ?? "", line: i });
      const zone = attr(line, "facs")?.split(/\s+/)[0]?.replace(/^#/, "");
      if (!zone) continue;
      const system = /^z(\d+)t/.exec(zone)?.[1];
      if (system && !index.systems.has(Number(system))) index.systems.set(Number(system), i);
      const page = zonePage.get(zone);
      if (page && !index.pages.has(page)) index.pages.set(page, i);
    }
  }
  return index;
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

// The piece a line is in: the last one that starts at or before it.
export function pieceAt(index: MeiIndex, line: number): number {
  let piece = index.pieces[0]?.n ?? 1;
  for (const p of index.pieces) if (p.line <= line) piece = p.n;
  return piece;
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
