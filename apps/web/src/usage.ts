// The Usage tab (docs/statistics.md, "Usage"). Its active hours: the quarters of an hour with any activity, from
// the Worker (apps/worker/src/activity.ts), become the viewer's own hours, active if any of their quarters is, and are
// counted per day, week or month of a time range. Its projects: those created in a time range, by what became of them
// (apps/worker/src/projectStats.ts). Its failed calls: by reason, in a time range, for all configs or one
// (apps/worker/src/failures.ts). Pure functions; the tab is UsageTab.tsx.

import type { ActivityData, FailureData, ProjectStats } from "./api";
import type { Bucket } from "./costs";

// The quarters of an hour (their start, in ms) with any activity of the project, or of any project. Every time zone's
// hours start on a quarter, so they fall into the viewer's days as they are.
export function activeQuarters(data: ActivityData, projectId: string | null): number[] {
  const quarters = new Set<number>();
  for (const [project, t] of data.quarters) if (projectId === null || project === projectId) quarters.add(t);
  return [...quarters].sort((a, b) => a - b);
}

// The active hours (a quarter each active quarter) in each bucket (the part of it inside the range), and in the whole
// range on how many days.
export function hoursView(quarters: number[], buckets: Bucket[], range: { start: number; end: number }): { values: number[]; total: number; days: number } {
  const values = buckets.map((b) => quarters.filter((q) => q >= b.from && q < b.to).length / 4);
  const inRange = quarters.filter((q) => q >= range.start && q < range.end);
  const days = new Set(inRange.map((q) => new Date(q).toDateString())).size;
  return { values, total: inRange.length / 4, days };
}

// Hours with at most two decimals, as quarters give them: "21", "2.5", "0.75"; an average may need rounding.
export function hoursNumber(h: number): string {
  return String(Math.round(h * 100) / 100);
}

// "1 active hour", "2.5 active hours".
export const activeHoursText = (h: number) => `${hoursNumber(h)} active ${h === 1 ? "hour" : "hours"}`;

// The projects created in a time range: done (finished now, not deleted), unfinished (not deleted) and deleted, which
// add up to the total.
export function createdIn(data: ProjectStats, range: { start: number; end: number }): { total: number; done: number; unfinished: number; deleted: number } {
  const created = data.projects.filter((p) => {
    const t = Date.parse(p.createdAt);
    return t >= range.start && t < range.end;
  });
  const deleted = created.filter((p) => p.deleted).length;
  const done = created.filter((p) => !p.deleted && p.finished).length;
  return { total: created.length, done, unfinished: created.length - deleted - done, deleted };
}

// The note under the count: its parts, those that are 0 left out ("3 done, 7 unfinished, 2 deleted").
export function createdNote(counts: { done: number; unfinished: number; deleted: number }): string {
  return (
    [
      [counts.done, "done"],
      [counts.unfinished, "unfinished"],
      [counts.deleted, "deleted"],
    ] as const
  )
    .filter(([n]) => n > 0)
    .map(([n, what]) => `${n} ${what}`)
    .join(", ");
}

// Why a call failed, in words: the provider refused it, it got no readable response, its answer couldn't be used, our
// side was wrong, or the app was closed while it waited.
const REASONS: Record<string, string> = {
  overloaded: "Overloaded",
  rate_limit: "Rate limited",
  server: "Server error",
  network: "No connection",
  timeout: "Timed out",
  aborted: "Aborted",
  unreadable_response: "Unreadable response",
  cut_off: "Cut off",
  refused: "Refused",
  unparseable: "Unusable answer",
  unexpected_model: "Wrong model",
  unexpected_stop: "Unexpected stop",
  auth: "Bad credentials",
  bad_request: "Bad request",
  unknown: "Unknown error",
  interrupted: "Interrupted",
};

// The calls in a time range, of one config or all (null), how many failed, and the reasons, the most frequent first.
export function failuresIn(
  data: FailureData,
  range: { start: number; end: number },
  configId: string | null,
): { calls: number; failed: number; reasons: { key: string; label: string; calls: number }[] } {
  let calls = 0;
  const reasons = new Map<string, number>();
  for (const [config, t, reason, n] of data.points) {
    if (t < range.start || t >= range.end || (configId !== null && config !== configId)) continue;
    calls += n;
    if (reason !== "ok") reasons.set(reason, (reasons.get(reason) ?? 0) + n);
  }
  const list = [...reasons].map(([key, n]) => ({ key, label: REASONS[key] ?? key, calls: n }));
  list.sort((a, b) => b.calls - a.calls || a.label.localeCompare(b.label));
  return { calls, failed: list.reduce((sum, r) => sum + r.calls, 0), reasons: list };
}
