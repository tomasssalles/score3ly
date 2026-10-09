// Mock data and a simulation of running it, to design the pipeline view before the real stages exist
// (DESIGN.md §5.6). Nothing here is stored: a reload starts over. Remove once the stages are real.

import type { Project } from "./api";
import type { Output, Pipeline, Stage, StageKind } from "./pipeline";

type Template = Omit<Stage, "status" | "progress" | "outputs"> & {
  outputs: Omit<Output, "id">[];
  result: { seconds: number; cost?: number; note?: string }; // what a run "produces"
};

const OPUS = "Claude Opus 5.5";
const LLM_CONFIG = { Model: OPUS, Effort: "high", Key: "ANTHROPIC_API_KEY" };

function template(
  id: string,
  title: string,
  kind: StageKind,
  outputs: Omit<Output, "id">[],
  result: Template["result"],
  extra: Partial<Template> = {},
): Template {
  return {
    id,
    step: `${id}@1`,
    title,
    kind,
    outputs,
    result,
    config: kind === "llm" ? LLM_CONFIG : {},
    fixes: [],
    model: kind === "llm" ? OPUS : undefined,
    ...extra,
  };
}

const PAGES = 12;
const SYSTEMS = 54;

// The planned stages (DESIGN.md §6), as a recipe.
const RECIPE: Template[] = [
  template("ingest", "Ingest", "computed", [{ title: "Original PDF", kind: "pdf", count: 1 }], { seconds: 2 }),
  template(
    "page_images",
    "Page images",
    "computed",
    [{ title: "Page images", kind: "images", count: PAGES, item: "Page" }],
    { seconds: 14, note: `${PAGES} pages` },
    { config: { Resolution: "300 dpi" } },
  ),
  template(
    "preprocess",
    "Preprocessing",
    "computed",
    [{ title: "Preprocessed pages", kind: "images", count: PAGES, item: "Page" }],
    { seconds: 9, note: "Deskewed, colour kept" },
    { config: { Deskew: "on", Contrast: "auto", Binarize: "off" }, fixes: ["Fix deskewing angles"] },
  ),
  template(
    "analysis",
    "Global analysis",
    "llm",
    [
      { title: "System boxes", kind: "images", count: PAGES, item: "Page" },
      { title: "Metadata", kind: "json", count: 1 },
      { title: "Structure", kind: "json", count: 1 },
    ],
    { seconds: 192, cost: 0.38, note: `${SYSTEMS} systems` },
    { fixes: ["Fix system boxes", "Fix metadata"] },
  ),
  template(
    "system_crops",
    "System crops",
    "computed",
    [{ title: "System crops", kind: "images", count: SYSTEMS, item: "System" }],
    { seconds: 6 },
    { fixes: ["Fix system crops"] },
  ),
  template("skeleton", "Score skeleton", "computed", [{ title: "Skeleton", kind: "lilypond", count: 1 }], {
    seconds: 1,
  }),
  template(
    "transcription",
    "Transcription",
    "llm",
    [
      { title: "Transcriptions", kind: "lilypond", count: SYSTEMS, item: "System" },
      { title: "Uncertainties", kind: "json", count: 1 },
    ],
    { seconds: 1480, cost: 2.14, note: "7 uncertain spots" },
    { fixes: ["Fix musical content"] },
  ),
  template("checks", "Structural checks", "computed", [{ title: "Check results", kind: "json", count: 1 }], {
    seconds: 3,
    note: "2 problems",
  }),
  template("review", "Review", "llm", [{ title: "Findings", kind: "json", count: 1 }], {
    seconds: 960,
    cost: 1.27,
    note: "11 findings",
  }),
  template(
    "fix",
    "Fix",
    "llm",
    [{ title: "Revised transcriptions", kind: "lilypond", count: SYSTEMS, item: "System" }],
    { seconds: 610, cost: 0.83 },
    { fixes: ["Fix musical content"] },
  ),
  template("assembly", "Assembly", "computed", [{ title: "Score", kind: "lilypond", count: 1 }], { seconds: 2 }),
];

// The manual stages, by title: what each one corrects.
const FIXES: Record<string, Omit<Output, "id">> = {
  "Fix deskewing angles": { title: "Corrected pages", kind: "images", count: PAGES, item: "Page" },
  "Fix system boxes": { title: "Corrected boxes", kind: "images", count: PAGES, item: "Page" },
  "Fix metadata": { title: "Corrected metadata", kind: "json", count: 1 },
  "Fix system crops": { title: "Corrected crops", kind: "images", count: SYSTEMS, item: "System" },
  "Fix musical content": { title: "Corrected transcriptions", kind: "lilypond", count: SYSTEMS, item: "System" },
};

const RESULTS = new Map<string, Template["result"]>(RECIPE.map((t) => [t.id, t.result]));

function stageFrom(t: Template, done: boolean): Stage {
  const { result, outputs, ...rest } = t;
  const stage: Stage = {
    ...rest,
    status: done ? "done" : "planned",
    progress: 0,
    outputs: outputs.map((output) => ({ ...output, id: `${t.id}.${slug(output.title)}` })),
  };
  return done ? withResult(stage) : stage;
}

function withResult(stage: Stage): Stage {
  const result = RESULTS.get(stage.id);
  return { ...stage, status: "done", progress: 0, error: undefined, ...result };
}

function slug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

// A project that has run up to the transcription, with the system boxes fixed by hand.
export function mockPipeline(project: Project): Pipeline {
  const stages = RECIPE.map((t, i) => stageFrom(t, i < 6));
  stages[0] = { ...stages[0], note: project.pdfFilename };
  const fix = manualStage("Fix system boxes", "fix-1");
  stages.splice(4, 0, { ...fix, status: "done", note: "3 boxes moved, 1 added" });
  stages[7] = { ...stages[7], status: "ready" };
  return { mode: "auto", stages };
}

function manualStage(title: string, id: string): Stage {
  return {
    id,
    step: `${slug(title).replace(/-/g, "_")}@1`,
    title,
    kind: "manual",
    status: "wip",
    progress: 0,
    outputs: [{ ...FIXES[title], id: `${id}.${slug(FIXES[title].title)}` }],
    config: {},
    fixes: [],
  };
}

function update(pipeline: Pipeline, stages: Stage[]): Pipeline {
  return { ...pipeline, stages };
}

// Starts the stage where the pipeline is, if it can run.
export function start(pipeline: Pipeline): Pipeline {
  return update(
    pipeline,
    pipeline.stages.map((stage, i) =>
      i === currentIndex(pipeline) && (stage.status === "ready" || stage.status === "failed")
        ? { ...stage, status: "running", progress: 0, error: undefined }
        : stage,
    ),
  );
}

// Stops the running stage. What it did so far is lost; it can be run again.
export function stop(pipeline: Pipeline): Pipeline {
  return update(
    pipeline,
    pipeline.stages.map((stage) => (stage.status === "running" ? { ...stage, status: "ready", progress: 0 } : stage)),
  );
}

export function fail(pipeline: Pipeline): Pipeline {
  return update(
    pipeline,
    pipeline.stages.map((stage) =>
      stage.status === "running"
        ? { ...stage, status: "failed", progress: 0, error: "The model's answer for system 23 didn't match the schema." }
        : stage,
    ),
  );
}

// Moves the running stage forward by `fraction` of its work. When it is done, the next stage gets its turn,
// and in Auto mode it starts.
export function advance(pipeline: Pipeline, fraction: number): Pipeline {
  const i = pipeline.stages.findIndex((stage) => stage.status === "running");
  if (i < 0) return pipeline;
  const stage = pipeline.stages[i];
  if (stage.progress + fraction < 1) {
    return update(pipeline, replaceAt(pipeline.stages, i, { ...stage, progress: stage.progress + fraction }));
  }
  return next(update(pipeline, replaceAt(pipeline.stages, i, withResult(stage))), i);
}

// A manual stage is finished: the pipeline goes on, by itself in Auto mode.
export function finish(pipeline: Pipeline, stageId: string): Pipeline {
  const i = pipeline.stages.findIndex((stage) => stage.id === stageId);
  const stage = pipeline.stages[i];
  if (stage?.status !== "wip") return pipeline;
  return next(update(pipeline, replaceAt(pipeline.stages, i, { ...stage, status: "done", note: stage.note ?? "Edited" })), i);
}

// Gives the stage after `i` its turn.
function next(pipeline: Pipeline, i: number): Pipeline {
  const following = pipeline.stages[i + 1];
  if (following?.status !== "planned") return pipeline;
  const ready = update(pipeline, replaceAt(pipeline.stages, i + 1, { ...following, status: "ready" }));
  return pipeline.mode === "auto" ? start(ready) : ready;
}

// Whether changing stage `stageId` replaces stages that have already run, which needs the user's confirmation.
export function replacesWork(pipeline: Pipeline, stageId: string): boolean {
  const i = pipeline.stages.findIndex((stage) => stage.id === stageId);
  return pipeline.stages.slice(i + 1).some((stage) => stage.status !== "planned" && stage.status !== "ready");
}

// The stages after `i` are replaced: they wait for their turn again. Manual stages are dropped (in the real app,
// only those whose input changed, DESIGN.md §5.5).
function resetAfter(stages: Stage[], i: number): Stage[] {
  const later = stages
    .slice(i + 1)
    .filter((stage) => stage.kind !== "manual")
    .map((stage): Stage => ({
      ...stage,
      status: "planned",
      progress: 0,
      seconds: undefined,
      cost: undefined,
      note: undefined,
      error: undefined,
    }));
  return [...stages.slice(0, i + 1), ...later];
}

// Runs a stage again, with a changed config. In Manual mode it waits for its Run button.
export function rerun(pipeline: Pipeline, stageId: string, run: boolean): Pipeline {
  const i = pipeline.stages.findIndex((stage) => stage.id === stageId);
  if (i < 0) return pipeline;
  const stages = resetAfter(pipeline.stages, i);
  stages[i] = { ...stages[i], status: "ready", progress: 0, seconds: undefined, cost: undefined, error: undefined };
  const ready = update(pipeline, stages);
  return run ? start(ready) : ready;
}

// Adds a manual stage after a stage, for the user to work on.
export function addFix(pipeline: Pipeline, afterId: string, title: string): Pipeline {
  const i = pipeline.stages.findIndex((stage) => stage.id === afterId);
  if (i < 0) return pipeline;
  const used = new Set(pipeline.stages.map((stage) => stage.id));
  let n = 1;
  while (used.has(`fix-${n}`)) n++;
  const stages = resetAfter(pipeline.stages, i);
  stages.splice(i + 1, 0, manualStage(title, `fix-${n}`));
  return update(pipeline, stages);
}

// Opens a finished manual stage again, where the user left it.
export function edit(pipeline: Pipeline, stageId: string): Pipeline {
  const i = pipeline.stages.findIndex((stage) => stage.id === stageId);
  if (pipeline.stages[i]?.kind !== "manual") return pipeline;
  const stages = resetAfter(pipeline.stages, i);
  stages[i] = { ...stages[i], status: "wip" };
  return update(pipeline, stages);
}

// Whether a stage can be dropped: only stages that aren't part of the recipe (DESIGN.md §5.5). In the mock,
// those are the manual ones.
export function canDrop(stage: Stage): boolean {
  return stage.kind === "manual";
}

// Removes a stage, finished or not. The pipeline continues from the stage before it: the stages after it are
// replaced, and the first of them gets its turn.
export function drop(pipeline: Pipeline, stageId: string): Pipeline {
  const i = pipeline.stages.findIndex((stage) => stage.id === stageId);
  if (i < 0 || !canDrop(pipeline.stages[i])) return pipeline;
  const stages = resetAfter(
    pipeline.stages.filter((stage) => stage.id !== stageId),
    i - 1,
  );
  return next(update(pipeline, stages), i - 1);
}

export function setMode(pipeline: Pipeline, mode: Pipeline["mode"]): Pipeline {
  return { ...pipeline, mode };
}

function currentIndex(pipeline: Pipeline): number {
  return pipeline.stages.findIndex((stage) => stage.status !== "done");
}

function replaceAt<T>(list: T[], i: number, value: T): T[] {
  return list.map((item, j) => (j === i ? value : item));
}
