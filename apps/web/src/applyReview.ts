// The `apply_review` step (docs/stages/music.md): what doesn't need the browser or the model. Its runner is
// runApplyReview.ts.
//
// It reads a transcription (the latest stage before it that produces the extraction) and the issues as the review
// right before it left them, calls a model for each system where an issue that needs applying begins, and checks each
// answer: a typed patch of whole units (a voice of a stretch, the other fields of a stretch, the fields of a system)
// and the issues it reverts (a choice of the answer already applied, with its reason). Each call's result is stored
// (type `apply_review`, one per call) as the log the later calls read; once every call is in, the new transcription is
// stored like `extract`'s (an `extraction` per system and the checks of the whole score), so every later stage reads it
// as it reads `extract`'s.

import { canonicalJson, keyOf } from "@score3ly/core";
import { checkSystem, type CheckedSystem, type LensStretch, type LensSystem, type ScoreState, type StretchPlace } from "@score3ly/notation";
import { nullsForEmpty, type ApplyReviewAnswer, type ApplyStretchUnit, type ApplySystemUnit, type ApplyVoiceUnit } from "@score3ly/prompts";
import type { StoredIssue, StoredWarning } from "./extract.ts";
import { placesOf, systemsOf, type PlacedSystem } from "./review.ts";

export const APPLY_REVIEW_VERSION = 1;

const latest = (issue: StoredIssue) => issue.choices[issue.choices.length - 1] ?? null;

// An issue needs applying when it has a choice and its latest choice differs from `applied`, null included
// (docs/notation.md, "Issues").
export function needsApplying(issue: StoredIssue): boolean {
  const last = latest(issue);
  return last !== null && last.key !== issue.applied;
}

// The calls of the stage: per system where at least one issue that needs applying begins (the first system its boxes
// cover), those issues, in the order of their ids. An issue whose boxes cover no system goes with the first system.
// Its window is that system and the next, when an issue reaches it.
export type ApplyCall = { system: number; window: number[]; issues: number[] };

export function applyCalls(issues: Iterable<StoredIssue>, systems: PlacedSystem[]): ApplyCall[] {
  const first = Math.min(...systems.map((s) => s.number));
  const calls = new Map<number, { issues: number[]; last: number }>();
  for (const issue of [...issues].filter(needsApplying).sort((a, b) => a.id - b.id)) {
    const covered = systemsOf(issue.boxes, systems);
    const start = covered[0] ?? first;
    const call = calls.get(start) ?? { issues: [], last: start };
    call.issues.push(issue.id);
    call.last = Math.max(call.last, Math.min(covered.at(-1) ?? start, start + 1));
    calls.set(start, call);
  }
  return [...calls.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([system, c]) => ({ system, window: c.last > system ? [system, c.last] : [system], issues: c.issues }));
}

// What a call stores (item p<n>/s<k> of its system, type `apply_review`): its window, the patch as code checked it
// (descriptions kept where the model left them out), the issues it reverted (the choices) and applied, the stretches
// it changed, and the warnings about what it did.
export type StoredApplyCall = {
  system: number;
  window: number[];
  voices: ApplyVoiceUnit[];
  stretches: ApplyStretchUnit[];
  systems: ApplySystemUnit[];
  // A revert: the answer chosen (an issue without an applied answer: the one that says what the transcription has,
  // `newAnswer` when the model wrote it), with the reason.
  choices: { issue: number; key: string; newAnswer?: { key: string; text: string }; reason: string }[];
  applied: number[];
  changed: StretchPlace[];
  warnings: StoredWarning[];
};

// A patch applied to the answers it changes (a new map; the systems in it are new objects where they changed). The
// patch must have been checked (`checkPatch`).
export function applyPatch(answers: Map<number, LensSystem>, patch: Pick<StoredApplyCall, "voices" | "stretches" | "systems">): Map<number, LensSystem> {
  const out = new Map(answers);
  const system = (n: number) => out.get(n)!;
  for (const u of patch.systems) {
    out.set(u.system, { ...system(u.system), startRepeat: u.startRepeat, staves: u.staves, groups: u.groups, lastMeasureContinues: u.lastMeasureContinues });
  }
  const setStretch = (n: number, k: number, change: (s: LensStretch) => LensStretch) => {
    const s = system(n);
    out.set(n, { ...s, stretches: s.stretches.map((t) => (t.stretch === k ? change(t) : t)) });
  };
  for (const u of patch.stretches) {
    const { system: n, stretch: k, reason: _reason, ...fields } = u;
    setStretch(n, k, (t) => ({ ...t, ...fields }));
  }
  for (const u of patch.voices) {
    setStretch(u.system, u.stretch, (t) => {
      if (u.music === null) return { ...t, voices: t.voices.filter((v) => v.voice !== u.voice) };
      const voice = { voice: u.voice, staff: u.staff, description: u.description, music: u.music };
      return t.voices.some((v) => v.voice === u.voice)
        ? { ...t, voices: t.voices.map((v) => (v.voice === u.voice ? voice : v)) }
        : { ...t, voices: [...t.voices, voice] };
    });
  }
  return out;
}

// The context a call's answer is checked in: its window, the systems it may change (the window and the systems just
// before and after it), the answers as they are now, and the issues: those to apply in this call, and all of them.
export type ApplyContext = {
  window: number[];
  allowed: number[];
  answers: Map<number, LensSystem>;
  toApply: number[];
  issues: Map<number, StoredIssue>;
};

// Checks an answer's form and what it names (docs/stages/music.md, `apply_review`): units on the systems it may
// change, each named once, stretches that exist, a removed voice that is there; reverts only of the issues it applies,
// each with the applied answer and a reason. What can't be used comes back as a problem, which makes the answer
// unusable, as in `extract`. Otherwise the patch as stored: a description the model left out (null) where the voice
// or staff had one is kept, so that the unit replaces only what the model meant to change.
export function checkPatch(json: unknown, ctx: ApplyContext): Pick<StoredApplyCall, "voices" | "stretches" | "systems" | "choices"> | { problem: string } {
  const answer = nullsForEmpty(json) as ApplyReviewAnswer;
  if (
    typeof answer !== "object" ||
    answer === null ||
    !Array.isArray(answer.voices) ||
    !Array.isArray(answer.stretches) ||
    !Array.isArray(answer.systems) ||
    !Array.isArray(answer.choices)
  ) {
    return { problem: "the answer doesn't have the expected form" };
  }
  const allowed = (n: number) => ctx.allowed.includes(n) && ctx.answers.has(n);
  const where = (n: number) => `system ${n} isn't one this call may change (${ctx.allowed.filter((a) => ctx.answers.has(a)).join(", ")})`;
  const stretchOf = (n: number, k: number) => ctx.answers.get(n)!.stretches.find((s) => s.stretch === k) ?? null;

  const systems: ApplySystemUnit[] = [];
  const seenSystems = new Set<number>();
  for (const u of answer.systems) {
    if (!allowed(u.system)) return { problem: `a change of a system's fields: ${where(u.system)}` };
    if (seenSystems.has(u.system)) return { problem: `the fields of system ${u.system} are changed twice` };
    seenSystems.add(u.system);
    const before = ctx.answers.get(u.system)!;
    const staves = u.staves.map((s) => ({ ...s, description: s.description ?? before.staves.find((b) => b.staff === s.staff)?.description ?? null }));
    systems.push({ ...u, staves });
  }

  const stretches: ApplyStretchUnit[] = [];
  const seenStretches = new Set<string>();
  for (const u of answer.stretches) {
    if (!allowed(u.system)) return { problem: `a change of stretch ${u.stretch}: ${where(u.system)}` };
    if (!stretchOf(u.system, u.stretch)) return { problem: `system ${u.system} has no stretch ${u.stretch}` };
    const key = `${u.system}/${u.stretch}`;
    if (seenStretches.has(key)) return { problem: `the fields of stretch ${u.stretch} of system ${u.system} are changed twice` };
    seenStretches.add(key);
    stretches.push(u);
  }

  const voices: ApplyVoiceUnit[] = [];
  const seenVoices = new Set<string>();
  for (const u of answer.voices) {
    if (!allowed(u.system)) return { problem: `a change of voice ${u.voice} in stretch ${u.stretch}: ${where(u.system)}` };
    const stretch = stretchOf(u.system, u.stretch);
    if (!stretch) return { problem: `system ${u.system} has no stretch ${u.stretch}` };
    const key = `${u.system}/${u.stretch}/${u.voice}`;
    if (seenVoices.has(key)) return { problem: `voice ${u.voice} of stretch ${u.stretch} of system ${u.system} is changed twice` };
    seenVoices.add(key);
    const before = stretch.voices.find((v) => v.voice === u.voice);
    if (u.music === null && !before) return { problem: `voice ${u.voice} is removed from stretch ${u.stretch} of system ${u.system}, which doesn't have it` };
    voices.push({ ...u, description: u.description ?? before?.description ?? null });
  }

  const choices: StoredApplyCall["choices"] = [];
  for (const c of answer.choices) {
    const issue = ctx.issues.get(c.issue);
    if (!issue || !ctx.toApply.includes(c.issue)) return { problem: `issue ${c.issue} isn't one this call applies: only those can be reverted` };
    if (choices.some((x) => x.issue === c.issue)) return { problem: `issue ${c.issue} is reverted twice` };
    const reason = typeof c.reason === "string" ? c.reason.trim() : "";
    if (reason === "") return { problem: `the revert of issue ${c.issue} needs a reason: why it can't be applied` };
    const written = typeof c.newAnswer === "string" ? c.newAnswer.trim() : "";
    // A resolved issue's revert stops the stage (runApplyReview): what it chose doesn't matter.
    if (issue.resolved) {
      choices.push({ issue: c.issue, key: issue.applied ?? "", reason });
      continue;
    }
    if (issue.applied !== null) {
      if (c.key !== issue.applied || written) return { problem: `a revert of issue ${c.issue} must choose its applied answer ("${issue.applied}"), not "${c.key ?? written}"` };
      choices.push({ issue: c.issue, key: c.key, reason });
      continue;
    }
    // No applied answer (docs/stages/music.md, `apply_review`, "An issue with no applied answer"): the answer that says
    // what the transcription has, an existing one other than the chosen one, or a new one.
    if ((c.key === null) === (written === "")) return { problem: `the revert of issue ${c.issue} needs exactly one of a key and a new answer` };
    if (c.key !== null) {
      if (!issue.answers.some((a) => a.key === c.key)) return { problem: `issue ${c.issue} has no answer "${c.key}"` };
      if (latest(issue)?.key === c.key) return { problem: `the revert of issue ${c.issue} chooses its chosen answer ("${c.key}"), which is to be applied` };
      choices.push({ issue: c.issue, key: c.key, reason });
    } else {
      if (issue.answers.some((a) => a.text.trim() === written)) return { problem: `the new answer of issue ${c.issue} is one of its answers: choose it by its key` };
      const key = String.fromCharCode("a".charCodeAt(0) + issue.answers.length);
      choices.push({ issue: c.issue, key, newAnswer: { key, text: written }, reason });
    }
  }
  return { voices, stretches, systems, choices };
}

// The systems checked in order, each from the state the one before it left (a piece starts afresh), as `extract`
// checks them: the checked systems, or the first that no longer passes.
export type SystemToCheck = { number: number; stretches: number; firstOfPiece: boolean; images: string[]; followsPrevious: boolean };

export function checkAll(answers: Map<number, LensSystem>, systems: SystemToCheck[], pieceStart: () => ScoreState): Map<number, CheckedSystem> | { system: number; problem: string } {
  const checked = new Map<number, CheckedSystem>();
  let state = pieceStart();
  for (const s of systems) {
    if (s.firstOfPiece || !s.followsPrevious) state = pieceStart();
    const result = checkSystem(answers.get(s.number), { system: s.number, stretches: s.stretches, firstOfPiece: s.firstOfPiece, images: s.images }, state);
    if ("problem" in result) return { system: s.number, problem: result.problem };
    checked.set(s.number, result);
    state = result.state;
  }
  return checked;
}

// The stretches a patch changed, compared before and after stretch by stretch (docs/stages/music.md, `human_review`:
// "Code checks what `apply_review` did"). A change of a system's fields counts as a change of its first stretch.
export function changedStretches(before: Map<number, LensSystem>, after: Map<number, LensSystem>): StretchPlace[] {
  const places: StretchPlace[] = [];
  for (const [n, b] of [...before.entries()].sort((x, y) => x[0] - y[0])) {
    const a = after.get(n)!;
    if (a === b) continue;
    const fields = (s: LensSystem) => canonicalJson({ startRepeat: s.startRepeat, staves: s.staves, groups: s.groups, lastMeasureContinues: s.lastMeasureContinues });
    for (const t of b.stretches) {
      const changed = canonicalJson(t) !== canonicalJson(a.stretches.find((x) => x.stretch === t.stretch) ?? null) || (t.stretch === 1 && fields(a) !== fields(b));
      if (changed) places.push({ system: n, stretch: t.stretch });
    }
  }
  return places;
}

// The warnings about what a call did (docs/stages/music.md, `apply_review`, "Changes beyond the boxes", and
// `human_review`, "Code catches"): each stretch it changed outside the boxes of the issues it applied, with the reason
// the model gave or saying it gave none; and each issue said to be applied whose stretches didn't change.
export function callWarnings(input: {
  changed: StretchPlace[];
  applied: StoredIssue[];
  patch: Pick<StoredApplyCall, "voices" | "stretches" | "systems">;
  systems: PlacedSystem[];
  placeBox: (place: StretchPlace) => { page: number; box: { left: number; right: number; top: number; bottom: number } } | null;
  measureOf: (place: StretchPlace) => number | null;
}): StoredWarning[] {
  const under = new Set(input.applied.flatMap((i) => placesOf(i.boxes, input.systems).flatMap((p) => p.stretches.map((k) => `${p.system}/${k}`))));
  const changedKeys = new Set(input.changed.map((p) => `${p.system}/${p.stretch}`));
  const warnings: StoredWarning[] = [];
  const name = (p: StretchPlace) => {
    const m = input.measureOf(p);
    return `stretch ${p.stretch} of system ${p.system}${m === null ? "" : ` (m. ${m})`}`;
  };
  for (const p of input.changed) {
    if (under.has(`${p.system}/${p.stretch}`)) continue;
    const reasons = [
      ...input.patch.voices.filter((u) => u.system === p.system && u.stretch === p.stretch).map((u) => u.reason),
      ...input.patch.stretches.filter((u) => u.system === p.system && u.stretch === p.stretch).map((u) => u.reason),
      ...(p.stretch === 1 ? input.patch.systems.filter((u) => u.system === p.system).map((u) => u.reason) : []),
    ].flatMap((r) => (r && r.trim() ? [r.trim()] : []));
    const unique = [...new Set(reasons)];
    const why = unique.length > 0 ? `: ${unique.join(" ")}` : ", without giving a reason.";
    warnings.push({
      message: `Apply review changed ${name(p)}, beyond the boxes of the issues it applied${why}`,
      boxes: input.placeBox(p) ? [input.placeBox(p)!] : [],
    });
  }
  for (const issue of input.applied) {
    const places = placesOf(issue.boxes, input.systems);
    const stretches = places.flatMap((p) => p.stretches.map((k) => ({ system: p.system, stretch: k })));
    if (stretches.length === 0 || stretches.some((p) => changedKeys.has(`${p.system}/${p.stretch}`))) continue;
    warnings.push({
      message: `Issue ${issue.id} is applied, but none of the stretches under its boxes changed (the transcription may already have said what its chosen answer says).`,
      boxes: issue.boxes,
    });
  }
  return warnings;
}

// The issues after the stage's calls (docs/stages/music.md, `apply_review`): a reverted issue gets the stage's choice
// of its applied answer, with the reason; one without an applied answer gets the answer chosen as `applied` (a new one
// added first), with no application (who wrote that music isn't known: "[in this transcription]"); every other issue a
// call applied has its latest choice as `applied`.
export function appliedIssues(issues: Map<number, StoredIssue>, calls: StoredApplyCall[], stageId: string): Map<number, StoredIssue> {
  const out = new Map(issues);
  for (const call of [...calls].sort((a, b) => a.system - b.system)) {
    for (const c of call.choices) {
      const issue = out.get(c.issue);
      if (!issue) continue;
      out.set(c.issue, {
        ...issue,
        answers: c.newAnswer ? [...issue.answers, c.newAnswer] : issue.answers,
        choices: [...issue.choices, { by: stageId, key: c.key, reason: c.reason, reverted: true }],
        applied: issue.applied ?? c.key,
      });
    }
    for (const id of call.applied) {
      const issue = out.get(id);
      const last = issue && latest(issue);
      if (issue && last) out.set(id, { ...issue, applied: last.key, applications: [...(issue.applications ?? []), { by: stageId, key: last.key }] });
    }
  }
  return out;
}

// The entries of a call as the log gives them to later calls: what changed, short.
export function applyLogEntries(call: StoredApplyCall): unknown[] {
  return [
    ...call.systems.map(({ reason: _r, ...u }) => ({ system: u })),
    ...call.stretches.map(({ reason: _r, ...u }) => ({ stretch: u })),
    ...call.voices.map(({ reason: _r, ...u }) => ({ voice: u })),
    ...call.choices.map((c) => ({ reverted: c })),
    ...(call.applied.length > 0 ? [{ applied: call.applied }] : []),
  ];
}

// A code issue found again on the new transcription is new only if no issue raised by code asks the same about the
// same places (docs/notation.md, "Issues": otherwise every rebuild would raise it again).
export function isNewCodeIssue(issue: { question: string; boxes: StoredIssue["boxes"] }, existing: Iterable<StoredIssue>): boolean {
  const boxes = canonicalJson(issue.boxes);
  for (const e of existing) if (e.source === "code" && e.question === issue.question && canonicalJson(e.boxes) === boxes) return false;
  return true;
}

// The card's short result, e.g. "4 changes applied, 2 reverted".
export function applyNote(applied: number, reverted: number): string {
  const changes = `${applied} change${applied === 1 ? "" : "s"} applied`;
  return reverted > 0 ? `${changes}, ${reverted} reverted` : changes;
}

export const appliedCount = (calls: StoredApplyCall[]) => calls.reduce((n, c) => n + c.applied.length, 0);
export const revertedCount = (calls: StoredApplyCall[]) => calls.reduce((n, c) => n + c.choices.length, 0);

// The stage key (§5.2): the step, its version, the prompt's and the lens's versions, the model, the images' recipe,
// the transcription it applies to (its stored outputs), the review it applies (its stored calls), the pages' images
// and layouts, the observations and pieces.
export function applyReviewStageKey(input: {
  promptVersion: number;
  lensVersion: number;
  model: unknown;
  imageRecipe: unknown;
  transcription: string[];
  reviews: string[];
  pages: { pageImageKey: string; layoutSha256: string }[];
  observationsSha256: string;
  piecesSha256: string;
}): Promise<string> {
  return keyOf({ step: "apply_review", version: APPLY_REVIEW_VERSION, ...input });
}
