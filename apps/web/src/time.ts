// How long ago a time was, compactly: "20min ago", "5h ago", "2d ago".
export function ago(iso: string, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// A date as "7 Oct", with the year ("7 Oct 2025") unless it is the current one. The day is the device's
// local one. The format is fixed: it doesn't follow the browser's language (docs/style.md).
export function shortDate(iso: string, now: number = Date.now()): string {
  const date = new Date(iso);
  const dayAndMonth = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === new Date(now).getFullYear() ? dayAndMonth : `${dayAndMonth} ${date.getFullYear()}`;
}

// A time as how long ago it was while that is less than a week ("2d ago"), else as a date ("7 Oct") (
// docs/style.md). Times in the future count as now.
export function when(iso: string, now: number = Date.now()): string {
  return now - Date.parse(iso) < 7 * 86400_000 ? ago(iso, now) : shortDate(iso, now);
}

// A run time, compactly: "8s", "3min 12s", "1h 5min".
export function duration(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}min`;
}
