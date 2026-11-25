// Runs `extract` (docs/stages/music.md): one call per system, one after the other in the score's order, since each system
// starts from what the one before it left (the piece's staves and voices, the signatures, the marks left open, a
// measure that continues). Each call gets the system's crop, a crop of each of its stretches, the previous and the next
// system (not across a piece's boundary), and the request; each answer is checked as soon as it arrives. One that
// can't be used stops the run there: the answers so far are kept, and a retry starts again at that system. Once every
// system is in, the checks of the whole score run on all of them, and what they find is one more output.

import { checkScore, checkSystem, checkSystems, LENS_VERSION, pieceStart, type ScoreState } from "@score3ly/notation";
import { EXTRACT_MAX_OUTPUT_TOKENS, EXTRACT_PROMPT_VERSION, EXTRACT_SCHEMA, EXTRACT_SYSTEM, extractText, lensFromExtract } from "@score3ly/prompts";
import { numberIssues, putJson } from "./api";
import {
  EXTRACT_VERSION,
  extractNote,
  extractRequest,
  extractStageKey,
  storedExtraction,
  storedScoreChecks,
  type StoredScoreChecks,
  type ImageSource,
  type ScoreSystem,
  type StoredExtraction,
} from "./extract";
import { modelKeyOf, normalized } from "@score3ly/core";
import { linkSpans, systemHints } from "./linking";
import { musicInputs } from "./musicInputs";
import { ask, requestImage, llmStart, type PlannedRequest, type RequestContent } from "./llm";
import { imageLimit, imageLimitFor, requestLimits } from "./requestLimits";
import { cropImage } from "./pageImages";
import { MARGINS, stretchCropBoxes, systemCropBox } from "./crops";
import { cropRecipe, imageVersions } from "./recipes";
import { recordedContent, runPlan, type StageRun } from "./stageRunner";


export async function runExtract(run: StageRun): Promise<void> {
  const { stage, pipeline } = run;
  const inputs = await musicInputs(stage, pipeline.stages);
  const { pages, layouts, observations, pieces, systems, byNumber, straight, placeBox, bounds, labelsOf, contextOf } = inputs;
  const obs = { output: inputs.observationsOutput };
  const pcs = { output: inputs.piecesOutput };

  const { config, stageConfig, start } = await llmStart(stage);
  const imageRecipe = {
    limit: imageLimit(config),
    manyImages: requestLimits(config).manyImages,
    ...imageVersions("scale", "crop", "rotate"),
    margins: MARGINS,
  };
  const stageKey = await extractStageKey({
    config: stageConfig,
    promptVersion: EXTRACT_PROMPT_VERSION,
    lensVersion: LENS_VERSION,
    model: modelKeyOf(config),
    imageRecipe,
    pages: pages.map((p) => ({ pageImageKey: p.image.recipeKey!, layoutSha256: p.output.contentSha256! })),
    observationsSha256: obs.output.contentSha256!,
    piecesSha256: pcs.output.contentSha256!,
  });

  const spans = linkSpans(observations, (page) => systems.filter((s) => s.page === page).map((s) => s.number), pieces);

  // Systems a failed run already recorded: loaded now, for the counts and for the state the next system starts from.
  const recorded = await recordedContent<StoredExtraction>(stage, "extraction");
  const stored = new Map(systems.filter((s) => recorded.has(s.item)).map((s) => [s.number, recorded.get(s.item)!]));

  // The state each system leaves: as checked in this run, or, for a recorded one, from its answer checked again with the
  // other recorded ones (the checks are deterministic), once something needs it.
  const states = new Map<number, ScoreState>();
  let recordedStates: Map<number, ScoreState> | null = null;
  const recordedSystems = systems.filter((s) => stored.has(s.number));
  function stateAfter(n: number): ScoreState {
    const after = states.get(n);
    if (after) return after;
    if (!recordedStates) {
      const checked = checkSystems(recordedSystems.map((s) => ({ context: contextOf(s), answer: stored.get(s.number)!.answer })));
      if ("problem" in checked) throw new Error(`The stored extraction of system ${checked.system} no longer passes the checks: ${checked.problem}.`);
      recordedStates = new Map(checked.map((c) => [c.number, c.state]));
    }
    const recorded = recordedStates.get(n);
    if (!recorded) throw new Error(`The extraction of system ${n} is missing.`);
    return recorded;
  }
  const stateBefore = (n: number): ScoreState => (bounds(n).first || !byNumber.has(n - 1) ? pieceStart() : stateAfter(n - 1));
  // The checks of the whole score, once every system is in: stored as an output of their own.
  let scoreChecks: StoredScoreChecks | null = null;
  scoreChecks = (await recordedContent<StoredScoreChecks>(stage, "score_checks")).get("") ?? null;

  const inputsOf = (s: (typeof systems)[number]) => [pages[s.pageIndex].output.id, pages[s.pageIndex].image.id, obs.output.id, pcs.output.id];

  await runPlan(run, {
    stepVersion: EXTRACT_VERSION,
    ...start,
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
            requestImage(cropRecipe(straight(system.pageIndex), box, limit), cropImage);

          // The images, each after its label, and where each was cut from (for the model's issue boxes).
          const sources = new Map<string, ImageSource>();
          const content: RequestContent[] = [];
          const add = async (label: string, caption: string, system: (typeof systems)[number], box: ImageSource["box"]) => {
            sources.set(label, { page: system.page, box });
            content.push({ type: "text", text: caption }, await crop(system, box));
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
          const request: PlannedRequest = {
            system: EXTRACT_SYSTEM,
            messages: [{ role: "user", content }],
            maxOutputTokens: EXTRACT_MAX_OUTPUT_TOKENS,
            jsonSchema: EXTRACT_SCHEMA,
          };

          const kept = s.number > 1 ? ` The answers for systems 1–${s.number - 1} are kept.` : "";
          // The answer as it reads back from storage (canonical JSON): what the next systems' requests are built from
          // is then the same in this run and in a retry, and the cache finds them. Its sentinels ("", -1) and merged fields
          // become the lens as code uses it first (lensFromExtract).
          const { answer, checked } = await ask(run, request, `System ${s.number}`, {
            config,
            place: { item: s.item, round: 1 },
            check: (json) => checkSystem(lensFromExtract(normalized(json)), contextOf(s), before),
            unusable: (problem) => `Couldn't use the answer for system ${s.number}: ${problem}.${kept}`,
          });
          states.set(s.number, checked.state);
          const unnumbered = storedExtraction(s, checked, sources, placeBox, 0);
          const result = { ...unnumbered, issues: await numberIssues(run.project, unnumbered.issues, [...stored.values()].flatMap((e) => e.issues)) };
          stored.set(s.number, result);
          const contentSha256 = await putJson(result);
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
          const unnumbered = storedScoreChecks(checked, placeBox, 0);
          scoreChecks = { ...unnumbered, issues: await numberIssues(run.project, unnumbered.issues, [...stored.values()].flatMap((e) => e.issues)) };
          const contentSha256 = await putJson(scoreChecks);
          return { contentSha256, inputIds: [...new Set(systems.flatMap(inputsOf))] };
        },
      },
    ],
  });
}
