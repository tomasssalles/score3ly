// Runs `apply_review` (docs/stages/music.md): one call per system where an issue that needs applying begins, one after
// the other in the score's order. Every call's prompt starts with the same parts (the whole score as it was when the
// stage started, with the observations; the issues and warnings then) and the log of what the earlier calls changed,
// one block per call, so that each call's prompt begins with the one before it and the provider's cache serves it;
// then the window's crops with the issues' boxes drawn on them, and its request. Each answer is checked as soon as it
// arrives; one that can't be used stops the run there, the calls before it kept. Once every call is in, the new
// transcription is stored as `extract` stores one: an `extraction` per system, and the checks of the whole score.

import {
  buildScore,
  checkScore,
  LENS_VERSION,
  systemLinks,
  type CheckedSystem,
  type LensSystem,
  type Score,
  type Warning,
} from "@score3ly/notation";
import {
  APPLY_REVIEW_MAX_OUTPUT_TOKENS,
  APPLY_REVIEW_PROMPT_VERSION,
  APPLY_REVIEW_SCHEMA,
  APPLY_REVIEW_SYSTEM,
  applyReviewIssuesText,
  applyReviewLogText,
  applyReviewText,
  reviewScoreText,
  stretchMeasures,
} from "@score3ly/prompts";
import { modelKeyOf, normalized } from "@score3ly/core";
import { fetchJsonContent, numberIssues, putJson } from "./api";
import { appliedCount, applyCalls, applyLogEntries, applyNote, applyPatch, APPLY_REVIEW_VERSION, applyReviewStageKey, callWarnings, changedStretches, checkAll, checkPatch, issueToApply, revertedCount, systemView, type StoredApplyCall } from "./applyReview";
import { applyReviewInputIds, reviewEntries, pageCountBefore } from "./stageInputs";
import type { StoredHumanReview } from "./humanReview";
import { scoreInput, type ImageSource, type StoredExtraction, type StoredScoreChecks } from "./extract";
import { ask, llmStart, type PlannedRequest, type RequestContent } from "./llm";
import { imageLimitFor } from "./requestLimits";
import { musicInputs, type MusicSystem } from "./musicInputs";
import { loadTranscription, logContent, markedImage, markedImageRecipe, transcribedFor } from "./musicStage";
import { stretchCropBoxes, systemCropBox } from "./crops";
import { reviewIssues, reviewScore, reviewWarnings, type StoredReview } from "./review";
import { CannotStart, recordedContent, runPlan, type StageRun } from "./stageRunner";
import { choosingChain } from "./steps";
import { attributionOf } from "./attribution";
import { appliedIssues, freshCodeIssues, issuesAfter, storedWarning, systemsOf, type StageIssues, type StoredIssue, type StoredWarning } from "./issues";


export async function runApplyReview(run: StageRun): Promise<void> {
  const { stage, pipeline } = run;
  const inputs = await musicInputs(stage, pipeline.stages);
  const { pages, observations, pieces, systems, byNumber, bounds, contextOf, placeBox } = inputs;

  // The transcription it applies to, and the reviews after it whose choices it applies.
  const transcribed = transcribedFor(inputs, "there is no transcription to apply the review to yet.");
  const reviewers = transcribed.reviews;
  if (reviewers.length === 0) throw new CannotStart("there is no review before it to apply.");
  if (reviewers.some((s) => s.status !== "done")) {
    throw new CannotStart(reviewers.some((s) => s.step === "human_review") ? "the human review before it isn't finished yet." : "the review before it hasn't finished yet.");
  }

  const transcription = await loadTranscription(inputs, transcribed);
  const { extractions, checks } = transcription;
  const reviewOutputs = reviewers.flatMap(reviewEntries);
  // What each review stored: a review's calls; a human review's single output (docs/stages/music.md, `human_review`).
  const loaded = await Promise.all(
    reviewers.map(async (r): Promise<StageIssues> => {
      const contents = await Promise.all(reviewEntries(r).map((o) => fetchJsonContent(o.contentSha256!)));
      return r.step === "human_review"
        ? { step: "human_review", stored: { entries: (contents as StoredHumanReview[]).flatMap((c) => c.entries) } }
        : { step: "review", calls: contents as StoredReview[], done: true };
    }),
  );

  // The issues as the reviews left them: the transcription's, with each review's entries and agreements.
  const checkIds = new Set(checks.issues.map((i) => i.id));
  const issues = loaded.reduce(issuesAfter, new Map<number, StoredIssue>(transcription.issues.map((i) => [i.id, i])));
  const startIssues = issues;
  const startWarnings = transcription.warnings;

  // The systems as the checks need them, and the transcription's answers.
  const toCheck = systems.map(contextOf);
  const startAnswers = new Map<number, LensSystem>(systems.map((s) => [s.number, extractions.get(s.number)!.answer]));
  const scoreOf = (answers: Map<number, LensSystem>): Score =>
    buildScore(
      systems.map((s) => scoreInput(s, answers.get(s.number)!)),
      pieces,
    );
  const checkedOrFail = (answers: Map<number, LensSystem>, what: string): Map<number, CheckedSystem> => {
    const checked = checkAll(answers, toCheck);
    if ("system" in checked) throw new CannotStart(`${what} of system ${checked.system} no longer passes the checks: ${checked.problem}.`);
    return checked;
  };
  checkedOrFail(startAnswers, "the transcription");

  const { config, stageConfig, start } = await llmStart(stage);
  const imageRecipe = markedImageRecipe(config);
  const stageKey = await applyReviewStageKey({
    config: stageConfig,
    promptVersion: APPLY_REVIEW_PROMPT_VERSION,
    lensVersion: LENS_VERSION,
    model: modelKeyOf(config),
    imageRecipe,
    transcription: transcription.outputs.map((o) => o.contentSha256!).sort(),
    reviews: reviewOutputs.map((o) => o.contentSha256!).sort(),
    pages: pages.map((p) => ({ pageImageKey: p.image.recipeKey!, layoutSha256: p.output.contentSha256! })),
    observationsSha256: inputs.observationsOutput.contentSha256!,
    piecesSha256: inputs.piecesOutput.contentSha256!,
  });

  // The shared start of every call's prompt: the score as it was (the same text as `review`'s), the issues and warnings.
  const scorePart: RequestContent = { type: "text", text: reviewScoreText(reviewScore(scoreOf(startAnswers)), observations) };
  const issuesPart: RequestContent = {
    type: "text",
    text: applyReviewIssuesText(reviewIssues([...startIssues.values()], systems), reviewWarnings(startWarnings, systems)),
    cacheUpTo: true,
  };

  const plannedCalls = applyCalls(startIssues.values(), systems);
  const itemOf = (n: number) => byNumber.get(n)!.item;

  // Calls a failed run already recorded.
  const recorded = await recordedContent<StoredApplyCall>(stage, "apply_review");
  const calls = new Map(plannedCalls.filter((c) => recorded.has(itemOf(c.system))).map((c) => [c.system, recorded.get(itemOf(c.system))!]));
  // The answers before a call: the transcription's, with the earlier calls' patches applied in the score's order.
  const answersBefore = (n: number) => {
    let answers = startAnswers;
    for (const call of [...calls.values()].filter((c) => c.system < n).sort((a, b) => a.system - b.system)) answers = applyPatch(answers, call);
    return answers;
  };

  const inputIds = applyReviewInputIds(inputs.sources);

  // The new transcription, once every call is in: the answers, checked, and the issues with the calls' choices.
  let final: { answers: Map<number, LensSystem>; checked: Map<number, CheckedSystem>; issues: Map<number, StoredIssue> } | null = null;
  const finalTranscription = () => {
    if (!final) {
      const answers = answersBefore(Infinity);
      final = { answers, checked: checkedOrFail(answers, "the applied transcription"), issues: appliedIssues(startIssues, [...calls.values()]) };
    }
    return final;
  };
  const warningOf = (w: Warning): StoredWarning => storedWarning(w, placeBox);
  const callWarningsHere = (n: number) => [...calls.values()].flatMap((c) => c.warnings).filter((w) => (systemsOf(w.boxes, systems)[0] ?? null) === n);
  // An issue's home among the outputs: the checks' issues stay there; every other one goes with the first system its
  // boxes cover (the checks' when none).
  const homeOf = (issue: StoredIssue): number | null => (checkIds.has(issue.id) ? null : (systemsOf(issue.boxes, systems)[0] ?? null));

  await runPlan(run, {
    stepVersion: APPLY_REVIEW_VERSION,
    ...start,
    stageKey,
    pageCount: pageCountBefore(pipeline.stages, stage.id),
    inputIds,
    note: () => applyNote(appliedCount([...calls.values()]), revertedCount([...calls.values()])),
    items: [
      ...plannedCalls.map((planned) => ({
        item: itemOf(planned.system),
        type: "apply_review",
        make: async () => {
          const answers = answersBefore(planned.system);
          const checked = checkedOrFail(answers, "the transcription");
          const links = systemLinks([...checked.values()], pieces);
          const score = scoreOf(answers);
          const measureOf = stretchMeasures(score);
          const window = planned.window.map((n) => byNumber.get(n)!);
          const first = window[0];
          const last = window[window.length - 1];
          const previous = bounds(first.number).first ? undefined : byNumber.get(first.number - 1);
          const next = bounds(last.number).last ? undefined : byNumber.get(last.number + 1);
          const allowed = [previous?.number, ...planned.window, next?.number].filter((n): n is number => n !== undefined);

          // The images, each after its caption, with the boxes of the issues drawn on them and labelled with their ids.
          const count = window.reduce((n, s) => n + s.layout.barLines.length + 2, 0) + (previous ? 1 : 0) + (next ? 1 : 0);
          const limit = imageLimitFor(config, count);
          const images: RequestContent[] = [];
          const add = async (caption: string, system: MusicSystem, box: ImageSource["box"]) => {
            images.push(...(await markedImage(inputs, caption, system, box, limit, startIssues.values())));
          };
          if (previous) await add(`Previous system (${previous.number}):`, previous, systemCropBox(previous.layout));
          for (const s of window) {
            await add(`System ${s.number}:`, s, systemCropBox(s.layout));
            for (const [i, box] of stretchCropBoxes(s.layout).entries()) await add(`System ${s.number}, stretch ${i + 1}:`, s, box);
          }
          if (next) await add(`Next system (${next.number}):`, next, systemCropBox(next.layout));

          // The log: one block per earlier call.
          const log = logContent(calls.values(), planned.system, (c) => applyReviewLogText(c.system, applyLogEntries(c)));

          const onWindow = [...startIssues.values()].filter((i) => systemsOf(i.boxes, systems).some((n) => planned.window.includes(n)));
          const toApply = planned.issues.map((id) => startIssues.get(id)!);
          const request = {
            window: planned.window,
            systems: window.map((s) => systemView(answers.get(s.number)!, s, measureOf)),
            before: previous ? systemView(answers.get(previous.number)!, previous, measureOf) : null,
            after: next ? systemView(answers.get(next.number)!, next, measureOf) : null,
            links: Object.fromEntries(planned.window.map((n) => [n, links.get(n) ?? []])),
            apply: toApply.map((i) => issueToApply(i, systems)),
            others: onWindow.filter((i) => !planned.issues.includes(i.id)).map((i) => i.id),
            warnings: planned.window.flatMap((n) => checked.get(n)!.warnings.map((w) => w.message)),
          };
          const plannedRequest: PlannedRequest = {
            system: APPLY_REVIEW_SYSTEM,
            messages: [{ role: "user", content: [scorePart, issuesPart, ...log, ...images, { type: "text", text: applyReviewText(request) }] }],
            maxOutputTokens: APPLY_REVIEW_MAX_OUTPUT_TOKENS,
            jsonSchema: APPLY_REVIEW_SCHEMA,
          };

          const kept = calls.size > 0 ? " The changes applied on the systems before it are kept." : "";
          // The patch, and the answers with it applied, which must pass the checks; none when it reverts a person's
          // answer (below), which is usable.
          const blockedBy = <C extends { issue: number }>(choices: C[]) => choices.find((c) => startIssues.get(c.issue)?.resolved);
          const check = (json: unknown) => {
            const patch = checkPatch(normalized(json), { window: planned.window, allowed, answers, toApply: planned.issues, issues: startIssues });
            if ("problem" in patch) return patch;
            if (blockedBy(patch.choices)) return { patch, after: null };
            const after = applyPatch(answers, patch);
            const recheck = checkAll(after, toCheck);
            if ("system" in recheck) return { problem: `with its changes, system ${recheck.system} doesn't pass the checks: ${recheck.problem}` };
            return { patch, after };
          };
          const {
            answer,
            checked: { patch, after },
          } = await ask(run, plannedRequest, `System ${planned.system}`, {
            config,
            place: { item: itemOf(planned.system), round: 1 },
            check,
            unusable: (problem) => `Couldn't use the answer for system ${planned.system}: ${problem}.${kept}`,
          });
          // An answer of a person's that can't be applied: the stage stops, for the person to answer again (docs/stages/
          // music.md, `apply_review`, "A resolved issue"). The answer is usable, so a retry gets the same.
          if (!after) {
            const blocked = blockedBy(patch.choices)!;
            const issue = startIssues.get(blocked.issue)!;
            // The human review that gave it, as its card names it (attribution.ts).
            const index = issue.choices.map((c) => c.by).lastIndexOf("human_review");
            const { attribution } = await attributionOf(choosingChain([...inputs.earlier].reverse()), { json: fetchJsonContent });
            const who = attribution[issue.id]?.choices[index]?.label ?? "a person";
            throw new Error(`The answer ${who} gave to issue ${blocked.issue} can't be applied: ${blocked.reason} Edit ${who} to answer it again.`);
          }
          const changed = changedStretches(answers, after);
          const reverted = new Set(patch.choices.map((c) => c.issue));
          const appliedIds = planned.issues.filter((id) => !reverted.has(id));
          const afterMeasures = stretchMeasures(scoreOf(after));
          const result: StoredApplyCall = {
            system: planned.system,
            window: planned.window,
            ...patch,
            applied: appliedIds,
            changed,
            warnings: callWarnings({
              changed,
              applied: appliedIds.map((id) => startIssues.get(id)!),
              patch,
              systems,
              placeBox,
              measureOf: (p) => afterMeasures.get(`${p.system}/${p.stretch}`) ?? null,
            }),
          };
          // As it reads back from storage (canonical JSON): the later calls' log is then the same in this run and in a
          // retry, and the cache finds them.
          calls.set(planned.system, normalized(result) as StoredApplyCall);
          const contentSha256 = await putJson(result);
          return { contentSha256, inputIds, callId: answer.callId };
        },
      })),
      ...systems.map((s) => ({
        item: s.item,
        type: "extraction",
        make: async () => {
          const { answers, checked, issues: all } = finalTranscription();
          const here = checked.get(s.number)!;
          const result: StoredExtraction = {
            system: s.number,
            page: s.page,
            answer: answers.get(s.number)!,
            issues: [
              ...[...all.values()].filter((i) => homeOf(i) === s.number).sort((a, b) => a.id - b.id),
              ...(await numberIssues(run.project, freshCodeIssues(here.codeIssues, all.values(), placeBox), all.values())),
            ],
            warnings: [...here.warnings.map(warningOf), ...callWarningsHere(s.number)],
          };
          const contentSha256 = await putJson(result);
          return { contentSha256, inputIds };
        },
      })),
      {
        item: "",
        type: "score_checks",
        make: async () => {
          const { checked, issues: all } = finalTranscription();
          const scoreChecks = checkScore([...checked.values()], pieces);
          const result: StoredScoreChecks = {
            issues: [
              ...[...all.values()].filter((i) => homeOf(i) === null).sort((a, b) => a.id - b.id),
              ...(await numberIssues(run.project, freshCodeIssues(scoreChecks.codeIssues, all.values(), placeBox), all.values())),
            ],
            warnings: [...scoreChecks.warnings.map(warningOf), ...[...calls.values()].flatMap((c) => c.warnings).filter((w) => systemsOf(w.boxes, systems).length === 0)],
          };
          const contentSha256 = await putJson(result);
          return { contentSha256, inputIds };
        },
      },
    ],
  });
}
