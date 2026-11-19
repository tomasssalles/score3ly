// Runs `review` (docs/stages/music.md): one call per system, one after the other in the score's order. Every call's
// prompt starts with the same parts (the whole score with the observations, the issues and warnings as they were when
// the stage started) and the log of what the earlier calls changed, one block per call, so that each call's prompt
// begins with the one before it and the provider's cache serves it (docs/llm.md, "Prompt caching"); then the system's
// crops with the issues' boxes drawn on them, and its request. Each answer is checked as soon as it arrives; one that
// can't be used stops the run there, the calls before it kept.

import { buildScore, checkSystems, LENS_VERSION, systemLinks } from "@score3ly/notation";
import { REVIEW_MAX_OUTPUT_TOKENS, REVIEW_PROMPT_VERSION, REVIEW_SCHEMA, REVIEW_SYSTEM, reviewIssuesText, reviewLogText, reviewScoreText, reviewText } from "@score3ly/prompts";
import { modelKeyOf, normalized } from "@score3ly/core";
import { numberIssues, putJson } from "./api";
import { scoreInput, type ImageSource } from "./extract";
import { ask, llmStart, type PlannedRequest, type RequestContent } from "./llm";
import { imageLimitFor } from "./requestLimits";
import { musicInputs, type MusicSystem } from "./musicInputs";
import { loadTranscription, logContent, markedImage, markedImageRecipe, transcribedFor } from "./musicStage";
import { stretchCropBoxes, systemCropBox } from "./crops";
import { checkReview, logEntries, proposedChanges, REVIEW_VERSION, reviewIssues, reviewNote, reviewScore, reviewStageKey, reviewWarnings, type ReviewEntry, type StoredReview } from "./review";
import { CannotStart, recordedContent, runPlan, type StageRun } from "./stageRunner";
import { reviewInputIds } from "./stageInputs";
import { applyEntries, systemsOf } from "./issues";


export async function runReview(run: StageRun): Promise<void> {
  const { stage, pipeline } = run;
  const inputs = await musicInputs(stage, pipeline.stages);
  const { pages, observations, pieces, systems, byNumber, bounds, labelsOf, contextOf } = inputs;

  // The transcription it reviews: the latest stage before it that produces the extraction.
  const transcription = await loadTranscription(inputs, transcribedFor(inputs, "there is no transcription to review yet."));
  const { extractions, issues: baseIssues, warnings } = transcription;

  // The systems checked again, one after the other, for the links (what each leaves, and the marks it closed).
  const checked = checkSystems(systems.map((s) => ({ context: contextOf(s), answer: extractions.get(s.number)!.answer })));
  if ("problem" in checked) throw new CannotStart(`the transcription of system ${checked.system} no longer passes the checks: ${checked.problem}.`);
  const links = systemLinks(checked, pieces);
  const score = buildScore(
    systems.map((s) => scoreInput(s, extractions.get(s.number)!.answer)),
    pieces,
  );

  // The shared start of every call's prompt.
  const scorePart: RequestContent = { type: "text", text: reviewScoreText(reviewScore(score), observations) };
  const issuesPart: RequestContent = { type: "text", text: reviewIssuesText(reviewIssues(baseIssues, systems), reviewWarnings(warnings, systems)), cacheUpTo: true };

  const { config, stageConfig, start } = await llmStart(stage);
  const imageRecipe = markedImageRecipe(config);
  const stageKey = await reviewStageKey({
    config: stageConfig,
    promptVersion: REVIEW_PROMPT_VERSION,
    lensVersion: LENS_VERSION,
    model: modelKeyOf(config),
    imageRecipe,
    transcription: transcription.outputs.map((o) => o.contentSha256!).sort(),
    pages: pages.map((p) => ({ pageImageKey: p.image.recipeKey!, layoutSha256: p.output.contentSha256! })),
    observationsSha256: inputs.observationsOutput.contentSha256!,
    piecesSha256: inputs.piecesOutput.contentSha256!,
  });

  // Calls a failed run already recorded.
  const recorded = await recordedContent<StoredReview>(stage, "review");
  const calls = new Map(systems.filter((s) => recorded.has(s.item)).map((s) => [s.number, recorded.get(s.item)!]));
  // The issues before a system's call: the reviewed ones with the earlier calls' entries applied, in score order.
  const issuesBefore = (n: number) => {
    let map = new Map(baseIssues.map((i) => [i.id, i]));
    for (const call of [...calls.values()].filter((c) => c.system < n).sort((a, b) => a.system - b.system)) map = applyEntries(map, call.entries);
    return map;
  };

  // What it reads, as a further review carried through a re-run is compared by (steps.ts).
  const inputIds = reviewInputIds(inputs.sources);

  await runPlan(run, {
    stepVersion: REVIEW_VERSION,
    ...start,
    stageKey,
    pageCount: pages.length,
    inputIds,
    note: () => reviewNote(proposedChanges([...calls.values()])),
    items: systems.map((s) => ({
      item: s.item,
      type: "review",
      make: async () => {
        const { first, last } = bounds(s.number);
        const issues = issuesBefore(s.number);
        const labels = labelsOf(s);
        const limit = imageLimitFor(config, labels.length);

        // The images, each after its label, with the issues' boxes drawn on them, and where each was cut from.
        const sources = new Map<string, ImageSource & { system: number }>();
        const images: RequestContent[] = [];
        const add = async (label: string, caption: string, system: MusicSystem, box: ImageSource["box"]) => {
          sources.set(label, { page: system.page, box, system: system.number });
          images.push(...(await markedImage(inputs, caption, system, box, limit, issues.values())));
        };
        await add("system", `System ${s.number}:`, s, systemCropBox(s.layout));
        for (const [i, box] of stretchCropBoxes(s.layout).entries()) await add(`stretch ${i + 1}`, `System ${s.number}, stretch ${i + 1}:`, s, box);
        const previous = byNumber.get(s.number - 1);
        if (labels.includes("previous system") && previous) await add("previous system", `Previous system (${previous.number}):`, previous, systemCropBox(previous.layout));
        const next = byNumber.get(s.number + 1);
        if (labels.includes("next system") && next) await add("next system", `Next system (${next.number}):`, next, systemCropBox(next.layout));

        // The log: one block per earlier call that changed something.
        const log = logContent(
          [...calls.values()].filter((c) => c.entries.length > 0),
          s.number,
          (c) => reviewLogText(c.system, logEntries(c)),
        );

        const here = [...issues.values()].filter((i) => systemsOf(i.boxes, systems).includes(s.number));
        const request = {
          system: s.number,
          page: s.page,
          stretches: s.layout.barLines.length + 1,
          firstOfPiece: first,
          lastOfPiece: last,
          issues: here.map((i) => i.id),
          resolved: here.filter((i) => i.resolved).map((i) => i.id),
          warnings: warnings.filter((w) => systemsOf(w.boxes, systems).includes(s.number)).map((w) => w.message),
          links: links.get(s.number) ?? [],
        };
        const planned: PlannedRequest = {
          system: REVIEW_SYSTEM,
          messages: [{ role: "user", content: [scorePart, issuesPart, ...log, ...images, { type: "text", text: reviewText(request) }] }],
          maxOutputTokens: REVIEW_MAX_OUTPUT_TOKENS,
          jsonSchema: REVIEW_SCHEMA,
        };

        const kept = s.number > 1 ? ` The review of systems 1–${s.number - 1} is kept.` : "";
        const context = { system: s.number, issues, systems, images: sources };
        const { answer, checked } = await ask(run, planned, `System ${s.number}`, {
          config,
          place: { item: s.item, round: 1 },
          check: (json) => checkReview(normalized(json), context, 1),
          unusable: (problem) => `Couldn't use the review of system ${s.number}: ${problem}.${kept}`,
        });
        // The new issues get their numbers from the project's counter, now that the answer is usable.
        const numbered = await numberIssues(run.project, checked.entries.flatMap((e) => ("newIssue" in e ? [e.newIssue] : [])), issues.values());
        const entries: ReviewEntry[] = checked.entries.map((e) => ("newIssue" in e ? { newIssue: numbered.shift()! } : e));
        const result: StoredReview = { system: s.number, entries };
        // As it reads back from storage (canonical JSON): the later calls' log is then the same in this run and in a
        // retry, and the cache finds them.
        calls.set(s.number, normalized(result) as StoredReview);
        const contentSha256 = await putJson(result);
        return { contentSha256, inputIds, callId: answer.callId };
      },
    })),
  });
}
