// Runs `layout` (DESIGN.md §6): per page, the straightened page (by the lines of the latest skew stage before it)
// shrunk to the model's limits (by its provider) is sent with the prompt; the answer is drawn on the page and sent back for the model
// to check, at most LAYOUT_ROUNDS answers in all. The last answer is stored as the page's layout; if the model still
// wasn't satisfied, the page is flagged for a person.

import { deskewAngle, DESKEW_VERSION, DRAW_VERSION, ROTATE_VERSION, SCALE_VERSION, type Skew } from "@score3ly/imaging";
import {
  checkLayoutAnswer,
  LAYOUT_FIRST,
  LAYOUT_MAX_OUTPUT_TOKENS,
  LAYOUT_PROMPT_VERSION,
  LAYOUT_ROUNDS,
  LAYOUT_SCHEMA,
  LAYOUT_SYSTEM,
  layoutCheck,
  type LayoutAnswer,
} from "@score3ly/prompts";
import { fetchJsonContent, markUnusable, putContent } from "./api";
import { canonicalJson } from "./keys";
import { LAYOUT_VERSION, layoutNote, layoutStageKey, type PageLayout } from "./layout";
import { ask, imageLimit, modelKey, requestImage, stageModelConfig, type PlannedRequest } from "./llm";
import { drawnPage, modelPage, pageImage, pngSize, type ModelPageRecipe } from "./pageImages";
import { pageOfItem, type PageRecipe } from "./rasterize";
import { CannotStart, runPlan, type StageRun } from "./stageRunner";

// The steps whose lines say how to straighten the pages: the latest before `layout` counts.
const LINE_STEPS = ["skew_analysis", "fix_skew"];

export async function runLayout(run: StageRun): Promise<void> {
  const { stage, pipeline } = run;
  const earlier = pipeline.stages.slice(0, pipeline.stages.findIndex((s) => s.id === stage.id)).reverse();
  const rasterize = earlier.find((s) => s.step === "rasterize");
  if (!rasterize || rasterize.status !== "done") throw new CannotStart("there are no page images: Rasterize hasn't run.");
  const lines = earlier.find((s) => LINE_STEPS.includes(s.step));
  if (lines && lines.status !== "done") throw new CannotStart("the skew analysis hasn't run.");
  const linesByItem = new Map((lines?.outputs ?? []).filter((o) => o.contentSha256).map((o) => [o.item, o]));
  const pages = rasterize.outputs
    .filter((o) => o.type === "page_image" && o.recipe && o.recipeKey)
    .map((o) => ({ output: o, page: pageOfItem(o.item) ?? 0, recipe: o.recipe as PageRecipe, lines: linesByItem.get(o.item) ?? null }))
    .sort((a, b) => a.page - b.page);

  const config = await stageModelConfig(stage.config);
  const imageRecipe = { limit: imageLimit(config), scale: SCALE_VERSION, deskew: DESKEW_VERSION, rotate: ROTATE_VERSION, draw: DRAW_VERSION };
  const stageKey = await layoutStageKey({
    promptVersion: LAYOUT_PROMPT_VERSION,
    model: modelKey(config),
    imageRecipe,
    pages: pages.map((p) => ({ pageImageKey: p.output.recipeKey!, linesSha256: p.lines?.contentSha256 ?? null })),
  });

  let systemCount = 0;
  let flaggedCount = 0;
  await runPlan(run, {
    stepVersion: LAYOUT_VERSION,
    config: { modelConfigId: config.id },
    modelConfigId: config.id,
    stageKey,
    pageCount: pages.length,
    inputIds: pages.flatMap((p) => [p.output.id, ...(p.lines ? [p.lines.id] : [])]),
    note: () => layoutNote(systemCount, pages.length, flaggedCount),
    items: pages.map(({ output, page, recipe, lines: pageLines }) => ({
      item: output.item,
      type: "layout",
      make: async () => {
        // Straightened by the page's lines (§8.4); the decision needs the page's width in pixels.
        const skew = pageLines ? ((await fetchJsonContent(pageLines.contentSha256!)) as Skew) : null;
        // The page image is made for its width only when there are lines to go by.
        const angle = skew && skew.lines.length > 0 ? deskewAngle(skew.lines, (await pngSize((await pageImage(recipe)).png)).width) : null;
        const modelRecipe: ModelPageRecipe = {
          straight: { page: recipe, angle, deskew: DESKEW_VERSION, rotate: ROTATE_VERSION },
          limit: imageRecipe.limit,
          scale: imageRecipe.scale,
        };

        const request: PlannedRequest = {
          system: LAYOUT_SYSTEM,
          messages: [{ role: "user", content: [await requestImage(modelRecipe, modelPage), { type: "text", text: LAYOUT_FIRST }] }],
          maxOutputTokens: LAYOUT_MAX_OUTPUT_TOKENS,
          jsonSchema: LAYOUT_SCHEMA as unknown as Record<string, unknown>,
        };
        let layout: LayoutAnswer | null = null;
        let callId = "";
        let round = 0;
        while (round < LAYOUT_ROUNDS) {
          round++;
          if (layout) {
            request.messages.push({
              role: "user",
              content: [
                await requestImage({ page: modelRecipe, systems: layout.systems, draw: imageRecipe.draw }, drawnPage),
                { type: "text", text: layoutCheck(round) },
              ],
            });
          }
          const answer = await ask(run, request, `Page ${page}`, { config });
          callId = answer.callId;
          const checked = checkLayoutAnswer(answer.json);
          if ("problem" in checked) {
            await markUnusable(run.project, run.stage.id, answer.callId, checked.problem).catch(() => {});
            throw new Error(`Page ${page}: the answer can't be used: ${checked.problem}.`);
          }
          layout = checked;
          request.messages.push({ role: "assistant", content: [{ type: "text", text: answer.text ?? JSON.stringify(answer.json) }] });
          if (round > 1 && layout.satisfied) break;
        }
        const result: PageLayout = {
          angle,
          severelySkewed: layout!.severelySkewed,
          systems: layout!.systems,
          flagged: !(round > 1 && layout!.satisfied),
          note: layout!.note,
          rounds: round,
        };
        systemCount += result.systems.length;
        if (result.flagged) flaggedCount++;
        const contentSha256 = await putContent(new TextEncoder().encode(canonicalJson(result)), "application/json");
        return { contentSha256, inputIds: [output.id, ...(pageLines ? [pageLines.id] : [])], callId };
      },
    })),
  });
}
