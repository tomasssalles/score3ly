// The Run times tab (docs/tasks.md, "Other statistics"), over the finished projects the user selects: how long a
// project took (from its creation to its last finish, and its active hours), each step's work time per page, and from
// the automatic steps an estimate for a new score. Pure functions over the Worker's data (apps/worker/src/runTimes.ts);
// the tab is RunTimesTab.tsx.
//
// A manual step's time per page is its finished stages' active time (a quarter of an hour for each quarter in which it
// was saved, and for a single quarter between two of those: apps/worker/src/activeTime.ts), over their pages.
//
// A step's work time per page comes from the items that really ran (migration 0021): an LLM step's items whose answers
// were all asked anew, `rasterize`'s items whose image was made, every item of the other steps. Items are of three
// kinds: a page, a system, the whole score. Per page, a step takes for each kind the average time of an item times the
// items of that kind per page, counted in its finished stages (so a step that works system by system is scaled by the
// systems per page of the project, and `apply_review`, which works only where there are issues, by its own share).
// This is worked out for each project on its own, then averaged over the projects with data for the step, each
// weighing the same (decided): a project whose items all came from the cache has no time for the step and is left
// out, not counted as nothing. Projects on the same PDF needn't be merged, as the costs per page merge them: the cache
// is already left out item by item.

import type { ActivityData, RunTimeData } from "./api";
import { endedNote, stepTitle } from "./costs.ts";
import { activeQuarters } from "./usage.ts";

// Every step but `ingest`, in the pipeline's order. The manual ones aren't part of the estimate for a new score.
export const STEPS = [
  "rasterize",
  "skew_analysis",
  "fix_skew",
  "layout",
  "fix_layout",
  "analyze",
  "fix_metadata",
  "fix_observations",
  "extract",
  "review",
  "apply_review",
  "human_review",
  "fix_mei",
  "engrave",
];
const MANUAL = new Set(["fix_skew", "fix_layout", "fix_metadata", "fix_observations", "human_review", "fix_mei"]);
const LLM = new Set(["layout", "analyze", "extract", "review", "apply_review"]);

type Kind = "whole" | "page" | "system";
const kindOf = (item: string): Kind => (item === "" ? "whole" : item.includes("/") ? "system" : "page");

// Whether an item really ran: no answer from the record (LLM steps), its image made (`rasterize`).
function ranAnew(step: string, calls: number, callsCached: number, images: number, imagesCached: number): boolean {
  if (LLM.has(step)) return callsCached === 0;
  if (step === "rasterize") return imagesCached < images;
  return true;
}

// How long a project took, on average over the selected ones: from its creation to its last finish, breaks and re-runs
// included, and its active hours (as in Usage: a quarter of an hour for each quarter in which anything happened).
export function perProject(data: RunTimeData, selected: Set<string>, activity: ActivityData): { projects: number; spanMs: number | null; activeHours: number | null } {
  const chosen = data.projects.filter((p) => selected.has(p.id));
  if (chosen.length === 0) return { projects: 0, spanMs: null, activeHours: null };
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  return {
    projects: chosen.length,
    spanMs: mean(chosen.map((p) => Date.parse(p.finishedAt) - Date.parse(p.createdAt))),
    activeHours: mean(chosen.map((p) => activeQuarters(activity, p.id).length / 4)),
  };
}

// A step's work time per page over some of its stages, or null without enough data: no finished stage with pages, or a
// kind of item it has with no item that really ran.
function perPage(data: RunTimeData, stages: RunTimeData["stages"]): number | null {
  if (stages.some((s) => s.manual)) return manualPerPage(stages);
  const byId = new Map(stages.map((s) => [s.id, s]));
  const durations: Record<Kind, number[]> = { whole: [], page: [], system: [] };
  for (const [stage, item, ms, calls, callsCached, images, imagesCached] of data.items) {
    const s = byId.get(stage);
    if (s && ranAnew(s.step, calls, callsCached, images, imagesCached)) durations[kindOf(item)].push(ms);
  }
  const done = stages.filter((s) => s.done && s.pageCount > 0);
  const pages = done.reduce((n, s) => n + s.pageCount, 0);
  if (pages === 0) return null;
  let total = 0;
  for (const kind of ["whole", "page", "system"] as Kind[]) {
    const count = done.reduce((n, s) => n + s.items[kind], 0);
    if (count === 0) continue;
    if (durations[kind].length === 0) return null;
    const mean = durations[kind].reduce((a, b) => a + b, 0) / durations[kind].length;
    total += (mean * count) / pages;
  }
  return total;
}

export const QUARTER_MS = 15 * 60 * 1000;

// A manual step's time per page: its finished stages' active time, over their pages.
function manualPerPage(stages: RunTimeData["stages"]): number | null {
  const done = stages.filter((s) => s.done && s.pageCount > 0);
  const pages = done.reduce((n, s) => n + s.pageCount, 0);
  if (pages === 0) return null;
  return (done.reduce((n, s) => n + (s.activeQuarters ?? 0), 0) * QUARTER_MS) / pages;
}

// A step's time per page over some stages: per project, then the mean over the projects that have one.
function perPageOverProjects(data: RunTimeData, stages: RunTimeData["stages"]): number | null {
  const byProject = new Map<string, RunTimeData["stages"]>();
  for (const s of stages) byProject.set(s.projectId, [...(byProject.get(s.projectId) ?? []), s]);
  const values = [...byProject.values()].map((list) => perPage(data, list)).filter((v): v is number => v !== null);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export type StepRow = { step: string; label: string; manual: boolean; ms: number | null; configs: { id: string; label: string; note?: string; ms: number | null }[] };

// Each step's work time per page over the selected projects' stages, in the pipeline's order; with `byConfig`, also per
// model config for the LLM steps (the other steps have no config).
export function stepTimes(data: RunTimeData, selected: Set<string>, byConfig: boolean): StepRow[] {
  const configs = new Map(data.configs.map((m) => [m.id, m]));
  return STEPS.map((step) => {
    const stages = data.stages.filter((s) => s.step === step && selected.has(s.projectId));
    const ids = byConfig && LLM.has(step) ? [...new Set(stages.map((s) => s.configId).filter((id): id is string => id !== null))] : [];
    return {
      step,
      label: stepTitle(step),
      manual: MANUAL.has(step),
      ms: perPageOverProjects(data, stages),
      configs: ids.map((id) => {
        const m = configs.get(id);
        return { id, label: m ? (m.name ?? m.model) : id, note: endedNote(m?.deletedAt ?? null), ms: perPageOverProjects(data, stages.filter((s) => s.configId === id)) };
      }),
    };
  });
}

// The estimate for a new score, per page: the recipe's steps run once each, added up. Null when a step of the recipe
// has no data: no project selected, or (rarely) one added to the recipe after the selected projects ran, or one whose
// every item came from the cache. Steps outside the recipe (manual ones, ...) are left out.
export function estimatePerPage(rows: StepRow[], recipe: string[]): number | null {
  const steps = rows.filter((r) => recipe.includes(r.step));
  if (steps.length < recipe.length || steps.some((r) => r.ms === null)) return null;
  return steps.reduce((sum, r) => sum + r.ms!, 0);
}

// A length of time, short: "0.03 s", "0.4 s", "12 s", "1 min 40 s", "5 h 20 min", "3 d 4 h".
export function duration(ms: number): string {
  const s = ms / 1000;
  if (s === 0) return "0 s";
  if (s < 0.1) return `${Math.max(s, 0.01).toFixed(2)} s`;
  if (s < 10) return `${s.toFixed(1)} s`;
  if (s < 60) return `${Math.round(s)} s`;
  const min = Math.round(s / 60);
  if (s < 3600) {
    const whole = Math.floor(s / 60);
    const rest = Math.round(s - whole * 60);
    return rest ? `${whole} min ${rest} s` : `${whole} min`;
  }
  if (min < 24 * 60) {
    const h = Math.floor(min / 60);
    return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
  }
  const hours = Math.round(min / 60);
  const d = Math.floor(hours / 24);
  return hours % 24 ? `${d} d ${hours % 24} h` : `${d} d`;
}
