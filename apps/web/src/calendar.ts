// The statistics' calendar (docs/statistics.md, "The costs view"): time ranges of whole days in the device's time zone,
// cut into calendar days, weeks or months (the bars of a chart), and their labels. Used by the Costs and Usage tabs.

import { MONTHS } from "./format.ts";

export type RangeId = "7d" | "30d" | "3m" | "12m" | "all";
export type Granularity = "day" | "week" | "month";

export const RANGES: { id: RangeId; label: string }[] = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "3m", label: "Last 3 months" },
  { id: "12m", label: "Last 12 months" },
  { id: "all", label: "All time" },
];

export const GRANULARITIES: { id: Granularity; label: string }[] = [
  { id: "day", label: "Per day" },
  { id: "week", label: "Per week" },
  { id: "month", label: "Per month" },
];

function midnight(t: number): Date {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d;
}

// A range of calendar days in the device's time zone: from the first day's midnight to the midnight after the last
// day (today), so its last bucket is today. "All time" starts on the day of the first cost.
export function rangeOf(range: RangeId, now: number, firstCost: number | null): { start: number; end: number } {
  const today = midnight(now);
  const end = new Date(today);
  end.setDate(end.getDate() + 1);
  const start = new Date(today);
  if (range === "7d") start.setDate(start.getDate() - 6);
  else if (range === "30d") start.setDate(start.getDate() - 29);
  else if (range === "3m" || range === "12m") {
    start.setMonth(start.getMonth() - (range === "3m" ? 3 : 12));
    start.setDate(start.getDate() + 1);
  } else if (firstCost !== null && firstCost < today.getTime()) return { start: midnight(firstCost).getTime(), end: end.getTime() };
  return { start: start.getTime(), end: end.getTime() };
}

// The number of calendar days in a range (a day with a change of summer time is still one day).
export function dayCount(start: number, end: number): number {
  return Math.round((end - start) / 86_400_000);
}

// A granularity coarser than the range makes no sense: a week only for more than 7 days, a month for more than 31.
export function granularitiesFor(start: number, end: number): Granularity[] {
  const days = dayCount(start, end);
  return ["day", ...(days > 7 ? (["week"] as const) : []), ...(days > 31 ? (["month"] as const) : [])];
}

// What a range starts with; the user can pick another.
export function defaultGranularity(range: RangeId, start: number, end: number): Granularity {
  if (range === "7d" || range === "30d") return "day";
  if (range === "3m") return "week";
  if (range === "12m") return "month";
  const days = dayCount(start, end);
  return days <= 31 ? "day" : days <= 183 ? "week" : "month";
}

// A bar of the chart: a calendar day, week (Monday to Sunday) or month, and the part of it inside the range (the
// first and last may be cut).
export type Bucket = { start: number; end: number; from: number; to: number };

export function bucketsOf(start: number, end: number, granularity: Granularity): Bucket[] {
  const first = new Date(start);
  if (granularity === "week") first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  if (granularity === "month") first.setDate(1);
  const buckets: Bucket[] = [];
  for (let d = first; d.getTime() < end; ) {
    const next = new Date(d);
    if (granularity === "day") next.setDate(next.getDate() + 1);
    else if (granularity === "week") next.setDate(next.getDate() + 7);
    else next.setMonth(next.getMonth() + 1);
    buckets.push({ start: d.getTime(), end: next.getTime(), from: Math.max(start, d.getTime()), to: Math.min(end, next.getTime()) });
    d = next;
  }
  return buckets;
}

// The short label under a bar: "7 Oct" for a day or a week (its Monday), "Oct" for a month ("Jan 2026" where a year
// starts, or on the first bar).
export function axisLabel(bucket: Bucket, granularity: Granularity, first: boolean): string {
  const d = new Date(bucket.start);
  if (granularity !== "month") return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getMonth() === 0 || first ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : MONTHS[d.getMonth()];
}

// What a bar covers, in full, for the readout: "7 Oct 2026", "6–12 Oct 2026", "29 Sep – 5 Oct 2026", "Oct 2026", and
// for a bar cut by the range, the days inside it ("28–30 Sep 2026").
export function bucketTitle(bucket: Bucket, granularity: Granularity): string {
  const from = new Date(bucket.from);
  const last = new Date(bucket.to - 1);
  if (granularity === "month" && bucket.from === bucket.start && bucket.to === bucket.end) return `${MONTHS[from.getMonth()]} ${from.getFullYear()}`;
  if (granularity === "day" || (from.getDate() === last.getDate() && from.getMonth() === last.getMonth())) {
    return `${from.getDate()} ${MONTHS[from.getMonth()]} ${from.getFullYear()}`;
  }
  const year = from.getFullYear() === last.getFullYear() ? "" : ` ${from.getFullYear()}`;
  const start = from.getMonth() === last.getMonth() && !year ? `${from.getDate()}` : `${from.getDate()} ${MONTHS[from.getMonth()]}${year}`;
  const dash = start.includes(" ") ? " – " : "–";
  return `${start}${dash}${last.getDate()} ${MONTHS[last.getMonth()]} ${last.getFullYear()}`;
}
