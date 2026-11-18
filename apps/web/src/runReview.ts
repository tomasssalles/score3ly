// Runs `review` (docs/stages/music.md): one call per system, one after the other in the score's order. Every call's
// prompt starts with the same parts (the whole score with the observations, the issues and warnings as they were when
// the stage started) and the log of what the earlier calls changed, one block per call, so that each call's prompt
// begins with the one before it and the provider's cache serves it (docs/llm.md, "Prompt caching"); then the system's
// crops with the issues' boxes drawn on them, and its request. Each answer is checked as soon as it arrives; one that
// can't be used stops the run there, the calls before it kept.

import { buildScore, checkSystem, LENS_VERSION, pieceStart, systemLinks, type LinkedSystem, type ScoreState } from "@score3ly/notation";
import { REVIEW_MAX_OUTPUT_TOKENS, REVIEW_PROMPT_VERSION, REVIEW_SCHEMA, REVIEW_SYSTEM, reviewIssuesText, reviewLogText, reviewScoreText, reviewText } from "@score3ly/prompts";
import { modelKeyOf, normalized } from "@score3ly/core";
import { fetchJsonContent, putJson, reserveIssueNumbers } from "./api";
import { EXTRACTION_STEPS } from "./engrave";
import { type ImageSource, type StoredExtraction, type StoredIssue, type StoredScoreChecks } from "./extract";
import { ask, requestImage, llmStart, type PlannedRequest, type RequestContent } from "./llm";
import { imageLimit, imageLimitFor, requestLimits } from "./requestLimits";
import { musicInputs, type MusicSystem } from "./musicInputs";
import { markedCrop } from "./pageImages";
import { MARGINS, stretchCropBoxes, systemCropBox } from "./crops";
import { cropRecipe, imageVersions, markedCropRecipe } from "./recipes";
import {
  applyEntries,
  checkReview,
  logEntries,
  newIssueCount,
  proposedChanges,
  REVIEW_VERSION,
  reviewIssues,
  reviewNote,
  reviewScore,
  reviewStageKey,
  reviewWarnings,
  systemsOf,
  type ReviewEntry,
  type StoredReview,
} from "./review";
import { CannotStart, runPlan, type StageRun } from "./stageRunner";
import { reviewInputIds } from "./steps";


export async function runReview(run: StageRun): Promise<void> {
  const { stage, pipeline } = run;
  const inputs = await musicInputs(stage, pipeline.stages);
  const { pages, observations, pieces, systems, byNumber, straight, bounds, labelsOf } = inputs;

  // The transcription it reviews: the latest stage before it that produces the extraction.
  const reviewed = inputs.earlier.find((s) => EXTRACTION_STEPS.includes(s.step));
  if (!reviewed || reviewed.status !== "done") throw new CannotStart("there is no transcription to review yet.");
  const extractionOutputs = new Map(reviewed.outputs.filter((o) => o.type === "extraction" && o.contentSha256).map((o) => [o.item, o]));
  const checksOutput = reviewed.outputs.find((o) => o.item === "" && o.type === "score_checks" && o.contentSha256);
  if (systems.some((s) => !extractionOutputs.has(s.item)) || !checksOutput) throw new CannotStart("the transcription doesn't match the layout: run Extract again.");
  const extractions = new Map<number, StoredExtraction>();
  await Promise.all(systems.map(async (s) => extractions.set(s.number, (await fetchJsonContent(extractionOutputs.get(s.item)!.contentSha256!)) as StoredExtraction)));
  const checks = (await fetchJsonContent(checksOutput.contentSha256!)) as StoredScoreChecks;
  const baseIssues: StoredIssue[] = [...systems.flatMap((s) => extractions.get(s.number)!.issues), ...checks.issues];
  const warnings = [...systems.flatMap((s) => extractions.get(s.number)!.warnings), ...checks.warnings];

  // The systems checked again, one after the other, for the links (what each leaves, and the marks it closed).
  const linked: LinkedSystem[] = [];
  let state: ScoreState = pieceStart();
  for (const s of systems) {
    if (bounds(s.number).first || !byNumber.has(s.number - 1)) state = pieceStart();
    const extraction = extractions.get(s.number)!;
    const context = { system: s.number, stretches: s.layout.barLines.length + 1, firstOfPiece: bounds(s.number).first, images: labelsOf(s) };
    const checked = checkSystem(extraction.answer, context, state);
    if ("problem" in checked) throw new CannotStart(`the transcription of system ${s.number} no longer passes the checks: ${checked.problem}.`);
    linked.push({ number: s.number, answer: checked.answer, state: checked.state, closed: checked.closed });
    state = checked.state;
  }
  const links = systemLinks(linked, pieces);
  const score = buildScore(
    systems.map((s) => ({ number: s.number, page: s.page, box: s.layout.box, barLines: s.layout.barLines, answer: extractions.get(s.number)!.answer })),
    pieces,
  );

  const placed = systems.map((s) => ({ number: s.number, page: s.page, layout: s.layout }));

  // The shared start of every call's prompt.
  const scorePart: RequestContent = { type: "text", text: reviewScoreText(reviewScore(score), observations) };
  const issuesPart: RequestContent = { type: "text", text: reviewIssuesText(reviewIssues(baseIssues, placed), reviewWarnings(warnings, placed)), cacheUpTo: true };

  const { config, start } = await llmStart(stage);
  const imageRecipe = {
    limit: imageLimit(config),
    manyImages: requestLimits(config).manyImages,
    ...imageVersions("scale", "crop", "deskew", "rotate", "draw"),
    margins: MARGINS,
  };
  const transcription = [...extractionOutputs.values(), checksOutput].map((o) => o.contentSha256!).sort();
  const stageKey = await reviewStageKey({
    promptVersion: REVIEW_PROMPT_VERSION,
    lensVersion: LENS_VERSION,
    model: modelKeyOf(config),
    imageRecipe,
    transcription,
    pages: pages.map((p) => ({ pageImageKey: p.image.recipeKey!, layoutSha256: p.output.contentSha256! })),
    observationsSha256: inputs.observationsOutput.contentSha256!,
    piecesSha256: inputs.piecesOutput.contentSha256!,
  });

  // Calls a failed run already recorded.
  const recorded = new Map(stage.outputs.filter((o) => o.type === "review" && o.contentSha256).map((o) => [o.item, o]));
  const calls = new Map<number, StoredReview>();
  await Promise.all(
    systems.filter((s) => recorded.has(s.item)).map(async (s) => calls.set(s.number, (await fetchJsonContent(recorded.get(s.item)!.contentSha256!)) as StoredReview)),
  );
  // The issues before a system's call: the reviewed ones with the earlier calls' entries applied, in score order.
  const issuesBefore = (n: number) => {
    let map = new Map(baseIssues.map((i) => [i.id, i]));
    for (const call of [...calls.values()].filter((c) => c.system < n).sort((a, b) => a.system - b.system)) map = applyEntries(map, call);
    return map;
  };

  // What it reads, as a further review carried through a re-run is compared by (steps.ts).
  const inputIds = reviewInputIds(pipeline.stages.slice(0, pipeline.stages.findIndex((s) => s.id === stage.id)));

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
          const recipe = markedCropRecipe(cropRecipe(straight(system.pageIndex), box, limit), system.page, issues.values());
          images.push({ type: "text", text: caption }, await requestImage(recipe, markedCrop));
        };
        await add("system", `System ${s.number}:`, s, systemCropBox(s.layout));
        for (const [i, box] of stretchCropBoxes(s.layout).entries()) await add(`stretch ${i + 1}`, `System ${s.number}, stretch ${i + 1}:`, s, box);
        const previous = byNumber.get(s.number - 1);
        if (labels.includes("previous system") && previous) await add("previous system", `Previous system (${previous.number}):`, previous, systemCropBox(previous.layout));
        const next = byNumber.get(s.number + 1);
        if (labels.includes("next system") && next) await add("next system", `Next system (${next.number}):`, next, systemCropBox(next.layout));

        // The log: one block per earlier call that changed something, the last marked for the cache.
        const log: RequestContent[] = [...calls.values()]
          .filter((c) => c.system < s.number && c.entries.length > 0)
          .sort((a, b) => a.system - b.system)
          .map((c) => ({ type: "text", text: reviewLogText(c.system, logEntries(c)) }));
        if (log.length > 0) log[log.length - 1] = { ...log[log.length - 1], cacheUpTo: true };

        const here = [...issues.values()].filter((i) => systemsOf(i.boxes, placed).includes(s.number));
        const request = {
          system: s.number,
          page: s.page,
          stretches: s.layout.barLines.length + 1,
          firstOfPiece: first,
          lastOfPiece: last,
          issues: here.map((i) => i.id),
          resolved: here.filter((i) => i.resolved).map((i) => i.id),
          warnings: warnings.filter((w) => systemsOf(w.boxes, placed).includes(s.number)).map((w) => w.message),
          links: links.get(s.number) ?? [],
        };
        const planned: PlannedRequest = {
          system: REVIEW_SYSTEM,
          messages: [{ role: "user", content: [scorePart, issuesPart, ...log, ...images, { type: "text", text: reviewText(request) }] }],
          maxOutputTokens: REVIEW_MAX_OUTPUT_TOKENS,
          jsonSchema: REVIEW_SCHEMA,
        };

        const kept = s.number > 1 ? ` The review of systems 1–${s.number - 1} is kept.` : "";
        const context = { system: s.number, issues, systems: placed, images: sources };
        const { answer, checked } = await ask(run, planned, `System ${s.number}`, {
          config,
          place: { item: s.item, round: 1 },
          check: (json) => checkReview(normalized(json), context, 1),
          unusable: (problem) => `Couldn't use the review of system ${s.number}: ${problem}.${kept}`,
        });
        // The new issues get their numbers from the project's counter, now that the answer is usable.
        const count = newIssueCount(normalized(answer.json));
        let id = count > 0 ? await reserveIssueNumbers(run.project, count, issues.values()) : 1;
        const entries: ReviewEntry[] = checked.entries.map((e) => ("newIssue" in e ? { newIssue: { ...e.newIssue, id: id++ } } : e));
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
