// The checks of an MEI file edited by hand, before `final_touches` applies it (DESIGN.md §6, `final_touches`): well
// formed and valid against MEI 5.1 (the full schema, given as `validate`: meiSchema.ts), every `xml:id` unique, every
// `#id` reference pointing to an element that exists. And how many lines an edit changed, for the card.

// line: counted from 1. syntax: the file isn't well formed (nothing after it is checked).
export type MeiProblem = { line: number | null; message: string; syntax?: true };

// Duplicate ids and references to ids nothing has. Attributes are read line by line (the builder writes one element
// per line, and a person editing it rarely breaks an attribute over lines).
export function idProblems(text: string): MeiProblem[] {
  const lines = text.split("\n");
  const ids = new Map<string, number>();
  const problems: MeiProblem[] = [];
  for (const [i, line] of lines.entries()) {
    for (const m of line.matchAll(/\sxml:id="([^"]*)"/g)) {
      const first = ids.get(m[1]);
      if (first !== undefined) problems.push({ line: i + 1, message: `The id "${m[1]}" is already used on line ${first}.` });
      else ids.set(m[1], i + 1);
    }
  }
  for (const [i, line] of lines.entries()) {
    for (const m of line.matchAll(/\s([\w:.-]+)="([^"]*)"/g)) {
      if (m[1] === "xml:id") continue;
      for (const token of m[2].split(/\s+/)) {
        if (token.startsWith("#") && token.length > 1 && !ids.has(token.slice(1))) {
          problems.push({ line: i + 1, message: `@${m[1]} points to "${token}", but no element has that id.` });
        }
      }
    }
  }
  return problems.sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
}

// Every check: the schema's first (a file that isn't well formed has nothing else worth checking), then the ids.
export async function checkMei(text: string, validate: (text: string) => Promise<MeiProblem[]>): Promise<MeiProblem[]> {
  const schema = await validate(text);
  if (schema.some((p) => p.syntax)) return schema;
  return [...schema, ...idProblems(text)].sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
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
  return lines === 0 ? "no changes" : `${lines} line${lines === 1 ? "" : "s"} changed`;
}
