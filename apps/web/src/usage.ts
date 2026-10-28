// The Usage tab's active hours (docs/tasks.md, "Other statistics"): the quarters of an hour with any activity, from the
// Worker (apps/worker/src/activity.ts), become the viewer's own hours, active if any of their quarters is, and are
// counted per day, week or month of a time range. Pure functions; the tab is UsageTab.tsx.

import type { ActivityData } from "./api";
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
