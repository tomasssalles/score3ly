// Runs `analyze` (docs/stages/analyze.md): every page on its own, one after the other (the page straightened as the layout says,
// then the same page with the layout drawn on it, systems numbered in the whole score and bar lines numbered), then
// one call for the whole score with every page's result and every page drawn, in gray. Where the pieces start is
// derived from its metadata, as an output of its own (what `extract` reads). The whole-score request's
// size is checked before anything is paid for: a score too long for one call stops before its first paid call (a run
// served entirely from the cache makes no images, so it doesn't check).

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
  stavesProblem,
  type ScoreAnswer,
} from "@score3ly/prompts";
import {
  analyzeNote,
  analyzeStageKey,
  ANALYZE_VERSION,
  combineObservations,
  pageItems,
  pageResultsForScore,
  piecesOf,
  type PageAnalysis,
  type StoredPieces,
  type StoredObservations,
} from "./analyze";
import { fetchJsonContent, putJson } from "./api";
import { firstNumbers } from "./fixLayout";
import { modelKeyOf, normalized, pageItem, pageOfItem } from "@score3ly/core";
import type { PageLayout } from "./layout";
import { ask, plannedSizeProblem, requestImage, llmStart, type PlannedRequest, type RequestContent } from "./llm";
import { imageLimit, imageLimitFor } from "./requestLimits";
import { layoutPage, modelPage } from "./pageImages";
import { imageVersions, layoutPageRecipe, modelPageRecipe, straightRecipe, type PageRecipe } from "./recipes";
import { CannotStart, contentsOf, runPlan, type StageRun } from "./stageRunner";

// The steps whose layout `analyze` reads: the latest before it counts.
const LAYOUT_STEPS = ["layout", "fix_layout"];


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
  // Every system by its number, with its number of bar lines and its page: what the answers may name.
  type SystemInfo = { barLines: number; page: number };
  const allSystems = new Map(
    layouts.flatMap((l, i) => l.systems.map((s, j): [number, SystemInfo] => [firsts[i] + j, { barLines: s.barLines.length, page: pages[i].page }])),
  );

  const { config, start } = await llmStart(stage);
  const pageLimit = imageLimit(config);
  const scoreLimit = imageLimitFor(config, pages.length);
  const imageRecipe = { limit: pageLimit, scoreLimit, ...imageVersions("scale", "deskew", "rotate", "draw") };
  const stageKey = await analyzeStageKey({
    promptVersion: ANALYZE_PROMPT_VERSION,
    model: modelKeyOf(config),
    imageRecipe,
    pages: pages.map((p) => ({ pageImageKey: p.image.recipeKey!, layoutSha256: p.output.contentSha256! })),
  });

  const modelRecipe = (i: number, limit = pageLimit) => modelPageRecipe(straightRecipe(pages[i].image.recipe as PageRecipe, layouts[i].angle), limit);
  const drawn = (i: number, limit: typeof pageLimit, gray: boolean) =>
    requestImage(layoutPageRecipe(modelRecipe(i, limit), layouts[i].systems, firsts[i], gray), layoutPage);

  // The whole score's request, without the pages' results (they come at the end).
  const scoreContent: RequestContent[] = [];
  for (const [i, p] of pages.entries()) {
    const systems = labels[i];
    const which = systems.length === 0 ? "no systems" : `systems ${systems[0]}–${systems[systems.length - 1]}`;
    scoreContent.push({ type: "text", text: `Page ${p.page} (${which}):` }, await drawn(i, scoreLimit, true));
  }
  const scoreRequest = (results: PageAnalysis[]): PlannedRequest => ({
    system: ANALYZE_SCORE_SYSTEM,
    messages: [
      {
        role: "user",
        content: [...scoreContent, { type: "text", text: `${ANALYZE_SCORE_TEXT}\n\n${JSON.stringify(pageResultsForScore(results))}` }],
      },
    ],
    maxOutputTokens: ANALYZE_SCORE_MAX_OUTPUT_TOKENS,
    jsonSchema: ANALYZE_SCORE_SCHEMA,
  });
  // Checked before the stage's first call that isn't served from the cache, with its images made.
  let sizeChecked: Promise<void> | null = null;
  const beforeImages = () =>
    (sizeChecked ??= (async () => {
      const tooBig = await plannedSizeProblem(config, scoreRequest([]));
      if (tooBig) {
        throw new Error(
          `The score is too long to analyse as a whole in one call (${tooBig}). Split it into several projects, each with a part of the pages (Rasterize's page selection).`,
        );
      }
    })());

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
  let score: Promise<{ answer: ScoreAnswer; callId: string; observations: StoredObservations }> | null = null;
  const scoreAnswer = () =>
    (score ??= (async () => {
      const all = await Promise.all(pages.map((p) => resultOf(p.output.item)));
      const check = (json: unknown) => {
        const checked = checkScoreAnswer(json, { systems: allSystems, pages: pages.map((p) => p.page), items: pageItems(all) });
        if ("problem" in checked) return checked;
        // The pages as corrected: their staves must still agree.
        const observations = combineObservations(all, checked);
        const staves = observations.pages
          .map((p) => stavesProblem(p, all.find((r) => r.page === p.page)!.systems))
          .map((problem, i) => problem && `page ${observations.pages[i].page}: ${problem}`)
          .find((problem) => problem);
        return staves ? { problem: staves } : { answer: checked, observations };
      };
      const { answer, checked } = await ask(run, scoreRequest(all), "The whole score", { config, place: { item: "", round: 1 }, beforeImages, check });
      return { ...checked, callId: answer.callId };
    })());

  const pageInputs = (i: number): string[] => [pages[i].output.id, pages[i].image.id];
  const madePieces = new Map<string, StoredPieces>();
  await runPlan(run, {
    stepVersion: ANALYZE_VERSION,
    ...start,
    stageKey,
    pageCount: pages.length,
    inputIds: pages.flatMap((_, i) => pageInputs(i)),
    // The pieces as stored (piecesOf: system 1 added, duplicates merged), whichever run made them.
    note: async (outputs) => analyzeNote(pages.length, (await contentsOf(outputs, "pieces", madePieces))[0]?.length ?? 0),
    items: [
      ...pages.map(({ output, page }, i) => ({
        item: output.item,
        type: "analysis",
        make: async () => {
          const request: PlannedRequest = {
            system: ANALYZE_PAGE_SYSTEM,
            messages: [
              {
                role: "user",
                content: [
                  await requestImage(modelRecipe(i), modelPage),
                  await drawn(i, pageLimit, false),
                  { type: "text", text: analyzePageText(page, labels[i]) },
                ],
              },
            ],
            maxOutputTokens: ANALYZE_PAGE_MAX_OUTPUT_TOKENS,
            jsonSchema: ANALYZE_PAGE_SCHEMA,
          };
          const onPage = new Map(labels[i].map((n) => [n, allSystems.get(n)!]));
          const check = (json: unknown) => checkPageAnswer(json, { systems: onPage });
          const { answer, checked } = await ask(run, request, `Page ${page}`, { config, place: { item: pageItem(page), round: 1 }, beforeImages, check });
          // As it reads back from storage (canonical JSON), so the whole score's request is the same whether a page's
          // result was made in this run or an earlier one, and the cache finds it.
          const result = normalized({ page, systems: labels[i], ...checked }) as PageAnalysis;
          results.set(output.item, result);
          const contentSha256 = await putJson(result);
          return { contentSha256, inputIds: pageInputs(i), callId: answer.callId };
        },
      })),
      {
        item: "",
        type: "metadata",
        make: async () => {
          const { answer, callId } = await scoreAnswer();
          return { contentSha256: await putJson(answer.metadata), callId };
        },
      },
      {
        item: "",
        type: "observations",
        make: async () => {
          const { callId, observations: stored } = await scoreAnswer();
          return { contentSha256: await putJson(stored), callId };
        },
      },
      {
        item: "",
        type: "pieces",
        make: async () => {
          const { answer, callId } = await scoreAnswer();
          const pieces = piecesOf(answer.metadata);
          madePieces.set("", pieces);
          return { contentSha256: await putJson(pieces), callId };
        },
      },
    ],
  });
}

