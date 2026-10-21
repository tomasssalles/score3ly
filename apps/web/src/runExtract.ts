// Runs `extract` (DESIGN.md §6): one call per system, one after the other in the score's order, since each system
// starts from what the one before it left (the piece's staves and voices, the signatures, the marks left open, a
// measure that continues). Each call gets the system's crop, a crop of each of its stretches, the previous and the next
// system (not across a piece's boundary), and the request; each answer is checked as soon as it arrives. One that
// can't be used stops the run there: the answers so far are kept, and a retry starts again at that system. Once every
// system is in, the checks of the whole score run on all of them, and what they find is one more output.

import { CROP_VERSION, DESKEW_VERSION, ROTATE_VERSION, SCALE_VERSION } from "@score3ly/imaging";
import { checkScore, checkSystem, LENS_VERSION, pieceStart, type ScoreState } from "@score3ly/notation";
import { EXTRACT_MAX_OUTPUT_TOKENS, EXTRACT_PROMPT_VERSION, EXTRACT_SCHEMA, EXTRACT_SYSTEM, extractImageLabels, extractText } from "@score3ly/prompts";
import type { StoredObservations, StoredPieces } from "./analyze";
import { fetchJsonContent, markUnusable, putContent, reserveIssueNumbers, type LlmContent, type LlmRequest } from "./api";
import {
  EXTRACT_VERSION,
  extractNote,
  extractRequest,
  extractStageKey,
  MARGINS,
  pieceBounds,
  stretchBox,
  stretchCropBoxes,
  storedExtraction,
  storedScoreChecks,
  systemCropBox,
  type StoredScoreChecks,
  type ImageSource,
  type ScoreSystem,
  type StoredExtraction,
} from "./extract";
import { firstNumbers } from "./fixLayout";
import { canonicalJson } from "./keys";
import type { PageLayout } from "./layout";
import { linkSpans, systemHints } from "./linking";
import { ask, imageLimit, imageLimitFor, modelKey, pngContent, requestLimits, requestSizeProblem, stageModelConfig } from "./llm";
import { cropImage, type StraightRecipe } from "./pageImages";
import { pageOfItem, type PageRecipe } from "./rasterize";
import { CannotStart, runPlan, type StageRun } from "./stageRunner";

const LAYOUT_STEPS = ["layout", "fix_layout"];
const OBSERVATION_STEPS = ["fix_observations", "analyze"];
const PIECE_STEPS = ["fix_metadata", "analyze"];

const json = (value: unknown) => new TextEncoder().encode(canonicalJson(value));

export async function runExtract(run: StageRun): Promise<void> {
  const { stage, pipeline } = run;
  const earlier = pipeline.stages.slice(0, pipeline.stages.findIndex((s) => s.id === stage.id)).reverse();
  const rasterize = earlier.find((s) => s.step === "rasterize");
  if (!rasterize || rasterize.status !== "done") throw new CannotStart("there are no page images: Rasterize hasn't run.");
  const layoutStage = earlier.find((s) => LAYOUT_STEPS.includes(s.step));
  if (!layoutStage || layoutStage.status !== "done") throw new CannotStart("the layout hasn't been found yet.");
  // The latest observations and pieces: a fix's, else analyze's (a WIP fix must be finished first).
  const latest = (steps: string[], type: string) => {
    const s = earlier.find((x) => steps.includes(x.step) && x.outputs.some((o) => o.item === "" && o.type === type));
    return s ? { stage: s, output: s.outputs.find((o) => o.item === "" && o.type === type && o.contentSha256)! } : null;
  };
  const obs = latest(OBSERVATION_STEPS, "observations");
  const pcs = latest(PIECE_STEPS, "pieces");
  if (!obs || !pcs) throw new CannotStart("the score hasn't been analysed yet.");
  if (obs.stage.status !== "done" || pcs.stage.status !== "done") throw new CannotStart("a fix of the analysis isn't finished yet.");

  const images = new Map(rasterize.outputs.filter((o) => o.type === "page_image").map((o) => [o.item, o]));
  const pages = layoutStage.outputs
    .filter((o) => o.type === "layout" && o.contentSha256 && images.get(o.item)?.recipe)
    .map((o) => ({ output: o, image: images.get(o.item)!, page: pageOfItem(o.item) ?? 0 }))
    .sort((a, b) => a.page - b.page);
  const [layouts, observations, pieces] = await Promise.all([
    Promise.all(pages.map((p) => fetchJsonContent(p.output.contentSha256!) as Promise<PageLayout>)),
    fetchJsonContent(obs.output.contentSha256!) as Promise<StoredObservations>,
    fetchJsonContent(pcs.output.contentSha256!) as Promise<StoredPieces>,
  ]);
  const firsts = firstNumbers(layouts.map((l) => l.systems.length));
  const systems: (ScoreSystem & { pageIndex: number })[] = layouts.flatMap((l, i) =>
    l.systems.map((s, j) => ({ number: firsts[i] + j, page: pages[i].page, item: `p${pages[i].page}/s${j + 1}`, layout: s, pageIndex: i })),
  );
  if (systems.length === 0) throw new CannotStart("the layout has no systems.");
  const byNumber = new Map(systems.map((s) => [s.number, s]));
  const lastSystem = systems[systems.length - 1].number;

  const config = await stageModelConfig(stage.config);
  const imageRecipe = {
    limit: imageLimit(config),
    manyImages: requestLimits(config).manyImages,
    scale: SCALE_VERSION,
    crop: CROP_VERSION,
    deskew: DESKEW_VERSION,
    rotate: ROTATE_VERSION,
    margins: MARGINS,
  };
  const stageKey = await extractStageKey({
    promptVersion: EXTRACT_PROMPT_VERSION,
    lensVersion: LENS_VERSION,
    model: modelKey(config),
    imageRecipe,
    pages: pages.map((p) => ({ pageImageKey: p.image.recipeKey!, layoutSha256: p.output.contentSha256! })),
    observationsSha256: obs.output.contentSha256!,
    piecesSha256: pcs.output.contentSha256!,
  });

  const straight = (i: number): StraightRecipe => ({ page: pages[i].image.recipe as PageRecipe, angle: layouts[i].angle, deskew: DESKEW_VERSION, rotate: ROTATE_VERSION });
  const spans = linkSpans(observations, (page) => systems.filter((s) => s.page === page).map((s) => s.number));
  const placeBox = (p: { system: number; stretch: number }) => {
    const s = byNumber.get(p.system);
    return s ? { page: s.page, box: stretchBox(s.layout, p.stretch) } : null;
  };

  // Systems a failed run already recorded: loaded now, for the counts and for the state the next system starts from.
  const recorded = new Map(stage.outputs.filter((o) => o.type === "extraction" && o.contentSha256).map((o) => [o.item, o]));
  const stored = new Map<number, StoredExtraction>();
  await Promise.all(
    systems
      .filter((s) => recorded.has(s.item))
      .map(async (s) => stored.set(s.number, (await fetchJsonContent(recorded.get(s.item)!.contentSha256!)) as StoredExtraction)),
  );

  // The state each system leaves: from its answer, checked again for a recorded one (the checks are deterministic).
  const states = new Map<number, ScoreState>();
  const contextOf = (s: ScoreSystem, firstOfPiece: boolean, labels: string[]) => ({
    system: s.number,
    stretches: s.layout.barLines.length + 1,
    firstOfPiece,
    images: labels,
  });
  const bounds = (n: number) => pieceBounds(pieces, n, lastSystem);
  const labelsOf = (s: ScoreSystem) => {
    const { first, last } = bounds(s.number);
    return extractImageLabels(s.layout.barLines.length + 1, !first && byNumber.has(s.number - 1), !last && byNumber.has(s.number + 1));
  };
  function stateBefore(n: number): ScoreState {
    if (bounds(n).first || !byNumber.has(n - 1)) return pieceStart();
    return stateAfter(n - 1);
  }
  function stateAfter(n: number): ScoreState {
    const after = states.get(n);
    if (after) return after;
    const extraction = stored.get(n);
    if (!extraction) throw new Error(`The extraction of system ${n} is missing.`);
    const s = byNumber.get(n)!;
    const checked = checkSystem(extraction.answer, contextOf(s, bounds(n).first, labelsOf(s)), stateBefore(n));
    if ("problem" in checked) throw new Error(`The stored extraction of system ${n} no longer passes the checks: ${checked.problem}.`);
    states.set(n, checked.state);
    return checked.state;
  }
  // The checks of the whole score, once every system is in: stored as an output of their own.
  let scoreChecks: StoredScoreChecks | null = null;
  const recordedChecks = stage.outputs.find((o) => o.item === "" && o.type === "score_checks" && o.contentSha256);
  if (recordedChecks) scoreChecks = (await fetchJsonContent(recordedChecks.contentSha256!)) as StoredScoreChecks;

  const inputsOf = (s: (typeof systems)[number]) => [pages[s.pageIndex].output.id, pages[s.pageIndex].image.id, obs.output.id, pcs.output.id];

  await runPlan(run, {
    stepVersion: EXTRACT_VERSION,
    config: { modelConfigId: config.id },
    modelConfigId: config.id,
    stageKey,
    pageCount: pages.filter((_, i) => layouts[i].systems.length > 0).length,
    inputIds: [...new Set(systems.flatMap(inputsOf))],
    note: () => {
      const all = [...stored.values(), ...(scoreChecks ? [scoreChecks] : [])];
      return extractNote(systems.length, all.reduce((n, x) => n + x.issues.length, 0), all.reduce((n, x) => n + x.warnings.length, 0));
    },
    items: [
      ...systems.map((s) => ({
        item: s.item,
        type: "extraction",
        make: async () => {
          const { first, last } = bounds(s.number);
          const before = stateBefore(s.number);
          const stretches = s.layout.barLines.length + 1;
          const labels = labelsOf(s);
          const limit = imageLimitFor(config, labels.length);
          const crop = (system: (typeof systems)[number], box: ImageSource["box"]) =>
            cropImage({ straight: straight(system.pageIndex), box, crop: CROP_VERSION, limit, scale: SCALE_VERSION });

          // The images, each after its label, and where each was cut from (for the model's issue boxes).
          const sources = new Map<string, ImageSource>();
          const content: LlmContent[] = [];
          const add = async (label: string, caption: string, system: (typeof systems)[number], box: ImageSource["box"]) => {
            sources.set(label, { page: system.page, box });
            content.push({ type: "text", text: caption }, await pngContent(await crop(system, box)));
          };
          await add("system", `System ${s.number}:`, s, systemCropBox(s.layout));
          for (const [i, box] of stretchCropBoxes(s.layout).entries()) await add(`stretch ${i + 1}`, `System ${s.number}, stretch ${i + 1}:`, s, box);
          const previous = byNumber.get(s.number - 1);
          if (labels.includes("previous system") && previous) await add("previous system", `Previous system (${previous.number}):`, previous, systemCropBox(previous.layout));
          const next = byNumber.get(s.number + 1);
          if (labels.includes("next system") && next) await add("next system", `Next system (${next.number}):`, next, systemCropBox(next.layout));

          const requestJson = extractRequest({
            system: s,
            stretches,
            firstOfPiece: first,
            lastOfPiece: last,
            state: before,
            hints: systemHints(observations, spans, s.number, s.page),
            observations,
          });
          content.push({ type: "text", text: extractText(requestJson) });
          const request: LlmRequest = {
            system: EXTRACT_SYSTEM,
            messages: [{ role: "user", content }],
            maxOutputTokens: EXTRACT_MAX_OUTPUT_TOKENS,
            jsonSchema: EXTRACT_SCHEMA as unknown as Record<string, unknown>,
          };
          const tooBig = requestSizeProblem(config, request);
          if (tooBig) throw new Error(`System ${s.number}: ${tooBig}.`);

          const kept = s.number > 1 ? ` The answers for systems 1–${s.number - 1} are kept.` : "";
          const answer = await ask(run, request, `System ${s.number}`);
          const checked = checkSystem(answer.json, contextOf(s, first, labels), before);
          if ("problem" in checked) {
            await markUnusable(run.project, run.stage.id, answer.callId, checked.problem).catch(() => {});
            throw new Error(`Couldn't use the answer for system ${s.number}: ${checked.problem}.${kept}`);
          }
          states.set(s.number, checked.state);
          const count = checked.answer.issues.length + checked.codeIssues.length;
          const firstId = count > 0 ? await reserveIssueNumbers(run.project, count) : 1;
          const result = storedExtraction(s, checked, sources, placeBox, firstId);
          stored.set(s.number, result);
          const contentSha256 = await putContent(json(result), "application/json");
          return { contentSha256, inputIds: inputsOf(s), callId: answer.callId };
        },
      })),
      {
        item: "",
        type: "score_checks",
        make: async () => {
          const checked = checkScore(
            systems.map((s) => ({ number: s.number, answer: stored.get(s.number)!.answer, state: stateAfter(s.number) })),
            pieces,
          );
          const count = checked.codeIssues.length;
          const firstId = count > 0 ? await reserveIssueNumbers(run.project, count) : 1;
          scoreChecks = storedScoreChecks(checked, placeBox, firstId);
          const contentSha256 = await putContent(json(scoreChecks), "application/json");
          return { contentSha256, inputIds: [...new Set(systems.flatMap(inputsOf))] };
        },
      },
    ],
  });
}
