// Project names (DESIGN.md §4). Kept out of index.ts: a Worker's entry module may only export handlers.

export const MAX_NAME_LENGTH = 200;

// The default project name: the file name without ".pdf". Must match migrations/0002.
export function defaultName(filename: string): string {
  const trimmed = filename.trim();
  const stem = (trimmed.toLowerCase().endsWith(".pdf") ? trimmed.slice(0, -4) : trimmed).trim();
  return (stem || "Untitled").slice(0, MAX_NAME_LENGTH).trim();
}

// The first of "base", "base (1)", "base (2)", ... that isn't in `taken` (compared case-insensitively).
export function firstFreeName(base: string, taken: string[]): string {
  const lower = new Set(taken.map((name) => name.toLowerCase()));
  for (let n = 0; ; n++) {
    const candidate = n === 0 ? base : `${base} (${n})`;
    if (!lower.has(candidate.toLowerCase())) return candidate;
  }
}
