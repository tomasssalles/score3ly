// The Statistics page's answers (docs/statistics.md), as the Worker sends them: `GET /api/costs`, `/api/activity`,
// `/api/project-stats`, `/api/failures` and `/api/run-times`.

import type { Effort, Family, Provider } from "./modelConfigs.ts";
import type { CostOutcome, Outcome } from "./outcomes.ts";

// The costs view's data (apps/worker/src/costs.ts): what was paid for, per stage, model config and quarter of an hour,
// with the stages, projects and configs it refers to, and the spending cap's last 24 hours. The paid calls of unknown
// cost are counted the same way.
export type CostData = {
  capUsd: number;
  spentLastDayUsd: number;
  // outcome: the calls' status as the costs view tells them apart
  points: [stageId: string, configId: string, t: number, usd: number, outcome: CostOutcome][];
  unknown: [stageId: string, configId: string, t: number, calls: number][];
  // The configs' test requests, apart from the rest: [start of the quarter of an hour in ms, US dollars, calls].
  tests: [t: number, usd: number, calls: number][];
  stages: { id: string; step: string; projectId: string; inRecipe: boolean; kept: boolean }[];
  // Every project, for the average per page too: whether its pipeline ran to its end, what it cost in all, the pages
  // its `rasterize` stages selected.
  projects: {
    id: string;
    name: string;
    pdfSha256: string;
    pdfFilename: string;
    createdAt: string;
    deletedAt: string | null;
    finished: boolean;
    costUsd: number;
    pages: number[];
  }[];
  configs: {
    id: string;
    name: string | null;
    provider: Provider;
    model: string;
    // The model, whatever the provider (docs/statistics.md): a listed model's id, or "string:" and a model added by hand.
    modelKey: string;
    modelLabel: string;
    family: Family;
    modelName: string | null;
    effort: Effort | null;
    createdAt: string;
    deletedAt: string | null;
  }[];
};

// When the app was in use (apps/worker/src/activity.ts): the quarters of an hour with any activity, per project.
export type ActivityData = {
  quarters: [projectId: string, t: number][];
  projects: { id: string; name: string; createdAt: string; deletedAt: string | null }[];
};

// The Usage tab's projects (apps/worker/src/projectStats.ts): every project, whether it is deleted and whether its
// pipeline is finished now, and the distinct pages processed (rasterized), each page of a PDF once.
export type ProjectStats = {
  projects: { id: string; createdAt: string; deleted: boolean; finished: boolean }[];
  pagesProcessed: number;
};

// The Usage tab's failed calls (apps/worker/src/failures.ts): every call, per model config, quarter of an hour and
// reason ("ok" for one that succeeded), and the configs they were made with.
export type FailureData = {
  points: [configId: string, t: number, reason: Outcome, calls: number][];
  configs: { id: string; name: string | null; model: string; modelKey: string; modelLabel: string; createdAt: string; deletedAt: string | null }[];
};

// The Run times (apps/worker/src/runTimes.ts): the finished projects, the stages created in them that started, with how
// many items of each kind they have, the items of the automatic ones that were timed, and the model configs the stages
// used.
export type RunTimeData = {
  recipe: string[]; // the recipe's steps but Ingest
  // pipeline: the stages of the project's final pipeline, in order
  projects: { id: string; name: string; createdAt: string; deletedAt: string | null; finishedAt: string; pages: number[]; pipeline: string[] }[];
  stages: {
    id: string;
    step: string;
    projectId: string;
    configId: string | null;
    done: boolean;
    manual: boolean; // timed from its creation to its finish
    inRecipe: boolean; // the recipe's, or added by the user
    kept: boolean; // in a pipeline: not replaced or stopped
    replacesStageId: string | null; // a manual stage: the one it replaced by being edited
    activeQuarters: number | null; // a manual stage: its active quarters of an hour (saves, and single gaps between them)
    createdAt: string;
    finishedAt: string | null;
    pageCount: number;
    items: { whole: number; page: number; system: number };
  }[];
  items: [stageId: string, item: string, durationMs: number, calls: number, callsCached: number, images: number, imagesCached: number][];
  configs: { id: string; name: string | null; model: string; modelKey: string; modelLabel: string; createdAt: string; deletedAt: string | null }[];
};
