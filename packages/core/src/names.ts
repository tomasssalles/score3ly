// Names of projects and of model configs (docs/overview.md §4, docs/llm.md, "Configs"): unique, ignoring case, and at
// most 200 characters, numbered like file managers number copies when the name asked for is taken.

export const MAX_NAME_LENGTH = 200;

// One number at the end, as a taken name is numbered: " (1)" to " (999)".
const NUMBER_AT_END = / \(\d{1,3}\)$/;

// Whether a (trimmed) name is longer than names may be: more than 200 characters without one number at its end
// (decided 2026-11-17), so that a 200-character name can be numbered and the numbered name given again by a rename.
export function nameTooLong(name: string): boolean {
  return name.replace(NUMBER_AT_END, "").length > MAX_NAME_LENGTH;
}

const cut = (name: string, length: number) => name.slice(0, length).trim();

// The first of "base", "base (1)", "base (2)", … that isn't in `taken` (compared case-insensitively), within the
// limit: a base too long is cut to 200 characters first, and from " (1000)" on, as far as the number needs.
export function firstFreeName(base: string, taken: string[]): string {
  const lower = new Set(taken.map((name) => name.toLowerCase()));
  const free = (name: string) => !lower.has(name.toLowerCase());
  const whole = nameTooLong(base) ? cut(base, MAX_NAME_LENGTH) : base;
  if (free(whole)) return whole;
  // A name with its own number at the end may be longer than 200: numbered again, it would no longer fit.
  const stem = cut(whole, MAX_NAME_LENGTH);
  for (let n = 1; ; n++) {
    const suffix = ` (${n})`;
    const candidate = n < 1000 ? `${stem}${suffix}` : `${cut(stem, MAX_NAME_LENGTH - suffix.length)}${suffix}`;
    if (free(candidate)) return candidate;
  }
}
