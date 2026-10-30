// The Effort tab (docs/tasks.md, "Other statistics"): how much the user had to step in, over the finished projects the
// user selects (the same data as Run times, apps/worker/src/runTimes.ts). Only the final pipeline counts (decided: the
// work that was necessary; what was discarded could have been avoided with the right configs from the start): its
// manual stages, with the stages each replaced by being edited (their work is what it builds on), and its extra
// reviews. A manual stage's work is its active time: a quarter of an hour for each quarter in which it was saved, and
// for a single quarter between two of those. Pure functions; the tab is EffortTab.tsx.

import type { RunTimeData } from "./api";
import { stepTitle } from "./costs.ts";
import { QUARTER_MS } from "./runTimes.ts";

const MANUAL = ["fix_skew", "fix_layout", "fix_metadata", "fix_observations", "human_review", "fix_mei"];

type Stage = RunTimeData["stages"][number];

export type EffortView = {
  perPageMs: number | null; // all manual work, per page of the selected projects; null without pages
  rows: { step: string; label: string; perPageMs: number | null; usedIn: number }[]; // each manual step's share of it
  projects: number; // selected
  extraReviews: number | null; // per project, on average; null while no project has any review
};

export function effortView(data: RunTimeData, selected: Set<string>): EffortView {
  const stages = new Map(data.stages.map((s) => [s.id, s]));
  const chosen = data.projects.filter((p) => selected.has(p.id));
  const pages = chosen.reduce((n, p) => n + p.pages.length, 0);
  // Each project's manual stages in its final pipeline, with those they replaced by being edited.
  const manual = new Map<string, Stage[]>();
  let extra = 0;
  for (const p of chosen) {
    const final = p.pipeline.map((id) => stages.get(id)).filter((s): s is Stage => s !== undefined);
    const work: Stage[] = [];
    for (const s of final.filter((s) => MANUAL.includes(s.step))) {
      for (let at: Stage | undefined = s; at; at = at.replacesStageId ? stages.get(at.replacesStageId) : undefined) work.push(at);
    }
    manual.set(p.id, work);
    extra += final.filter((s) => s.step === "review" && !s.inRecipe).length;
  }
  const ms = (list: Stage[]) => list.reduce((n, s) => n + (s.activeQuarters ?? 0) * QUARTER_MS, 0);
  const rows = MANUAL.map((step) => {
    const of = [...manual.values()].map((list) => list.filter((s) => s.step === step));
    return { step, label: stepTitle(step), perPageMs: pages ? ms(of.flat()) / pages : null, usedIn: of.filter((list) => list.length > 0).length };
  });
  return {
    perPageMs: pages ? rows.reduce((n, r) => n + r.perPageMs!, 0) : null,
    rows,
    projects: chosen.length,
    // Reviews don't exist until the step is built: a dash, not "0", while no project has any.
    extraReviews: data.stages.some((s) => s.step === "review") && chosen.length ? extra / chosen.length : null,
  };
}

// A share as a whole percentage, "–" without projects.
export const share = (n: number, of: number) => (of === 0 ? "–" : `${Math.round((n / of) * 100)}%`);
