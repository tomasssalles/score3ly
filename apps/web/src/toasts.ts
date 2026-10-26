// The toasts about the pipeline (DESIGN.md §5.6, "Progress"): one short line for something that just happened without
// the user doing it right then, "Layout done. Starting Analyze". What happened is found by comparing two snapshots of
// the pipeline; the events of a short moment are joined into one text, which names the stages in bold.

import type { Pipeline, StageStatus } from "./pipeline";

export type Snapshot = {
  stages: { id: string; title: string; status: StageStatus; carried: boolean; interrupted: boolean }[];
  dropped: { id: number; title: string }[];
};

export function snapshotOf(pipeline: Pipeline): Snapshot {
  return {
    stages: pipeline.stages.map(({ id, title, status, carried, interrupted }) => ({ id, title, status, carried, interrupted })),
    dropped: pipeline.dropped.map(({ id, title }) => ({ id, title })),
  };
}

export type ToastEvent =
  | { kind: "done"; title: string } // a stage finished
  | { kind: "applied"; title: string } // a carried manual stage was kept, done (§5.5)
  | { kind: "dropped"; title: string } // a carried manual stage was dropped, its inputs having changed
  | { kind: "started"; title: string } // the next stage started (here or on another device)
  | { kind: "ready"; title: string } // the next stage waits for the user: to be run, or (a manual one) finished
  | { kind: "failed"; title: string; interrupted: boolean } // a stage failed, or stopped running unexpectedly
  | { kind: "pipelineDone" };

// What happened between two snapshots of the same project's pipeline.
export function eventsBetween(before: Snapshot, after: Snapshot): ToastEvent[] {
  // Nothing happens between no pipeline (still loading) and one.
  if (before.stages.length === 0) return [];
  const events: ToastEvent[] = [];
  const earlier = new Map(before.stages.map((s) => [s.id, s]));
  for (const stage of after.stages) {
    const was = earlier.get(stage.id);
    if (!was) continue;
    if (was.status !== "done" && stage.status === "done" && !stage.carried) {
      events.push({ kind: was.carried ? "applied" : "done", title: stage.title });
    }
    if (was.status !== "failed" && stage.status === "failed") {
      events.push({ kind: "failed", title: stage.title, interrupted: stage.interrupted });
    }
  }
  const known = new Set(before.dropped.map((d) => d.id));
  for (const card of after.dropped) if (!known.has(card.id)) events.push({ kind: "dropped", title: card.title });

  // Where the pipeline is now: a stage that started, one that waits for the user, or the end.
  const current = (s: Snapshot) => s.stages.find((stage) => stage.status !== "done");
  const was = current(before);
  const now = current(after);
  if (now) {
    const changed = was?.id !== now.id || was.status !== now.status;
    if (changed && now.status === "running") events.push({ kind: "started", title: now.title });
    if (changed && (now.status === "ready" || now.status === "wip") && !now.carried) events.push({ kind: "ready", title: now.title });
  } else if (was && after.stages.length > 0) {
    events.push({ kind: "pipelineDone" });
  }
  return events;
}

export type Segment = { text: string; bold?: boolean };

// The last event of a kind.
function last<K extends ToastEvent["kind"]>(events: ToastEvent[], ...kinds: K[]): Extract<ToastEvent, { kind: K }> | undefined {
  return [...events].reverse().find((e): e is Extract<ToastEvent, { kind: K }> => (kinds as string[]).includes(e.kind));
}

// One toast for the events of a moment, or null if none is worth one. A failure says only that; the end of the
// pipeline only that; otherwise the last stage that finished, the carried stages kept or dropped on the way, and where
// the pipeline is now: "Skew detection done. Fix skew dropped (inputs changed). Starting Layout". No period at the end.
export function toastText(events: ToastEvent[]): Segment[] | null {
  const failed = last(events, "failed");
  if (failed) return [{ text: failed.title, bold: true }, { text: ` ${failed.interrupted ? "interrupted" : "failed"}. Pipeline stopped` }];
  if (events.some((e) => e.kind === "pipelineDone")) return [{ text: "Pipeline done" }];
  const sentences: Segment[][] = [];
  const done = last(events, "done");
  if (done) sentences.push([{ text: done.title, bold: true }, { text: " done" }]);
  for (const e of events) {
    if (e.kind === "applied") sentences.push([{ text: e.title, bold: true }, { text: " applied" }]);
    if (e.kind === "dropped") sentences.push([{ text: e.title, bold: true }, { text: " dropped (inputs changed)" }]);
  }
  const end = last(events, "started", "ready");
  if (end?.kind === "started") sentences.push([{ text: "Starting " }, { text: end.title, bold: true }]);
  if (end?.kind === "ready") sentences.push([{ text: end.title, bold: true }, { text: " ready" }]);
  if (sentences.length === 0) return null;
  return sentences.flatMap((sentence, i) => (i === 0 ? sentence : [{ text: ". " }, ...sentence]));
}

// The text without its bold, e.g. for tests and screen readers.
export function plainText(segments: Segment[]): string {
  return segments.map((s) => s.text).join("");
}
