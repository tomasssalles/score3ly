// How numbers, dates and durations are written in the app (docs/style.md, "Words": one fixed format, independent of the
// browser's language). Amounts of money are in money.ts, prices per million tokens in pricing.ts, the statistics'
// calendar (ranges, buckets and their labels) in calendar.ts.

// ---- Counts ----

// A word for a number of things, in the singular for 1 only: "page", "pages"; `plural` for a word that doesn't just
// take an "s" ("staff", "staves").
export function plural(n: number, word: string, plural = `${word}s`): string {
  return n === 1 ? word : plural;
}

// The number and its word: "1 page", "3 pages", "0 pages".
export function count(n: number, word: string, pluralWord?: string): string {
  return `${n} ${plural(n, word, pluralWord)}`;
}

// A part of a whole as a whole percentage: "42%"; "–" when there is no whole.
export function percent(n: number, of: number): string {
  return of === 0 ? "–" : `${Math.round((n / of) * 100)}%`;
}

// The card's note of a manual stage that corrects pages (`fix_skew`, `fix_layout`): "lines changed on 2 of 10 pages",
// "layout changed" for a single page, "no changes".
export function fixNote(noun: string, changed: number, pages: number): string {
  if (changed === 0) return "no changes";
  return pages === 1 ? `${noun} changed` : `${noun} changed on ${changed} of ${count(pages, "page")}`;
}

const MB = 1024 * 1024;

// A size in bytes: "120 MB", "1.4 GB".
export function formatSize(bytes: number): string {
  const mb = Math.round(bytes / MB);
  return mb >= 1000 ? `${(bytes / (1000 * MB)).toFixed(1)} GB` : `${mb} MB`;
}

// ---- Dates ----

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// How long ago a time was, compactly: "20min ago", "5h ago", "2d ago".
export function ago(iso: string, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// A date as "7 Oct", with the year ("7 Oct 2025") unless it is the current one. The day is the device's
// local one. The format is fixed: it doesn't follow the browser's language (docs/style.md).
export function shortDate(iso: string, now: number = Date.now()): string {
  const date = new Date(iso);
  const dayAndMonth = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === new Date(now).getFullYear() ? dayAndMonth : `${dayAndMonth} ${date.getFullYear()}`;
}

// A date always with its year: "7 Oct 2026".
export function fullDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

// A time as how long ago it was while that is less than a week ("2d ago"), else as a date ("7 Oct") (
// docs/style.md). Times in the future count as now.
export function when(iso: string, now: number = Date.now()): string {
  return now - Date.parse(iso) < 7 * 86400_000 ? ago(iso, now) : shortDate(iso, now);
}

// A deleted project's mark (docs/style.md, "Words"): with its date, so two projects of the same name are told apart.
export function deletedNote(deletedAt: string | null): string | undefined {
  return deletedAt ? `(deleted ${fullDate(deletedAt)})` : undefined;
}

// A deleted or edited model config's mark, the same way: the day its row ended.
export function endedNote(deletedAt: string | null): string | undefined {
  return deletedAt ? `(until ${fullDate(deletedAt)})` : undefined;
}

// ---- Durations ----

// A run time, compactly (docs/style.md): "8s", "3min 12s", "1h 5min". Rounded to the second first.
export function duration(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}min`;
}

// A length of time in the statistics, short, down to hundredths of a second (times per page are often under one):
// "0.03 s", "0.4 s", "12 s", "1 min 40 s", "5 h 20 min", "3 d 4 h". Each form is chosen after rounding to its
// precision, so a value never reads "60 s" or "1 min 60 s".
export function statDuration(ms: number): string {
  const s = ms / 1000;
  if (s === 0) return "0 s";
  const hundredths = Math.max(1, Math.round(s * 100));
  if (hundredths < 10) return `${(hundredths / 100).toFixed(2)} s`;
  const tenths = Math.round(s * 10);
  if (tenths < 100) return `${(tenths / 10).toFixed(1)} s`;
  const seconds = Math.round(s);
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) {
    const rest = seconds % 60;
    return rest ? `${Math.floor(seconds / 60)} min ${rest} s` : `${Math.floor(seconds / 60)} min`;
  }
  const min = Math.round(s / 60);
  if (min < 24 * 60) {
    const h = Math.floor(min / 60);
    return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
  }
  const hours = Math.round(min / 60);
  const d = Math.floor(hours / 24);
  return hours % 24 ? `${d} d ${hours % 24} h` : `${d} d`;
}
