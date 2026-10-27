// The MEI file as the MEI view shows it (docs/stages/engrave.md): what doesn't need React. The places to go to
// (pieces and measures, from the file's own `mdiv` and `measure @n`), the elements and their ids (to go between a
// line and the engraving), and searching. The file is the builder's, one element per line, so lines are enough.

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

// The line of an element of the engraving, by its id (Verovio keeps the file's).
export function lineOfId(index: MeiIndex, id: string): number | null {
  return index.ids.get(id) ?? null;
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
