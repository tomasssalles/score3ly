// `review` (docs/stages/music.md): one call per system, which compares the transcription with the printed page and
// writes issues only, never the music: choices on the issues of its system, and new issues for every correction it
// wants. Every call gets the whole score, the issues and the warnings as they were when the stage started, and the
// changes the stage's earlier calls made (an append-only log), in that order, so that a call's prompt starts with the
// one before it and the provider's prompt cache serves the shared part; then its own system: the crops with the
// issues' boxes drawn on them, and a request. Code checks the answer as soon as it arrives (apps/web/src/review.ts).

import { described, LENS_SCHEMA_PARTS as P, lensRecap, MUSIC } from "./extract.ts";
import { issueFromModel, orNull } from "./lensForm.ts";

// Raise whenever the texts or the schema change.
export const REVIEW_PROMPT_VERSION = 7;

export const REVIEW_MAX_OUTPUT_TOKENS = 16_000;

export const REVIEW_SYSTEM = `You review a transcription of printed music against the page, one system at a time. Another model transcribed the score system by system into a compact format; you check it against the images and say where it is wrong or doubtful. You never rewrite the music: you choose answers of the existing questions about the page ("issues"), and raise new issues for every correction you want. A later stage applies the chosen answers to the transcription.

Your understanding of music is how you read well: it fills gaps and decides what isn't fully clear on the page. But where the page is clear, what is printed wins over what would be likely, and a transcription that is unusual but matches the page is right.

## What you get
1. **The score:** the whole transcription, in the format below, as JSON: for each piece its staves and voices, and for each system its staves, groups and stretches, each stretch with **measure**, the number code gave the measure it belongs to (the numbers everything else uses; -1 for none), and the music of its voices. A stretch's **class** says whether it starts a measure and of which kind ("new-normal", "new-incomplete", "new-unmeasured"), or is part of the measure before it ("continues") or of none ("none"); its **ending** is the "1." / "2." bracket over it ("none", "start", "middle", "end", "whole": where it starts and ends), with its **endingLabel** as printed where visible. Observations from an earlier look at the pages follow it: hints, not ground truth.
2. **The issues and the warnings,** as they were when this review started. An issue is a question about what the page says at a place: **places** (the systems and stretches its boxes cover), **location** and **question**, **answers** with keys "a", "b", …, **choices** (who chose which answer so far, in order: the latest counts), **applied** (the answer the transcription reflects now; null when that isn't known), **resolved** (a person decided it: it is settled), and for a format issue **lilypond** (the tokens that would express what is printed). A warning is something code found wrong with the transcription itself (durations that don't add up, measure numbers that don't match): never answered, but a pointer to a likely mistake (see "What to look for").
3. **What this review's earlier calls changed,** one entry per change, in order. Take them into account: they are part of the issues now.
4. **Your system:** its crop ("System 17:"), a crop of each of its stretches with generous margins ("System 17, stretch 2:"), the previous and the next system for context, all with the boxes of the issues on them drawn in colour and labelled with the issue's id; then a request: the system, the issues and warnings on it, and **links**: what on this system belongs with something elsewhere (an end repeat and where it goes back to, the endings of a repeat, a slur or pedal crossing into or out of the system and where its other end is).

**Stretches:** code cut each system at its bar lines. Stretch 1 runs from the start of the system to the first bar line, stretch k from bar line k - 1 to bar line k. A stretch is usually a measure, but not always: a measure can be split across systems or by a repeat bar line in its middle, and courtesy signatures at the end of a system belong to no measure.

## What to look for
Compare every stretch of your system with its crop, note by note, mark by mark. The commonest mistakes, foremost:
- **Slurs, ties and other marks with two ends** (hairpins, ottavas, pedal, trill lines), above all where they cross a bar line or a system break: one missing, ended too early or too late, or ending on the wrong note. Follow each one on the crops to its end, and check the links.
- **Pitches:** a note a line or space off, a missing or invented accidental (the format writes the accidentals printed, not the pitches meant: a note made flat by the key signature has no accidental).
- **Rhythm:** a wrong duration, a missing dot, an invented note or rest, a tuplet that isn't printed.
- **Marks:** a staccato that is a smudge, a smudge that is a staccato, a missing accent, fermata, dynamic or fingering.
- **Structure:** a stretch read as starting a measure where it continues one, a wrong bar line or ending, a wrong clef, key or time.
Read first, compare afterwards: never trust a passage because it seems to repeat another.

**Follow up every warning on your system.** A warning is about the transcription, not the page, so it can't be answered; but it usually points at a mistake. Look at its place on the crops: where the transcription is wrong there (the durations don't add up because a note was invented, or a dot was missed), raise a new issue that corrects it, about what the page shows there, like any other. Where the page itself is the reason (a measure printed short), leave it.

**A text with no value is the empty string "", and a number with no value -1,** in the score and in your answer, never null (only an issue's **applied** is null, where it isn't known).

## Your answer: a list of entries, in any order
- **A choice** on an existing issue: \`{ "choice": { "issue": 12, "key": "b", "newAnswer": "", "reason": "" } }\`.
  - Only on issues with a box on your system, and never on a resolved one.
  - **key** an existing answer, or **newAnswer** the text of an answer that isn't in the list (it gets the next letter): exactly one of them, the other "". At most one new answer per issue.
  - **It must change the chosen answer:** where you agree with the latest choice, leave the issue alone; that counts as agreement.
  - **reason:** "", unless it adds something a reader wouldn't see by themselves: "measure 23 is the same figure and there it's clearly a D", "the same spot appears on several notes nearby, so it is paper ageing, not a staccato". "I think it's a D" adds nothing.
- **A new issue,** for every correction you want, and for every doubt or gap of the format nobody raised: \`{ "newIssue": { … } }\` with
  - **Never about what a resolved issue settled:** a person decided it, and their answer is the truth, even where you would read the page otherwise. Don't raise the same question again in other words, and don't raise one whose answer would change what the resolved issue says.
  - **boxes:** one or more, each on one of the images you were sent, named by its label ("system", "stretch 3", "previous system", "next system"), as fractions of that image (left, right, top, bottom from 0 to 1). At least one on your system; others may be on the previous or the next system, not both.
  - **location:** what in the box is meant, when the box alone doesn't say: simple and local to the box ("the middle note of the chord"), never depending on a reading of the score. Else "".
  - **question**, and **answers** with keys "a", "b", "c", …: at least two, one for what the transcription has now and one for what you think is right, with others where they are reasonable.
  - **applied:** the key of the answer the transcription has now; **chosen:** the key of the one you think is right. They differ.
  - **reason:** as for a choice.
  - **class:** "reading" when what the page says is hard to tell or the transcription misread it; "format" when the page is clear but the format can't express it, and then **lilypond** lists the LilyPond tokens that would (e.g. ["\\\\harmonic"]), or is empty when no new token would (the tokens exist, but the format's rules don't allow what is printed, e.g. a beam across a bar line); for a reading issue it is always empty. Format issues cost nothing and are wanted.
- **People read them too:** the questions, locations, answers and reasons are shown to the user in the app. Write them as plain sentences a musician understands without the request, each starting with a capital letter, naming places by measure ("m. 23") or by what is printed, not by stretch numbers. **Never refer to the transcription** ("as transcribed", "the current reading", "what you wrote"): a later stage may apply another answer, and the text would then be wrong. Say only what the page might show: "A D", not "A D, as transcribed".
- An empty list is a fine answer for a clean system.

${MUSIC}

${lensRecap(false)}`;

// The parts of a call's prompt, in order: the score (with the observations), the issues and warnings, an entry of the
// log per earlier call that changed something, the system's own request (after its images).
export function reviewScoreText(score: unknown, observations: unknown): string {
  return `The score:\n${JSON.stringify(score)}\n\nObservations from an earlier look at the pages:\n${JSON.stringify(observations)}`;
}

export function reviewIssuesText(issues: unknown, warnings: unknown): string {
  return `The issues when this review started:\n${JSON.stringify(issues)}\n\nThe warnings of this transcription:\n${JSON.stringify(warnings)}`;
}

export function reviewLogText(system: number, entries: unknown[]): string {
  return entries.map((entry) => JSON.stringify({ by: `this review, system ${system}`, ...(entry as object) })).join("\n");
}

export function reviewText(request: unknown): string {
  return `Review this system. The request:\n${JSON.stringify(request)}`;
}

const str = { type: "string" };
const int = { type: "integer" };

function object(properties: Record<string, unknown>) {
  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
}

const reason = described(str, '"", unless it adds something a reader wouldn\'t see by themselves.');

export const REVIEW_SCHEMA = object({
  entries: described(
    {
      type: "array",
      items: {
        anyOf: [
          object({
            choice: described(
              object({
                issue: described(int, "The issue's id."),
                key: described(str, 'An existing answer\'s key, or "" when you give newAnswer.'),
                newAnswer: described(str, 'The text of an answer that isn\'t in the list, or "" when you give key. Exactly one of key and newAnswer.'),
                reason,
              }),
              "A choice on an existing issue with a box on your system, never a resolved one. It must change the chosen answer.",
            ),
          }),
          object({
            newIssue: described(
              object({
                boxes: described(P.issueBoxes, "One or more boxes, each on one of the images you were sent; at least one on your system."),
                location: P.location,
                question: described(str, 'What the page says at this place, as a plain sentence a musician understands, naming places by measure ("m. 23"). Never refers to the transcription.'),
                answers: described(
                  { type: "array", items: object({ key: P.answerKey, text: P.answerText }) },
                  "At least two: one for what the transcription has now, one for what you think is right.",
                ),
                applied: described(str, "The key of the answer the transcription has now."),
                chosen: described(str, "The key of the answer you think is right. It differs from applied."),
                reason,
                class: P.issueClass,
                lilypond: P.lilypond,
              }),
              "A new issue, for a correction you want or a doubt or gap of the format nobody raised. Never about what a resolved issue settled.",
            ),
          }),
        ],
      },
    },
    "Your choices and new issues, in any order; an empty list for a clean system.",
  ),
});

// The answer, as the code uses it: the model writes "" for a text with no value and an empty list of tokens on a reading
// issue, which reviewFromModel makes null.
export type ReviewBox = { image: string; box: { left: number; right: number; top: number; bottom: number } };
export type ReviewChoiceEntry = { choice: { issue: number; key: string | null; newAnswer: string | null; reason: string | null } };
export type ReviewNewIssueEntry = {
  newIssue: {
    boxes: ReviewBox[];
    location: string | null;
    question: string;
    answers: { key: string; text: string }[];
    applied: string;
    chosen: string;
    reason: string | null;
    class: "reading" | "format";
    lilypond: string[] | null;
  };
};
export type ReviewAnswer = { entries: (ReviewChoiceEntry | ReviewNewIssueEntry)[] };

// The answer as the schema has it, as the code uses it: its texts with no value null, a reading issue's empty list of
// tokens null. Whatever isn't of the expected form is left as it is, for the checks.
export function reviewFromModel(json: unknown): unknown {
  if (typeof json !== "object" || json === null || !Array.isArray((json as ReviewAnswer).entries)) return json;
  const entries = (json as { entries: unknown[] }).entries.map((e) => {
    if (typeof e !== "object" || e === null) return e;
    const entry = e as Record<string, unknown>;
    if (entry.choice) return { ...entry, choice: orNull(entry.choice, ["key", "newAnswer", "reason"]) };
    if (entry.newIssue) return { ...entry, newIssue: orNull(issueFromModel(entry.newIssue), ["reason"]) };
    return entry;
  });
  return { ...json, entries };
}
