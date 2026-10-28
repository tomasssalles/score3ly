// The Usage tab (docs/tasks.md, "Other statistics"). Its active hours: the quarters of an hour with any activity, from
// the Worker (apps/worker/src/activity.ts), become the viewer's own hours, active if any of their quarters is, and are
// counted per day, week or month of a time range. Its pages transcribed: each page of a PDF counted once, when the
// first project with it was finished (apps/worker/src/transcribed.ts). Pure functions; the tab is UsageTab.tsx.

import type { ActivityData, TranscribedData } from "./api";
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

// When each page of each PDF was first transcribed: the projects of a PDF are one score, and a page counts once, on the
// day the first finished project with it was finished.
export function firstTranscribed(data: TranscribedData): { pdf: string; t: number }[] {
  const first = new Map<string, { pdf: string; t: number }>(); // `${pdf}/${page}`
  for (const p of data.projects) {
    if (!p.finishedAt) continue;
    const t = Date.parse(p.finishedAt);
    for (const page of p.pages) {
      const key = `${p.pdfSha256}/${page}`;
      const seen = first.get(key);
      if (!seen || t < seen.t) first.set(key, { pdf: p.pdfSha256, t });
    }
  }
  return [...first.values()];
}

// The pages first transcribed in each bucket and in the whole range, the scores (PDFs) they are in, and the projects
// created, finished and still unfinished in the range (deleted ones too: an abandoned try is an unfinished project).
export function pagesView(
  data: TranscribedData,
  buckets: Bucket[],
  range: { start: number; end: number },
): { values: number[]; total: number; scores: number; created: number; finished: number; unfinished: number } {
  const pages = firstTranscribed(data);
  const inRange = (t: number) => t >= range.start && t < range.end;
  const values = buckets.map((b) => pages.filter((p) => p.t >= b.from && p.t < b.to).length);
  const counted = pages.filter((p) => inRange(p.t));
  const created = data.projects.filter((p) => inRange(Date.parse(p.createdAt)));
  return {
    values,
    total: counted.length,
    scores: new Set(counted.map((p) => p.pdf)).size,
    created: created.length,
    finished: data.projects.filter((p) => p.finishedAt && inRange(Date.parse(p.finishedAt))).length,
    unfinished: created.filter((p) => !p.finishedAt).length,
  };
}
