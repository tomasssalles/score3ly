// Which pages of the PDF a project uses (docs/stages/pages.md), in the notation known from print dialogs:
// "1, 41-47". Page numbers are the PDF's own, counted from 1, not the numbers printed on the pages. Empty means
// all pages.

// The pages written, in order and without repeats, or the reason the text isn't a selection.
export function parsePages(text: string): { pages: number[] } | { error: string } {
  const pages = new Set<number>();
  for (const part of text.split(",").map((p) => p.trim())) {
    if (part === "") continue;
    const match = /^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(part);
    if (!match) return { error: `"${part}" isn't a page or a range of pages, like 3 or 41-47.` };
    const first = Number(match[1]);
    const last = match[2] === undefined ? first : Number(match[2]);
    if (first < 1) return { error: "Pages are counted from 1." };
    if (last < first) return { error: `"${part}" goes backwards.` };
    if (last > 100000) return { error: `"${part}" is beyond any PDF.` };
    for (let n = first; n <= last; n++) pages.add(n);
  }
  return { pages: [...pages].sort((a, b) => a - b) };
}

// The selection applied to a PDF of `pageCount` pages: all of them when the text is empty.
export function selectPages(text: string, pageCount: number): { pages: number[] } | { error: string } {
  const parsed = parsePages(text);
  if ("error" in parsed) return parsed;
  if (parsed.pages.length === 0) return { pages: Array.from({ length: pageCount }, (_, i) => i + 1) };
  const beyond = parsed.pages.find((n) => n > pageCount);
  if (beyond !== undefined) {
    return { error: `The PDF has ${pageCount} page${pageCount === 1 ? "" : "s"}: there is no page ${beyond}.` };
  }
  return parsed;
}

// The shortest way to write pages: "1, 3-5, 9". The same pages always give the same text.
export function formatPages(pages: number[]): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(j === i ? String(sorted[i]) : `${sorted[i]}-${sorted[j]}`);
    i = j + 1;
  }
  return parts.join(", ");
}
