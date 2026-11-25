// The costs view (docs/statistics.md, "The costs view"): what was paid for, by time range, cut into the viewer's calendar
// days, weeks or months, split into groups and filtered by the same groupings. Pure functions over the Worker's data
// (apps/worker/src/costs.ts); the tab is CostsTab.tsx, the chart TimeChart.tsx, the calendar calendar.ts.

import { type CostOutcome, PROVIDER_NAMES, stepsOfKind } from "@score3ly/core";
import type { CostData } from "./api";
import { type Bucket, bucketsOf, type Granularity } from "./calendar.ts";
import { deletedNote, endedNote } from "./format.ts";
import { OUTCOME_LABELS } from "./outcomes.ts";
import { stepInfo } from "./steps.ts";

// ---- Groupings ----

export type Dimension = "stage" | "project" | "config" | "status";

export const DIMENSIONS: { id: Dimension; label: string }[] = [
  { id: "stage", label: "Stage" },
  { id: "project", label: "Project" },
  { id: "config", label: "Model config" },
  { id: "status", label: "Call status" },
];

// The ways of grouping each dimension, hand-picked; the first is none: each step, project, config or status on its
// own, shown as a dash on the picker's button (the dimension's name is next to it).
const NONE = { label: "No grouping", short: "–" };

export const GROUPINGS: Record<Dimension, { id: string; label: string; short?: string }[]> = {
  stage: [
    { id: "step", ...NONE },
    { id: "origin", label: "Recipe or added" },
    { id: "fate", label: "Kept or discarded" },
  ],
  project: [
    { id: "project", ...NONE },
    { id: "pdf", label: "PDF" },
    { id: "alive", label: "Current or deleted" },
  ],
  config: [
    { id: "config", ...NONE },
    { id: "model", label: "Model" },
    { id: "provider", label: "Provider" },
    { id: "family", label: "Model family" },
  ],
  status: [
    { id: "status", ...NONE },
    { id: "success", label: "Success/Failure" },
  ],
};

// note: shown after the label, muted and in italics. rank: the group's place in a list whose groups are known in
// advance (the pipeline's order, Low to Max, ...); groups without one, a project, a PDF or a config, are listed the
// most expensive first.
export type Group = { key: string; label: string; note?: string; rank?: number };

export const stepTitle = (step: string) => stepInfo(step).title;
// The LLM steps in the pipeline's order.
const LLM_STEPS: readonly string[] = stepsOfKind("llm");

// The providers in the costs' order, named as everywhere (`PROVIDER_NAMES`). The fake provider that ships with the app
// costs nothing, so it never shows here; the one for development does.
const PROVIDERS: Partial<Record<string, string>> = Object.fromEntries(
  (["anthropic", "bedrock", "ai-studio", "openrouter", "vertex", "fake-dev"] as const).map((p) => [p, PROVIDER_NAMES[p]]),
);
const FAMILIES: Record<string, string> = { claude: "Claude", gemini: "Gemini", fake: "Fake" };
const FAMILY_ORDER = ["Claude", "Gemini", "Fake"];

// A paid call's status as the costs view tells them apart (the Worker's `outcome`), in this order; named as in Usage.
const STATUSES: CostOutcome[] = ["ok", "cut_off", "refused", "unparseable", "unexpected_model", "unexpected_stop"];
const rankIn = (order: readonly string[], key: string) => (order.includes(key) ? order.indexOf(key) : order.length);

// The group of a point (its stage, its config and its calls' status) in a grouping. `byName`: configs with the same
// name together, e.g. the versions of an edited config. The calls of unknown cost have no status: every status
// grouping lets them through (see costView).
export type Grouper = (stageId: string, configId: string, status?: string) => Group;

export function grouper(data: CostData, dimension: Dimension, grouping: string, byName = false): Grouper {
  const stages = new Map(data.stages.map((s) => [s.id, s]));
  const projects = new Map(data.projects.map((p) => [p.id, p]));
  const configs = new Map(data.configs.map((m) => [m.id, m]));
  // The Worker sends every stage, project and config its points refer to.
  if (dimension === "stage") {
    return (stageId) => {
      const s = stages.get(stageId)!;
      if (grouping === "origin") return s.inRecipe ? { key: "recipe", label: "Recipe stages", rank: 0 } : { key: "added", label: "Added stages", rank: 1 };
      if (grouping === "fate") return s.kept ? { key: "kept", label: "Kept", rank: 0 } : { key: "discarded", label: "Replaced or stopped", rank: 1 };
      return { key: s.step, label: stepTitle(s.step), rank: rankIn(LLM_STEPS, s.step) };
    };
  }
  if (dimension === "project") {
    // Names can repeat once a project is deleted: a deleted one is marked, with the day it was deleted.
    return (stageId) => {
      const p = projects.get(stages.get(stageId)!.projectId)!;
      if (grouping === "alive") return p.deletedAt ? { key: "deleted", label: "Deleted projects", rank: 1 } : { key: "current", label: "Current projects", rank: 0 };
      if (grouping === "pdf") return { key: p.pdfSha256, label: p.pdfFilename };
      return { key: p.id, label: p.name, note: deletedNote(p.deletedAt) };
    };
  }
  if (dimension === "status") {
    return (_stageId, _configId, status = "") => {
      if (grouping === "success") return status === "ok" ? { key: "ok", label: "Succeeded", rank: 0 } : { key: "failed", label: "Failed", rank: 1 };
      return { key: status, label: OUTCOME_LABELS[status as CostOutcome] ?? status, rank: rankIn(STATUSES, status) };
    };
  }
  const providers = Object.keys(PROVIDERS);
  return (_stageId, configId) => {
    const m = configs.get(configId)!;
    // The model, whatever the provider and config: Claude Opus 5.5 on Bedrock and on Anthropic together.
    if (grouping === "model") return { key: `model:${m.modelKey}`, label: m.modelLabel };
    if (grouping === "provider") return { key: m.provider, label: PROVIDERS[m.provider] ?? m.provider, rank: rankIn(providers, m.provider) };
    if (grouping === "family") {
      const family = FAMILIES[m.family] ?? m.family;
      return { key: family, label: family, rank: rankIn(FAMILY_ORDER, family) };
    }
    const name = m.name ?? m.model;
    if (byName) return { key: `name:${name}`, label: name };
    // An edited or deleted config's row ended then: the versions of an edited config are told apart by it.
    return { key: m.id, label: name, note: endedNote(m.deletedAt) };
  };
}

// ---- Filters and the split ----

// One filter per dimension: a grouping, and the groups of it that are hidden (none at first). Another grouping starts
// with nothing hidden, so all that is filtered is always in view. The filters of the dimensions all apply.
export type Filter = { grouping: string; hidden: string[] };
export type Filters = Partial<Record<Dimension, Filter>>;

export function hiddenCount(filters: Filters): number {
  return Object.values(filters).reduce((n, f) => n + (f?.hidden.length ?? 0), 0);
}

export type Split = { dimension: Dimension; grouping: string; byName: boolean } | null;

// Every group of a grouping, whatever the time range, so that a filter never depends on the range: a wider range
// can't bring in a group the user never saw. Groups known in advance in their own order, the others the most
// expensive first, over all time. Calls of unknown cost bring in their stages, projects and configs too (at $0), so
// that the filters can hide them; they have no status.
export function allGroups(data: CostData, dimension: Dimension, group: Grouper): Group[] {
  const totals = new Map<string, Group & { usd: number }>();
  const add = (g: Group, usd: number) => {
    const entry = totals.get(g.key) ?? { ...g, usd: 0 };
    entry.usd += usd;
    totals.set(g.key, entry);
  };
  for (const [stage, config, , usd, status] of data.points) add(group(stage, config, status), usd);
  if (dimension !== "status") for (const [stage, config] of data.unknown) add(group(stage, config), 0);
  return [...totals.values()].sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || b.usd - a.usd || a.label.localeCompare(b.label));
}

// The chart shows the most expensive groups in their own colours and the rest together.
export const MAX_SERIES = 6;
export const OTHER = "\u0000other";

export type CostView = {
  buckets: Bucket[];
  series: Group[]; // the chart's, at most MAX_SERIES + "Other"
  values: number[][]; // per series, per bucket
  rows: (Group & { usd: number })[]; // the table's: every group, the most expensive first
  total: number; // in the range, before filters
  filtered: number; // in the range, after filters
  unknown: number; // the paid calls of unknown cost in the range, after filters
  tests: { usd: number; calls: number }; // the configs' test requests in the range: no filter applies
};

export function costView(data: CostData, range: { start: number; end: number }, granularity: Granularity, split: Split, filters: Filters): CostView {
  const buckets = bucketsOf(range.start, range.end, granularity);
  const tests = (Object.entries(filters) as [Dimension, Filter][])
    .filter(([, f]) => f.hidden.length > 0)
    .map(([dimension, f]) => {
      const group = grouper(data, dimension, f.grouping);
      const hidden = new Set(f.hidden);
      // A call of unknown cost has no status: the call status filter lets it through.
      return (stage: string, config: string, status?: string) => (dimension === "status" && status === undefined) || !hidden.has(group(stage, config, status).key);
    });
  const group: Grouper = split ? grouper(data, split.dimension, split.grouping, split.byName) : () => ({ key: "all", label: "All" });
  const starts = buckets.map((b) => b.start);
  const byGroup = new Map<string, { group: Group; usd: number; values: number[] }>();
  let total = 0;
  let filtered = 0;
  for (const [stage, config, t, usd, status] of data.points) {
    if (t < range.start || t >= range.end) continue;
    total += usd;
    if (!tests.every((test) => test(stage, config, status))) continue;
    filtered += usd;
    const g = group(stage, config, status);
    const entry = byGroup.get(g.key) ?? { group: g, usd: 0, values: buckets.map(() => 0) };
    entry.usd += usd;
    entry.values[bucketIndex(starts, t)] += usd;
    byGroup.set(g.key, entry);
  }
  let unknown = 0;
  for (const [stage, config, t, calls] of data.unknown) {
    if (t >= range.start && t < range.end && tests.every((test) => test(stage, config))) unknown += calls;
  }
  const tested = { usd: 0, calls: 0 };
  for (const [t, usd, calls] of data.tests ?? []) {
    if (t >= range.start && t < range.end) (tested.usd += usd), (tested.calls += calls);
  }
  const sorted = [...byGroup.values()].sort((a, b) => b.usd - a.usd || a.group.label.localeCompare(b.group.label));
  const shown = sorted.length > MAX_SERIES + 1 ? sorted.slice(0, MAX_SERIES) : sorted;
  const rest = sorted.slice(shown.length);
  const series = shown.map((e) => e.group);
  const values = shown.map((e) => e.values);
  if (rest.length) {
    series.push({ key: OTHER, label: `Other (${rest.length})` });
    values.push(buckets.map((_, i) => rest.reduce((sum, e) => sum + e.values[i], 0)));
  }
  if (!split && !series.length) {
    series.push({ key: "all", label: "All" });
    values.push(buckets.map(() => 0));
  }
  return { buckets, series, values, rows: sorted.map((e) => ({ ...e.group, usd: e.usd })), total, filtered, unknown, tests: tested };
}

// The last bucket that starts at or before `t`.
function bucketIndex(starts: number[], t: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// ---- The average cost per page ----

// What transcribing a score costs, everything included (mistakes, re-runs, trying configs), estimated from projects
// the user picks as similar to the next one. The projects of a PDF are one score: their costs add up and each page
// counts once (tries of the same score, or parts of a large PDF, alike). Each score weighs the same, however long: it
// stands for a kind of score, not for its length. Free calls count, at $0. Projects without pages (never rasterized)
// are left out.

export type CostProject = CostData["projects"][number];

// A project's own cost per page, or null without pages.
export const perPage = (p: { costUsd: number; pages: number[] }) => (p.pages.length ? p.costUsd / p.pages.length : null);

export function averagePerPage(projects: CostProject[]): { average: number | null; projects: number } {
  const counted = projects.filter((p) => p.pages.length > 0);
  const scores = new Map<string, { usd: number; pages: Set<number> }>();
  for (const p of counted) {
    const score = scores.get(p.pdfSha256) ?? { usd: 0, pages: new Set<number>() };
    score.usd += p.costUsd;
    for (const page of p.pages) score.pages.add(page);
    scores.set(p.pdfSha256, score);
  }
  const values = [...scores.values()].map((s) => s.usd / s.pages.size);
  return { average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null, projects: counted.length };
}

// The actions of the project list's "⋮": the projects to take out of the selection. "Created more than 30 days ago" (3
// months, 12 months): before this time of day that long ago, not before the start of the time range of that name,
// which counts today as one of its days.
export function createdBefore(projects: { id: string; createdAt: string }[], age: "30d" | "3m" | "12m", now: number): string[] {
  const cutoff = new Date(now);
  if (age === "30d") cutoff.setDate(cutoff.getDate() - 30);
  else cutoff.setMonth(cutoff.getMonth() - (age === "3m" ? 3 : 12));
  return projects.filter((p) => Date.parse(p.createdAt) < cutoff.getTime()).map((p) => p.id);
}

export const unfinished = (projects: CostProject[]) => projects.filter((p) => !p.finished).map((p) => p.id);
