// Runs `layout` (docs/stages/layout.md): per page, the straightened page (by the lines of the latest skew stage before it)
// shrunk to the model's limits (by its provider) is sent with the prompt; the answer is drawn on the page and sent back for the model
// to check, at most LAYOUT_ROUNDS answers in all. The last answer is stored as the page's layout; if the model still
// wasn't satisfied, the page is flagged for a person.

import { deskewAngle } from "@score3ly/imaging";
import type { PageLines } from "./fixSkew";
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
import { fetchJsonContent, putJson } from "./api";
import { modelKeyOf, pageOfItem } from "@score3ly/core";
import { LAYOUT_VERSION, layoutNote, layoutStageKey, type PageLayout } from "./layout";
import { ask, requestImage, llmStart, type PlannedRequest } from "./llm";
import { imageLimit } from "./requestLimits";
import { drawnPage, modelPage, pageImage, pngSize } from "./pageImages";
import { drawnPageRecipe, imageVersions, modelPageRecipe, straightRecipe, type PageRecipe } from "./recipes";
import { CannotStart, contentsOf, runPlan, type StageRun } from "./stageRunner";

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

  const { config, stageConfig, start } = await llmStart(stage);
  const imageRecipe = { limit: imageLimit(config), ...imageVersions("scale", "deskew", "rotate", "draw") };
  const stageKey = await layoutStageKey({
    config: stageConfig,
    promptVersion: LAYOUT_PROMPT_VERSION,
    model: modelKeyOf(config),
    imageRecipe,
    pages: pages.map((p) => ({ pageImageKey: p.output.recipeKey!, linesSha256: p.lines?.contentSha256 ?? null })),
  });

  const made = new Map<string, PageLayout>();
  await runPlan(run, {
    stepVersion: LAYOUT_VERSION,
    ...start,
    stageKey,
    pageCount: pages.length,
    inputIds: pages.flatMap((p) => [p.output.id, ...(p.lines ? [p.lines.id] : [])]),
    note: async (outputs) => {
      const layouts = await contentsOf(outputs, "layout", made);
      const systems = layouts.reduce((sum, l) => sum + l.systems.length, 0);
      return layoutNote(systems, pages.length, layouts.filter((l) => l.flagged).length);
    },
    items: pages.map(({ output, page, recipe, lines: pageLines }) => ({
      item: output.item,
      type: "layout",
      make: async () => {
        // Straightened by the page's lines (§8.4); the decision needs the page's width in pixels.
        const skew = pageLines ? ((await fetchJsonContent(pageLines.contentSha256!)) as PageLines) : null;
        // The page image is made for its width only when there are lines to go by.
        const angle = skew && skew.lines.length > 0 ? deskewAngle(skew.lines, (await pngSize(await pageImage(recipe))).width) : null;
        const modelRecipe = modelPageRecipe(straightRecipe(recipe, angle), imageRecipe.limit);

        const request: PlannedRequest = {
          system: LAYOUT_SYSTEM,
          messages: [{ role: "user", content: [await requestImage(modelRecipe, modelPage), { type: "text", text: LAYOUT_FIRST }] }],
          maxOutputTokens: LAYOUT_MAX_OUTPUT_TOKENS,
          jsonSchema: LAYOUT_SCHEMA,
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
                await requestImage(drawnPageRecipe(modelRecipe, layout.systems), drawnPage),
                { type: "text", text: layoutCheck(round) },
              ],
            });
          }
          const { answer, checked } = await ask(run, request, `Page ${page}`, { config, place: { item: output.item, round }, check: checkLayoutAnswer });
          callId = answer.callId;
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
        made.set(output.item, result);
        const contentSha256 = await putJson(result);
        return { contentSha256, inputIds: [output.id, ...(pageLines ? [pageLines.id] : [])], callId };
      },
    })),
  });
}
