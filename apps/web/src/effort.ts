// The Effort tab (docs/tasks.md, "Other statistics"): how often the automated pipeline wasn't good enough and the user
// stepped in, over the finished projects the user selects (the same data as Run times, apps/worker/src/runTimes.ts).
// A project needed a hand if it has a finished manual stage, a review beyond the recipe's, or a stage run again after a
// change (one no longer in any pipeline: replaced, e.g. by another config or a dropped stage, or stopped). For now,
// how often only: how much each fix changed isn't recorded. Pure functions; the tab is EffortTab.tsx.

import type { RunTimeData } from "./api";
import { stepTitle } from "./costs.ts";

// The kinds of help, in the pipeline's order, each with whether a stage is one.
const KINDS: { key: string; label: string; is: (s: RunTimeData["stages"][number]) => boolean }[] = [
  ...["fix_skew", "fix_layout", "fix_metadata", "fix_observations", "human_review", "fix_mei"].map((step) => ({
    key: step,
    label: stepTitle(step),
    is: (s: RunTimeData["stages"][number]) => s.step === step && s.done,
  })),
  { key: "extra_review", label: "Extra reviews", is: (s) => s.step === "review" && !s.inRecipe },
  { key: "rerun", label: "Re-runs", is: (s) => !s.kept },
];

export type EffortView = {
  projects: number; // selected
  helped: number; // of them, those that needed a hand
  rows: { key: string; label: string; projects: number | null }[]; // null: nothing to count yet (no reviews at all)
};

export function effortView(data: RunTimeData, selected: Set<string>): EffortView {
  const stages = data.stages.filter((s) => selected.has(s.projectId));
  const helpedBy = (is: (s: RunTimeData["stages"][number]) => boolean) => new Set(stages.filter(is).map((s) => s.projectId));
  const all = helpedBy((s) => KINDS.some((k) => k.is(s)));
  // Reviews don't exist until the step is built: a dash, not "0%", while no project has any.
  const reviews = data.stages.some((s) => s.step === "review");
  return {
    projects: selected.size,
    helped: all.size,
    rows: KINDS.map((k) => ({ key: k.key, label: k.label, projects: k.key === "extra_review" && !reviews ? null : helpedBy(k.is).size })),
  };
}

// A share as a whole percentage, "–" without projects.
export const share = (n: number, of: number) => (of === 0 ? "–" : `${Math.round((n / of) * 100)}%`);
