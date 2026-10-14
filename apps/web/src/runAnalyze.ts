// Runs `analyze` (DESIGN.md §6): every page on its own, one after the other (the page straightened as the layout says,
// then the same page with the layout drawn on it, systems numbered in the whole score and bar lines numbered), then
// one call for the whole score with every page's result and every page drawn, in gray. The whole-score request's
// size is checked before anything is paid for: a score too long for one call stops before its first page.

import { DESKEW_VERSION, DRAW_VERSION, ROTATE_VERSION, SCALE_VERSION } from "@score3ly/imaging";
import {
  ANALYZE_PAGE_MAX_OUTPUT_TOKENS,
  ANALYZE_PAGE_SCHEMA,
  ANALYZE_PAGE_SYSTEM,
  ANALYZE_PROMPT_VERSION,
  ANALYZE_SCORE_MAX_OUTPUT_TOKENS,
  ANALYZE_SCORE_SCHEMA,
  ANALYZE_SCORE_SYSTEM,
  ANALYZE_SCORE_TEXT,
  analyzePageText,
  checkPageAnswer,
  checkScoreAnswer,
  type ScoreAnswer,
} from "@score3ly/prompts";
import {
  analyzeNote,
  analyzeStageKey,
  ANALYZE_VERSION,
  pageResultsForScore,
  type PageAnalysis,
  type StoredObservations,
} from "./analyze";
import { fetchJsonContent, markUnusable, putContent, type LlmContent, type LlmRequest } from "./api";
import { firstNumbers } from "./fixLayout";
import { canonicalJson } from "./keys";
import type { PageLayout } from "./layout";
import { ask, imageLimit, imageLimitFor, modelKey, pngContent, requestSizeProblem, stageModelConfig } from "./llm";
import { layoutPage, modelPage, type ModelPageRecipe } from "./pageImages";
import { pageOfItem, type PageRecipe } from "./rasterize";
import { CannotStart, runPlan, type StageRun } from "./stageRunner";

// The steps whose layout `analyze` reads: the latest before it counts.
const LAYOUT_STEPS = ["layout", "fix_layout"];

const json = (value: unknown) => new TextEncoder().encode(canonicalJson(value));

export async function runAnalyze(run: StageRun): Promise<void> {
  const { stage, pipeline } = run;
  const earlier = pipeline.stages.slice(0, pipeline.stages.findIndex((s) => s.id === stage.id)).reverse();
  const rasterize = earlier.find((s) => s.step === "rasterize");
  if (!rasterize || rasterize.status !== "done") throw new CannotStart("there are no page images: Rasterize hasn't run.");
  const layoutStage = earlier.find((s) => LAYOUT_STEPS.includes(s.step));
  if (!layoutStage || layoutStage.status !== "done") throw new CannotStart("the layout hasn't been found yet.");
  const images = new Map(rasterize.outputs.filter((o) => o.type === "page_image").map((o) => [o.item, o]));
  const pages = layoutStage.outputs
    .filter((o) => o.type === "layout" && o.contentSha256 && images.get(o.item)?.recipe)
    .map((o) => ({ output: o, image: images.get(o.item)!, page: pageOfItem(o.item) ?? 0 }))
    .sort((a, b) => a.page - b.page);
  if (pages.length === 0) throw new CannotStart("the layout has no pages.");
  const layouts = await Promise.all(pages.map((p) => fetchJsonContent(p.output.contentSha256!) as Promise<PageLayout>));
  const firsts = firstNumbers(layouts.map((l) => l.systems.length));
  const labels = layouts.map((l, i) => l.systems.map((_, j) => firsts[i] + j));
  // Every system by its number, with its number of bar lines: what the answers may name.
  const allSystems = new Map(layouts.flatMap((l, i) => l.systems.map((s, j): [number, number] => [firsts[i] + j, s.barLines.length])));

  const config = await stageModelConfig(stage.config);
  const pageLimit = imageLimit(config);
  const scoreLimit = imageLimitFor(config, pages.length);
  const imageRecipe = { limit: pageLimit, scoreLimit, scale: SCALE_VERSION, deskew: DESKEW_VERSION, rotate: ROTATE_VERSION, draw: DRAW_VERSION };
  const stageKey = await analyzeStageKey({
    promptVersion: ANALYZE_PROMPT_VERSION,
    model: modelKey(config),
    imageRecipe,
    pages: pages.map((p) => ({ pageImageKey: p.image.recipeKey!, layoutSha256: p.output.contentSha256! })),
  });

  const modelRecipe = (i: number, limit = pageLimit): ModelPageRecipe => ({
    straight: { page: pages[i].image.recipe as PageRecipe, angle: layouts[i].angle, deskew: DESKEW_VERSION, rotate: ROTATE_VERSION },
    limit,
    scale: SCALE_VERSION,
  });
  const drawn = (i: number, limit: typeof pageLimit, gray: boolean) =>
    layoutPage({ page: modelRecipe(i, limit), systems: layouts[i].systems, first: firsts[i], barLineNumbers: true, gray, draw: DRAW_VERSION });

  // The whole score's request, without the pages' results (they come at the end): its images are ready, and it can
  // be checked for size before anything is paid for.
  const scoreContent: LlmContent[] = [];
  for (const [i, p] of pages.entries()) {
    const systems = labels[i];
    const which = systems.length === 0 ? "no systems" : `systems ${systems[0]}–${systems[systems.length - 1]}`;
    scoreContent.push({ type: "text", text: `Page ${p.page} (${which}):` }, await pngContent(await drawn(i, scoreLimit, true)));
  }
  const scoreRequest = (results: PageAnalysis[]): LlmRequest => ({
    system: ANALYZE_SCORE_SYSTEM,
    messages: [
      {
        role: "user",
        content: [...scoreContent, { type: "text", text: `${ANALYZE_SCORE_TEXT}\n\n${JSON.stringify(pageResultsForScore(results))}` }],
      },
    ],
    maxOutputTokens: ANALYZE_SCORE_MAX_OUTPUT_TOKENS,
    jsonSchema: ANALYZE_SCORE_SCHEMA as unknown as Record<string, unknown>,
  });
  const tooBig = requestSizeProblem(config, scoreRequest([]));
  if (tooBig) {
    throw new CannotStart(
      `the score is too long to analyse as a whole in one call (${tooBig}). Split it into several projects, each with a part of the pages (Rasterize's page selection).`,
    );
  }

  // Each page's result: made in this run, or recorded by an earlier one that failed.
  const results = new Map<string, PageAnalysis>();
  const recorded = new Map(stage.outputs.filter((o) => o.type === "analysis").map((o) => [o.item, o]));
  async function resultOf(item: string): Promise<PageAnalysis> {
    const made = results.get(item);
    if (made) return made;
    const output = recorded.get(item);
    if (!output?.contentSha256) throw new Error(`The analysis of ${item} is missing.`);
    return (await fetchJsonContent(output.contentSha256)) as PageAnalysis;
  }

  // The whole-score call, once for both of its outputs. A retry that recorded one asks again, served from the cache.
  let score: Promise<{ answer: ScoreAnswer; callId: string }> | null = null;
  const scoreAnswer = () =>
    (score ??= (async () => {
      const all = await Promise.all(pages.map((p) => resultOf(p.output.item)));
      const answer = await ask(run, scoreRequest(all), "The whole score");
      const checked = checkScoreAnswer(answer.json, { systems: allSystems, pages: pages.map((p) => p.page) });
      if ("problem" in checked) {
        await markUnusable(run.project, run.stage.id, answer.callId, checked.problem).catch(() => {});
        throw new Error(`The whole score: the answer can't be used: ${checked.problem}.`);
      }
      return { answer: checked, callId: answer.callId };
    })());

  const pageInputs = (i: number): string[] => [pages[i].output.id, pages[i].image.id];
  let pieces = 0;
  await runPlan(run, {
    stepVersion: ANALYZE_VERSION,
    config: { modelConfigId: config.id },
    modelConfigId: config.id,
    stageKey,
    pageCount: pages.length,
    inputIds: pages.flatMap((_, i) => pageInputs(i)),
    note: () => analyzeNote(pages.length, pieces),
    items: [
      ...pages.map(({ output, page }, i) => ({
        item: output.item,
        type: "analysis",
        make: async () => {
          const request: LlmRequest = {
            system: ANALYZE_PAGE_SYSTEM,
            messages: [
              {
                role: "user",
                content: [
                  await pngContent(await modelPage(modelRecipe(i))),
                  await pngContent(await drawn(i, pageLimit, false)),
                  { type: "text", text: analyzePageText(page, labels[i]) },
                ],
              },
            ],
            maxOutputTokens: ANALYZE_PAGE_MAX_OUTPUT_TOKENS,
            jsonSchema: ANALYZE_PAGE_SCHEMA as unknown as Record<string, unknown>,
          };
          const tooBig = requestSizeProblem(config, request);
          if (tooBig) throw new Error(`Page ${page}: ${tooBig}.`);
          const answer = await ask(run, request, `Page ${page}`);
          const onPage = new Map(labels[i].map((n) => [n, allSystems.get(n)!]));
          const checked = checkPageAnswer(answer.json, { systems: onPage });
          if ("problem" in checked) {
            await markUnusable(run.project, run.stage.id, answer.callId, checked.problem).catch(() => {});
            throw new Error(`Page ${page}: the answer can't be used: ${checked.problem}.`);
          }
          const result: PageAnalysis = { page, systems: labels[i], ...checked };
          results.set(output.item, result);
          const contentSha256 = await putContent(json(result), "application/json");
          return { contentSha256, inputIds: pageInputs(i), callId: answer.callId };
        },
      })),
      {
        item: "",
        type: "metadata",
        make: async () => {
          const { answer, callId } = await scoreAnswer();
          pieces = answer.metadata.pieces.length;
          return { contentSha256: await putContent(json(answer.metadata), "application/json"), callId };
        },
      },
      {
        item: "",
        type: "observations",
        make: async () => {
          const { answer, callId } = await scoreAnswer();
          pieces = answer.metadata.pieces.length;
          const all = await Promise.all(pages.map((p) => resultOf(p.output.item)));
          const stored: StoredObservations = {
            score: answer.observations,
            pages: all.map((r) => ({ page: r.page, ...r.observations })),
          };
          return { contentSha256: await putContent(json(stored), "application/json"), callId };
        },
      },
    ],
  });
}

