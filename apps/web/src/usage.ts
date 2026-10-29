// The Usage tab (docs/tasks.md, "Other statistics"). Its active hours: the quarters of an hour with any activity, from
// the Worker (apps/worker/src/activity.ts), become the viewer's own hours, active if any of their quarters is, and are
// counted per day, week or month of a time range. Its projects: those created in a time range, by what became of them
// (apps/worker/src/projectStats.ts). Pure functions; the tab is UsageTab.tsx.

import type { ActivityData, ProjectStats } from "./api";
import type { Bucket } from "./costs";

// The local hours (their start, in ms) with any activity of the project, or of any project.
export function activeHours(data: ActivityData, projectId: string | null): number[] {
  const hours = new Set<number>();
  for (const [project, t] of data.quarters) {
    if (projectId !== null && project !== projectId) continue;
    const hour = new Date(t);
    hour.setMinutes(0, 0, 0);
    hours.add(hour.getTime());
  }
  return [...hours].sort((a, b) => a - b);
}

// The active hours in each bucket (the part of it inside the range), and in the whole range on how many days.
export function hoursView(hours: number[], buckets: Bucket[], range: { start: number; end: number }): { values: number[]; total: number; days: number } {
  const values = buckets.map((b) => hours.filter((h) => h >= b.from && h < b.to).length);
  const inRange = hours.filter((h) => h >= range.start && h < range.end);
  const days = new Set(inRange.map((h) => new Date(h).toDateString())).size;
  return { values, total: inRange.length, days };
}

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
