// Runs `apply_review` (docs/stages/music.md): one call per system where an issue that needs applying begins, one after
// the other in the score's order. Every call's prompt starts with the same parts (the whole score as it was when the
// stage started, with the observations; the issues and warnings then) and the log of what the earlier calls changed,
// one block per call, so that each call's prompt begins with the one before it and the provider's cache serves it;
// then the window's crops with the issues' boxes drawn on them, and its request. Each answer is checked as soon as it
// arrives; one that can't be used stops the run there, the calls before it kept. Once every call is in, the new
// transcription is stored as `extract` stores one: an `extraction` per system, and the checks of the whole score.

import { CROP_VERSION, DESKEW_VERSION, DRAW_VERSION, ROTATE_VERSION, SCALE_VERSION } from "@score3ly/imaging";
import {
  buildScore,
  checkScore,
  LENS_VERSION,
  pieceStart,
  systemLinks,
  type CheckedSystem,
  type LensSystem,
  type Score,
  type StretchPlace,
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
} from "@score3ly/prompts";
import { canonicalJson } from "@score3ly/core";
import { fetchJsonContent, markUnusable, putContent, reserveIssueNumbers, type ApiStage } from "./api";
import {
  appliedCount,
  appliedIssues,
  applyCalls,
  applyLogEntries,
  applyNote,
  applyPatch,
  APPLY_REVIEW_VERSION,
  applyReviewStageKey,
  callWarnings,
  changedStretches,
  checkAll,
  checkPatch,
  isNewCodeIssue,
  revertedCount,
  type StoredApplyCall,
  type SystemToCheck,
} from "./applyReview";
import { EXTRACTION_STEPS } from "./engrave";
import { humanReviewedIssues, type StoredHumanReview } from "./humanReview";
import { MARGINS, stretchCropBoxes, systemCropBox, type ImageSource, type StoredExtraction, type StoredIssue, type StoredScoreChecks, type StoredWarning } from "./extract";
import { ask, imageLimit, imageLimitFor, modelKey, requestImage, requestLimits, stageModelConfig, type PlannedRequest, type RequestContent } from "./llm";
import { musicInputs, type MusicSystem } from "./musicInputs";
import { markedCrop, type MarkedCropRecipe } from "./pageImages";
import { placesOf, reviewedIssues, reviewIssues, reviewScore, reviewWarnings, systemsOf, type StoredReview } from "./review";
import { CannotStart, runPlan, type StageRun } from "./stageRunner";
import { choosers } from "./steps";
import { boxesOnCrop } from "./transcription";

const json = (value: unknown) => new TextEncoder().encode(canonicalJson(value));

// The steps whose issues `apply_review` applies: the stages between the transcription and it (docs/stages/music.md), and
// the type of the outputs each stores its entries in.
const REVIEWING_STEPS: Record<string, string> = { review: "review", human_review: "human_review" };

export async function runApplyReview(run: StageRun): Promise<void> {
  const { stage, pipeline } = run;
  const inputs = await musicInputs(stage, pipeline.stages);
  const { pages, observations, pieces, systems, byNumber, straight, bounds, labelsOf, placeBox } = inputs;

  // The transcription it applies to, and the reviews after it whose choices it applies.
  const at = inputs.earlier.findIndex((s) => EXTRACTION_STEPS.includes(s.step));
  const transcribed = at >= 0 ? inputs.earlier[at] : null;
  if (!transcribed || transcribed.status !== "done") throw new CannotStart("there is no transcription to apply the review to yet.");
  const reviewers: ApiStage[] = inputs.earlier.slice(0, at).filter((s) => s.step in REVIEWING_STEPS).reverse();
  if (reviewers.length === 0) throw new CannotStart("there is no review before it to apply.");
  if (reviewers.some((s) => s.status !== "done")) {
    throw new CannotStart(reviewers.some((s) => s.step === "human_review") ? "the human review before it isn't finished yet." : "the review before it hasn't finished yet.");
  }
  const entriesOf = (r: ApiStage) => r.outputs.filter((o) => o.type === REVIEWING_STEPS[r.step] && o.contentSha256);

  const extractionOutputs = new Map(transcribed.outputs.filter((o) => o.type === "extraction" && o.contentSha256).map((o) => [o.item, o]));
  const checksOutput = transcribed.outputs.find((o) => o.item === "" && o.type === "score_checks" && o.contentSha256);
  if (systems.some((s) => !extractionOutputs.has(s.item)) || !checksOutput) throw new CannotStart("the transcription doesn't match the layout: run Extract again.");
  const extractions = new Map<number, StoredExtraction>();
  await Promise.all(systems.map(async (s) => extractions.set(s.number, (await fetchJsonContent(extractionOutputs.get(s.item)!.contentSha256!)) as StoredExtraction)));
  const checks = (await fetchJsonContent(checksOutput.contentSha256!)) as StoredScoreChecks;
  const reviewOutputs = reviewers.flatMap(entriesOf);
  // A review's calls; a human review's single output, its entries as one (docs/stages/music.md, `human_review`).
  const reviewCalls = new Map<string, StoredReview[]>();
  await Promise.all(
    reviewers.map(async (r) =>
      reviewCalls.set(
        r.id,
        await Promise.all(
          entriesOf(r).map(async (o) => {
            const content = await fetchJsonContent(o.contentSha256!);
            return r.step === "human_review" ? { system: 0, entries: (content as StoredHumanReview).entries } : (content as StoredReview);
          }),
        ),
      ),
    ),
  );

  // Who chose, as the model and the cards read it.
  const named = choosers([...[...inputs.earlier].reverse(), stage]);
  const chooser = (by: string) => named[by]?.label ?? by;
  const person = (by: string) => named[by]?.person ?? false;
  const placed = systems.map((s) => ({ number: s.number, page: s.page, layout: s.layout }));

  // The issues as the reviews left them: the transcription's, with each review's entries and agreements.
  const checkIds = new Set(checks.issues.map((i) => i.id));
  let issues = new Map<number, StoredIssue>([...systems.flatMap((s) => extractions.get(s.number)!.issues), ...checks.issues].map((i) => [i.id, i]));
  for (const r of reviewers) {
    issues =
      r.step === "human_review"
        ? reviewCalls.get(r.id)!.reduce((map, call) => humanReviewedIssues(map, call, r.id), issues)
        : reviewedIssues([...issues.values()], reviewCalls.get(r.id)!, r.id, person);
  }
  const startIssues = issues;
  const startWarnings = [...systems.flatMap((s) => extractions.get(s.number)!.warnings), ...checks.warnings];

  // The systems as the checks need them, and the transcription's answers.
  const toCheck: SystemToCheck[] = systems.map((s) => ({
    number: s.number,
    stretches: s.layout.barLines.length + 1,
    firstOfPiece: bounds(s.number).first,
    images: labelsOf(s),
    followsPrevious: byNumber.has(s.number - 1),
  }));
  const startAnswers = new Map<number, LensSystem>(systems.map((s) => [s.number, extractions.get(s.number)!.answer]));
  const scoreOf = (answers: Map<number, LensSystem>): Score =>
    buildScore(
      systems.map((s) => ({ number: s.number, page: s.page, box: s.layout.box, barLines: s.layout.barLines, answer: answers.get(s.number)! })),
      pieces,
    );
  const checkedOrFail = (answers: Map<number, LensSystem>, what: string): Map<number, CheckedSystem> => {
    const checked = checkAll(answers, toCheck, pieceStart);
    if ("system" in checked) throw new CannotStart(`${what} of system ${checked.system} no longer passes the checks: ${checked.problem}.`);
    return checked;
  };
  checkedOrFail(startAnswers, "the transcription");

  const config = await stageModelConfig(stage.config);
  const imageRecipe = {
    limit: imageLimit(config),
    manyImages: requestLimits(config).manyImages,
    scale: SCALE_VERSION,
    crop: CROP_VERSION,
    deskew: DESKEW_VERSION,
    rotate: ROTATE_VERSION,
    draw: DRAW_VERSION,
    margins: MARGINS,
  };
  const transcription = [...extractionOutputs.values(), checksOutput].map((o) => o.contentSha256!).sort();
  const stageKey = await applyReviewStageKey({
    promptVersion: APPLY_REVIEW_PROMPT_VERSION,
    lensVersion: LENS_VERSION,
    model: modelKey(config),
    imageRecipe,
    transcription,
    reviews: reviewOutputs.map((o) => o.contentSha256!).sort(),
    pages: pages.map((p) => ({ pageImageKey: p.image.recipeKey!, layoutSha256: p.output.contentSha256! })),
    observationsSha256: inputs.observationsOutput.contentSha256!,
    piecesSha256: inputs.piecesOutput.contentSha256!,
  });

  // The shared start of every call's prompt: the score as it was (the same text as `review`'s), the issues and warnings.
  const scorePart: RequestContent = { type: "text", text: reviewScoreText(reviewScore(scoreOf(startAnswers)), observations) };
  const issuesPart: RequestContent = {
    type: "text",
    text: applyReviewIssuesText(reviewIssues([...startIssues.values()], placed, chooser), reviewWarnings(startWarnings, placed)),
    cacheUpTo: true,
  };

  const plannedCalls = applyCalls(startIssues.values(), placed);
  const itemOf = (n: number) => byNumber.get(n)!.item;

  // Calls a failed run already recorded.
  const recorded = new Map(stage.outputs.filter((o) => o.type === "apply_review" && o.contentSha256).map((o) => [o.item, o]));
  const calls = new Map<number, StoredApplyCall>();
  await Promise.all(
    plannedCalls
      .filter((c) => recorded.has(itemOf(c.system)))
      .map(async (c) => calls.set(c.system, (await fetchJsonContent(recorded.get(itemOf(c.system))!.contentSha256!)) as StoredApplyCall)),
  );
  // The answers before a call: the transcription's, with the earlier calls' patches applied in the score's order.
  const answersBefore = (n: number) => {
    let answers = startAnswers;
    for (const call of [...calls.values()].filter((c) => c.system < n).sort((a, b) => a.system - b.system)) answers = applyPatch(answers, call);
    return answers;
  };

  const inputIds = [
    ...[...extractionOutputs.values(), checksOutput].map((o) => o.id),
    ...reviewOutputs.map((o) => o.id),
    ...pages.flatMap((p) => [p.output.id, p.image.id]),
    inputs.observationsOutput.id,
    inputs.piecesOutput.id,
  ];

  // The new transcription, once every call is in: the answers, checked, and the issues with the calls' choices.
  let final: { answers: Map<number, LensSystem>; checked: Map<number, CheckedSystem>; issues: Map<number, StoredIssue> } | null = null;
  const finalTranscription = () => {
    if (!final) {
      const answers = answersBefore(Infinity);
      final = { answers, checked: checkedOrFail(answers, "the applied transcription"), issues: appliedIssues(startIssues, [...calls.values()], stage.id) };
    }
    return final;
  };
  const warningOf = (w: { message: string; places: StretchPlace[] }): StoredWarning => ({ message: w.message, boxes: w.places.flatMap((p) => placeBox(p) ?? []) });
  const callWarningsHere = (n: number) => [...calls.values()].flatMap((c) => c.warnings).filter((w) => (systemsOf(w.boxes, placed)[0] ?? null) === n);
  // An issue's home among the outputs: the checks' issues stay there; every other one goes with the first system its
  // boxes cover (the checks' when none).
  const homeOf = (issue: StoredIssue): number | null => (checkIds.has(issue.id) ? null : (systemsOf(issue.boxes, placed)[0] ?? null));

  await runPlan(run, {
    stepVersion: APPLY_REVIEW_VERSION,
    config: { ...(stage.config ?? {}), modelConfigId: config.id }, // the stage's config, its model config included
    modelConfigId: config.id,
    stageKey,
    pageCount: pages.length,
    inputIds,
    note: () => applyNote(appliedCount([...calls.values()]), revertedCount([...calls.values()])),
    items: [
      ...plannedCalls.map((planned) => ({
        item: itemOf(planned.system),
        type: "apply_review",
        make: async () => {
          const answers = answersBefore(planned.system);
          const checked = checkedOrFail(answers, "the transcription");
          const linked = systems.map((s) => ({ number: s.number, answer: checked.get(s.number)!.answer, state: checked.get(s.number)!.state, closed: checked.get(s.number)!.closed }));
          const links = systemLinks(linked, pieces);
          const score = scoreOf(answers);
          const measureOf = measures(score);
          const window = planned.window.map((n) => byNumber.get(n)!);
          const first = window[0];
          const last = window[window.length - 1];
          const previous = bounds(first.number).first ? undefined : byNumber.get(first.number - 1);
          const next = bounds(last.number).last ? undefined : byNumber.get(last.number + 1);
          const allowed = [previous?.number, ...planned.window, next?.number].filter((n): n is number => n !== undefined);

          // The images, each after its caption, with the boxes of the issues drawn on them and labelled with their ids.
          const notes = [...startIssues.values()].map((issue) => ({ key: `issue-${issue.id}`, boxes: issue.boxes, kind: "issue" as const, issue }));
          const count = window.reduce((n, s) => n + s.layout.barLines.length + 2, 0) + (previous ? 1 : 0) + (next ? 1 : 0);
          const limit = imageLimitFor(config, count);
          const images: RequestContent[] = [];
          const add = async (caption: string, system: MusicSystem, box: ImageSource["box"]) => {
            const on = boxesOnCrop(notes, system.page, box);
            const recipe: MarkedCropRecipe = {
              crop: { straight: straight(system.pageIndex), box, crop: CROP_VERSION, limit, scale: SCALE_VERSION },
              boxes: on.map((b) => b.box),
              labels: on.map((b) => (b.note.kind === "issue" ? String(b.note.issue.id) : "")),
              draw: DRAW_VERSION,
            };
            images.push({ type: "text", text: caption }, await requestImage(recipe, markedCrop));
          };
          if (previous) await add(`Previous system (${previous.number}):`, previous, systemCropBox(previous.layout));
          for (const s of window) {
            await add(`System ${s.number}:`, s, systemCropBox(s.layout));
            for (const [i, box] of stretchCropBoxes(s.layout).entries()) await add(`System ${s.number}, stretch ${i + 1}:`, s, box);
          }
          if (next) await add(`Next system (${next.number}):`, next, systemCropBox(next.layout));

          // The log: one block per earlier call, the last marked for the cache.
          const log: RequestContent[] = [...calls.values()]
            .filter((c) => c.system < planned.system)
            .sort((a, b) => a.system - b.system)
            .map((c) => ({ type: "text", text: applyReviewLogText(c.system, applyLogEntries(c)) }));
          if (log.length > 0) log[log.length - 1] = { ...log[log.length - 1], cacheUpTo: true };

          const onWindow = [...startIssues.values()].filter((i) => systemsOf(i.boxes, placed).some((n) => planned.window.includes(n)));
          const toApply = planned.issues.map((id) => startIssues.get(id)!);
          const request = {
            window: planned.window,
            systems: window.map((s) => systemView(answers.get(s.number)!, s, measureOf)),
            before: previous ? systemView(answers.get(previous.number)!, previous, measureOf) : null,
            after: next ? systemView(answers.get(next.number)!, next, measureOf) : null,
            links: Object.fromEntries(planned.window.map((n) => [n, links.get(n) ?? []])),
            apply: toApply.map((i) => {
              const chosen = i.choices[i.choices.length - 1];
              return {
                id: i.id,
                source: i.source,
                places: placesOf(i.boxes, placed),
                location: i.location,
                question: i.question,
                answers: i.answers,
                chosen: chosen.key,
                chosenBy: chooser(chosen.by),
                applied: i.applied,
                resolved: i.resolved,
              };
            }),
            others: onWindow.filter((i) => !planned.issues.includes(i.id)).map((i) => i.id),
            warnings: planned.window.flatMap((n) => checked.get(n)!.warnings.map((w) => w.message)),
          };
          const plannedRequest: PlannedRequest = {
            system: APPLY_REVIEW_SYSTEM,
            messages: [{ role: "user", content: [scorePart, issuesPart, ...log, ...images, { type: "text", text: applyReviewText(request) }] }],
            maxOutputTokens: APPLY_REVIEW_MAX_OUTPUT_TOKENS,
            jsonSchema: APPLY_REVIEW_SCHEMA as unknown as Record<string, unknown>,
          };

          const kept = calls.size > 0 ? " The changes applied on the systems before it are kept." : "";
          const answer = await ask(run, plannedRequest, `System ${planned.system}`, { config });
          const unusable = async (problem: string): Promise<never> => {
            await markUnusable(run.project, run.stage.id, answer.callId, problem).catch(() => {});
            throw new Error(`Couldn't use the answer for system ${planned.system}: ${problem}.${kept}`);
          };
          const patch = checkPatch(JSON.parse(canonicalJson(answer.json)), { window: planned.window, allowed, answers, toApply: planned.issues, issues: startIssues });
          if ("problem" in patch) return unusable(patch.problem);
          // An answer of a person's that can't be applied: the stage stops, for the person to answer again (docs/stages/
          // music.md, `apply_review`, "A resolved issue"). The answer is usable, so a retry gets the same.
          const blocked = patch.choices.find((c) => startIssues.get(c.issue)?.resolved);
          if (blocked) {
            const issue = startIssues.get(blocked.issue)!;
            const by = [...issue.choices].reverse().find((c) => person(c.by))?.by;
            const who = by ? chooser(by) : "a person";
            throw new Error(`The answer ${who} gave to issue ${blocked.issue} can't be applied: ${blocked.reason} Edit ${who} to answer it again.`);
          }
          const after = applyPatch(answers, patch);
          const recheck = checkAll(after, toCheck, pieceStart);
          if ("system" in recheck) return unusable(`with its changes, system ${recheck.system} doesn't pass the checks: ${recheck.problem}`);
          const changed = changedStretches(answers, after);
          const reverted = new Set(patch.choices.map((c) => c.issue));
          const appliedIds = planned.issues.filter((id) => !reverted.has(id));
          const afterMeasures = measures(scoreOf(after));
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
              systems: placed,
              placeBox,
              measureOf: (p) => afterMeasures.get(`${p.system}/${p.stretch}`) ?? null,
            }),
          };
          // As it reads back from storage (canonical JSON): the later calls' log is then the same in this run and in a
          // retry, and the cache finds them.
          calls.set(planned.system, JSON.parse(canonicalJson(result)) as StoredApplyCall);
          const contentSha256 = await putContent(json(result), "application/json");
          return { contentSha256, inputIds, callId: answer.callId };
        },
      })),
      ...systems.map((s) => ({
        item: s.item,
        type: "extraction",
        make: async () => {
          const { answers, checked, issues: all } = finalTranscription();
          const here = checked.get(s.number)!;
          const fresh = here.codeIssues
            .map((c) => ({ question: c.question, answers: c.answers, applied: c.applied, boxes: c.places.flatMap((p) => placeBox(p) ?? []) }))
            .filter((c) => isNewCodeIssue(c, all.values()));
          let id = fresh.length > 0 ? await reserveIssueNumbers(run.project, fresh.length, all.values()) : 1;
          const result: StoredExtraction = {
            system: s.number,
            page: s.page,
            answer: answers.get(s.number)!,
            issues: [
              ...[...all.values()].filter((i) => homeOf(i) === s.number).sort((a, b) => a.id - b.id),
              ...fresh.map((c): StoredIssue => ({ id: id++, source: "code", class: "reading", boxes: c.boxes, location: null, question: c.question, answers: c.answers, choices: [], applied: c.applied, resolved: false, lilypond: null })),
            ],
            warnings: [...here.warnings.map(warningOf), ...callWarningsHere(s.number)],
          };
          const contentSha256 = await putContent(json(result), "application/json");
          return { contentSha256, inputIds };
        },
      })),
      {
        item: "",
        type: "score_checks",
        make: async () => {
          const { checked, issues: all } = finalTranscription();
          const scoreChecks = checkScore(
            systems.map((s) => ({ number: s.number, answer: checked.get(s.number)!.answer, state: checked.get(s.number)!.state })),
            pieces,
          );
          const fresh = scoreChecks.codeIssues
            .map((c) => ({ question: c.question, answers: c.answers, applied: c.applied, boxes: c.places.flatMap((p) => placeBox(p) ?? []) }))
            .filter((c) => isNewCodeIssue(c, all.values()));
          let id = fresh.length > 0 ? await reserveIssueNumbers(run.project, fresh.length, all.values()) : 1;
          const result: StoredScoreChecks = {
            issues: [
              ...[...all.values()].filter((i) => homeOf(i) === null).sort((a, b) => a.id - b.id),
              ...fresh.map((c): StoredIssue => ({ id: id++, source: "code", class: "reading", boxes: c.boxes, location: null, question: c.question, answers: c.answers, choices: [], applied: c.applied, resolved: false, lilypond: null })),
            ],
            warnings: [...scoreChecks.warnings.map(warningOf), ...[...calls.values()].flatMap((c) => c.warnings).filter((w) => systemsOf(w.boxes, placed).length === 0)],
          };
          const contentSha256 = await putContent(json(result), "application/json");
          return { contentSha256, inputIds };
        },
      },
    ],
  });
}

// The measure each stretch belongs to, as code numbers them ("system/stretch" to the number).
function measures(score: Score): Map<string, number> {
  const map = new Map<string, number>();
  for (const piece of score.pieces) for (const m of piece.measures) for (const p of m.parts) for (const k of p.stretches) map.set(`${p.system}/${k}`, m.n);
  return map;
}

// A system as a call's request gives it: in the lens's field names, each stretch with the measure code gave it, with
// the descriptions (the model needs them to name a new voice or staff), without the issues.
function systemView(answer: LensSystem, system: MusicSystem, measureOf: Map<string, number>): unknown {
  return {
    system: system.number,
    page: system.page,
    startRepeat: answer.startRepeat,
    staves: answer.staves,
    groups: answer.groups,
    stretches: answer.stretches.map((s) => ({ ...s, measure: measureOf.get(`${system.number}/${s.stretch}`) ?? null })),
    lastMeasureContinues: answer.lastMeasureContinues,
  };
}
