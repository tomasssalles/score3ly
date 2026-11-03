// `apply_review` (docs/stages/music.md): one call per system where an issue that needs applying begins, which carries
// out the chosen answers of those issues on the transcription and answers with a typed patch of only what it changes:
// whole voices of stretches, the other fields of stretches, the fields of systems. It follows orders: it never judges
// whether a chosen answer is right. An answer it can't apply as given, it reverts: a choice of the answer already
// applied, with the reason. Every call gets the whole score as it was when the stage started, the issues and warnings
// then, and the changes the stage's earlier calls made (an append-only log), in that order, so that a call's prompt
// starts with the one before it and the provider's prompt cache serves the shared part; then its own window (one
// system, or two when an issue reaches the next): the crops with the issues' boxes drawn on them, and a request. Code
// checks the answer as soon as it arrives (apps/web/src/applyReview.ts).

import { MUSIC } from "./extract.ts";

// Raise whenever the texts or the schema change.
export const APPLY_REVIEW_PROMPT_VERSION = 2;

export const APPLY_REVIEW_MAX_OUTPUT_TOKENS = 32_000;

export const APPLY_REVIEW_SYSTEM = `You apply decisions to a transcription of printed music. Another model transcribed the score system by system into a compact format; reviewers and people then asked questions about the page ("issues") and chose answers. Your job is to change the transcription so that it says what the chosen answers say, and nothing else.

**You follow orders.** The decisions are made: you never judge whether a chosen answer is right, and never refuse one because you would read the page differently. You are given the crops so that you can find what an answer is about and write it correctly, not to check the reviewers.

## What you get
1. **The score:** the whole transcription as it was when this stage started, in the format below, as JSON: for each piece its staves and voices, and for each system its staves, groups and stretches, each stretch with **measure**, the number code gave the measure it belongs to, and the music of its voices. Observations from an earlier look at the pages follow it.
2. **The issues and the warnings,** as they were when this stage started. An issue is a question about what the page says at a place: **places** (the systems and stretches its boxes cover), **location** and **question**, **answers** with keys "a", "b", …, **choices** (who chose which answer, in order: the latest counts), **applied** (the answer the transcription reflects now; null when that isn't known), **resolved** (a person decided it). A warning is something code found wrong with the transcription itself.
3. **What this stage's earlier calls changed,** one entry per change, in order. They are part of the transcription now.
4. **Your window:** one system, or two when an issue reaches the next one. Its crops ("System 17:", and each of its stretches, "System 17, stretch 2:"), with the boxes of the issues drawn in colour and labelled with the issue's id, and the systems before and after it for context; then a request: the window's systems as they are now (with the changes of the earlier calls), the systems just before and after it, the **links** (what on these systems belongs with something elsewhere), the issues to **apply** (each with its **chosen** answer), the **other** issues on these systems, and the warnings on them.

**Stretches:** code cut each system at its bar lines. Stretch 1 runs from the start of the system to the first bar line, stretch k from bar line k - 1 to bar line k. They are fixed: you can't add or remove one, only change what is in it and how it belongs to measures.

## What to do
For each issue to apply, change the transcription so that it says what the chosen answer says. Change only what the answer needs:
- **Leave everything else as it is,** above all the other issues on these systems: their answers are not yours to apply.
- **Usually only the stretches under the issue's boxes change.** Where an answer needs more (a slur said to continue into the next system changes where it ends there too; a note made longer changes what follows it in the measure), change the stretches it needs, also on the systems just before and after your window, and give a **reason** for every change outside the boxes.
- **Keep the transcription consistent:** every voice of a stretch lasts the same, every staff has a voice in every stretch that is part of a measure, curves keep their numbers across bar lines and systems, a voice or staff that is new has a description where it first appears.

## Your answer: only what changes
Each unit you name is replaced whole by what you write; whatever you don't name stays as it is. Copy nothing that doesn't change.
- **voices:** a voice of a stretch, \`{ "system", "stretch", "voice", "staff", "description", "music", "reason" }\`: its music replaced whole. **music** null removes the voice from the stretch (e.g. a voice that isn't printed). A voice that isn't in the stretch yet is added. **description:** null for a voice that exists; a short description for a voice that is new in the piece.
- **stretches:** the other fields of a stretch, \`{ "system", "stretch", "class", "kind", "printedNumber", "measureNumber", "changes", "ending", "rightBarLine", "reason" }\`, all of them replaced (its voices stay). Merging two stretches into one measure is the second's class going from "new" to "continues"; splitting is the reverse.
- **systems:** the fields of a system, \`{ "system", "startRepeat", "staves", "groups", "lastMeasureContinues", "reason" }\`, all of them replaced (its stretches stay). In **staves**, description is null for a staff that exists.
- **reason:** null for a change under the boxes of the issues it applies; for a change outside them, why it is needed ("the slur of issue 12 now ends here").
- **choices:** the issues you can't apply as given. Only when it truly can't be done: the answer doesn't fit the transcription (the slur is to end on a G the measure doesn't have), two chosen answers conflict (one makes a note a quarter, another a dotted quarter), the format can't express it, or the answer is too vague to act on. Then leave the transcription as it is for that issue, and write \`{ "issue": 12, "key": "a", "newAnswer": null, "reason": "…" }\` with **key** the issue's **applied** answer (the one the transcription has now), **newAnswer** null, and **reason** what makes it impossible, written for a musician who reads it in the app and for the next reviewer, so that it isn't asked again: "The reviewer asked for these two changes, but they're incompatible: …". Disagreeing with an answer is never a reason.
  - **An issue whose applied is null** (nothing is known of what the transcription has there): choose the answer that says what the transcription has, by its **key** (never the chosen one); if none of the answers says it, **key** null and **newAnswer** a short text that does, about the page and never mentioning the transcription ("On the E of the next measure").
  - **A resolved issue** (a person's answer) is reverted the same way when it truly can't be applied: the stage then stops and shows your reason, so that the person can answer again.
- Every issue to apply that you don't name in **choices** counts as applied: make sure the transcription then says what its chosen answer says.

${MUSIC}`;

// The parts of a call's prompt, in order: the score (with the observations; the same text as `review`'s), the issues and
// warnings, an entry of the log per earlier call that changed something, the window's own request (after its images).
export function applyReviewIssuesText(issues: unknown, warnings: unknown): string {
  return `The issues when this stage started:\n${JSON.stringify(issues)}\n\nThe warnings of this transcription:\n${JSON.stringify(warnings)}`;
}

export function applyReviewLogText(system: number, entries: unknown[]): string {
  return entries.map((entry) => JSON.stringify({ by: `this stage, system ${system}`, ...(entry as object) })).join("\n");
}

export function applyReviewText(request: unknown): string {
  return `Apply these issues. The request:\n${JSON.stringify(request)}`;
}

const str = { type: "string" };
const int = { type: "integer" };
const bool = { type: "boolean" };
const nullable = (schema: object) => ({ anyOf: [schema, { type: "null" }] });
const enumOf = (values: readonly string[]) => ({ type: "string", enum: [...values] });

function object(properties: Record<string, unknown>) {
  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
}

export const APPLY_REVIEW_SCHEMA = object({
  voices: {
    type: "array",
    items: object({ system: int, stretch: int, voice: int, staff: int, description: nullable(str), music: nullable(str), reason: nullable(str) }),
  },
  stretches: {
    type: "array",
    items: object({
      system: int,
      stretch: int,
      class: enumOf(["none", "new", "continues"]),
      kind: nullable(enumOf(["normal", "incomplete", "unmeasured"])),
      printedNumber: nullable(str),
      measureNumber: nullable(int),
      changes: { type: "array", items: object({ staff: int, key: nullable(str), time: nullable(str) }) },
      ending: nullable(object({ startsHere: bool, endsHere: bool, label: nullable(str) })),
      rightBarLine: enumOf(["single", "double", "final", "startRepeat", "endRepeat", "bothRepeats", "dashed", "none"]),
      reason: nullable(str),
    }),
  },
  systems: {
    type: "array",
    items: object({
      system: int,
      startRepeat: bool,
      staves: {
        type: "array",
        items: object({ staff: int, description: nullable(str), label: nullable(str), clef: str, key: str, time: nullable(str) }),
      },
      groups: {
        type: "array",
        items: object({ staves: { type: "array", items: int }, symbol: enumOf(["brace", "bracket", "bracketsq", "line"]), label: nullable(str) }),
      },
      lastMeasureContinues: bool,
      reason: nullable(str),
    }),
  },
  choices: { type: "array", items: object({ issue: int, key: nullable(str), newAnswer: nullable(str), reason: str }) },
});

// The answer, as the schema has it.
export type ApplyVoiceUnit = {
  system: number;
  stretch: number;
  voice: number;
  staff: number;
  description: string | null;
  music: string | null;
  reason: string | null;
};
export type ApplyStretchUnit = {
  system: number;
  stretch: number;
  class: "none" | "new" | "continues";
  kind: "normal" | "incomplete" | "unmeasured" | null;
  printedNumber: string | null;
  measureNumber: number | null;
  changes: { staff: number; key: string | null; time: string | null }[];
  ending: { startsHere: boolean; endsHere: boolean; label: string | null } | null;
  rightBarLine: "single" | "double" | "final" | "startRepeat" | "endRepeat" | "bothRepeats" | "dashed" | "none";
  reason: string | null;
};
export type ApplySystemUnit = {
  system: number;
  startRepeat: boolean;
  staves: { staff: number; description: string | null; label: string | null; clef: string; key: string; time: string | null }[];
  groups: { staves: number[]; symbol: "brace" | "bracket" | "bracketsq" | "line"; label: string | null }[];
  lastMeasureContinues: boolean;
  reason: string | null;
};
export type ApplyRevert = { issue: number; key: string | null; newAnswer: string | null; reason: string };
export type ApplyReviewAnswer = { voices: ApplyVoiceUnit[]; stretches: ApplyStretchUnit[]; systems: ApplySystemUnit[]; choices: ApplyRevert[] };
