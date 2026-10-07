// Helpers for FittedText: shortening a text in the middle so it fits its place.

// The text with only `keep` of its characters left, half from the start and half from the end, and "…"
// in place of the rest. The end is kept because names often differ only there ("Sonata (1)", "Sonata (2)").
export function truncateMiddle(text: string, keep: number): string {
  const chars = Array.from(text); // by character, so an emoji is never cut in half
  if (keep >= chars.length) return text;
  const head = Math.ceil(Math.max(0, keep) / 2);
  const tail = Math.floor(Math.max(0, keep) / 2);
  const start = chars.slice(0, head).join("").trimEnd();
  const end = tail > 0 ? chars.slice(-tail).join("").trimStart() : "";
  return `${start}…${end}`;
}

// The largest n from 0 to `max` for which `fits(n)` is true, given that a smaller n always fits if a larger
// one does. 0 if nothing fits. Binary search: about log2(max) calls of `fits`.
export function largestFitting(max: number, fits: (n: number) => boolean): number {
  let low = 0; // known to fit (or the fallback)
  let high = max; // the largest candidate left
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (fits(middle)) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return low;
}

// The text split around the first occurrence of `query` (case-insensitive): [before, match, after].
// null if there is no query or it doesn't occur.
export function splitAtMatch(text: string, query: string): [string, string, string] | null {
  const i = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (i < 0) return null;
  return [text.slice(0, i), text.slice(i, i + query.length), text.slice(i + query.length)];
}
