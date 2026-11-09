// `extract` (docs/stages/music.md): one call per system, which reads the music printed in it and writes it in the lens (JSON
// with strings in the symbolic format). The model gets the system's crop, a crop of each stretch with generous
// margins, the crops of the previous and the next system, and a request in the same field names as its answer: the
// stretches to fill, the piece's staves and voices so far, what the previous system left open, and what `analyze`
// saw, as hints. Code checks the answer as soon as it arrives (@score3ly/notation).

import { ENDING_VALUES, GROUP_SYMBOL_VALUES, RIGHT_BAR_LINES, STRETCH_CLASS_VALUES } from "./lensForm.ts";
import {
  ACCENT_DYNAMICS,
  ACCIDENTALS,
  ARTICULATIONS,
  CLEFS,
  FINGERS,
  GRACES,
  GRADED_DYNAMICS,
  JUMPS,
  NAVIGATION_SIGNS,
  NOTE_VALUES,
  ORNAMENTS,
  OTHER_MARKS,
  PEDAL,
  STEMS,
  TRILL_SPAN,
} from "@score3ly/notation/symbolic";

// Raise whenever the texts or the schema change. The format itself has its own version (LENS_VERSION).
export const EXTRACT_PROMPT_VERSION = 6;

export const EXTRACT_MAX_OUTPUT_TOKENS = 32_000;

// The labels of the images sent, as issue boxes name them, in the order they are sent.
export function extractImageLabels(stretches: number, previous: boolean, next: boolean): string[] {
  return [
    "system",
    ...Array.from({ length: stretches }, (_, i) => `stretch ${i + 1}`),
    ...(previous ? ["previous system"] : []),
    ...(next ? ["next system"] : []),
  ];
}

// A command as the prompt shows it, `\name`, and a list of them.
const cmd = (name: string) => `\`\\${name}\``;
const cmds = (names: readonly string[], separator = " ") => names.map(cmd).join(separator);

// The symbolic format, as every music stage's prompt describes it. Its closed lists of tokens come from the parser's
// (@score3ly/notation/symbolic), so the two can't drift apart (docs/notation.md, "The token list"); a test checks
// that every command shown is one the parser knows, and that every one it knows is shown.
export const MUSIC = `## The music of a voice

Each voice of each stretch is one string: LilyPond with these differences. Write only what is listed here: the parser rejects anything else. Spaces are as in LilyPond (\`<c' e'>4\`, \`c'4-.\\=1(\` and \`c'4 -. \\=1(\` are all fine). Quoted text runs to its closing quote, spaces included; \`\\"\` is a quote inside it.

### Notes, rests, chords
- **Note:** letter, octave, duration: \`g'4.\`. Octaves are absolute (LilyPond's absolute mode): \`c'\` is middle C, \`c''\` the C above, \`c\` the C below, \`c,\` the one below that. Name the note from its place on the staff and the current clef.
- **Accidentals are printed symbols, never part of the name** (no \`fis\`, \`bes\`). Write each printed accidental as a token right before its note: ${cmds(ACCIDENTALS, ", ")}. Write exactly the accidentals printed, courtesy ones included (without their parentheses), and none that aren't: a G that sounds G♭ because of the key signature or an earlier accidental is written \`g\`. Code works out the sounding pitch.
- **Durations:** \`${NOTE_VALUES.join(" ")}\`, with dots. Every note and rest has its own; never leave one out.
- **Rests:** \`r4\` printed, \`s4\` invisible (the voice has nothing there and no rest is printed). A whole-measure rest has the measure's duration (\`R1\` in 4/4, \`R2.\` in 3/4); a multi-measure rest adds the count (\`R1*12\`), and then every voice of the stretch is the same multi-measure rest.
- **Chords:** \`<c' \\flat e' g'>4\`, the duration after \`>\`. Inside the brackets, after a note, only that note's own marks: its fingering and its curves (\`<c'\\=1( e'\\=2(>4\`).

### Marks, after the note, rest or chord they belong to
- **Curves:** every tie, slur and phrasing slur is a curve, \`\\=N(\` where it starts and \`\\=N)\` where it ends. A new curve takes any number not open at that moment in its voice; an open curve keeps its number until it ends, also across bar lines and systems (close the curves the request lists as open with their numbers). Never \`~\`, \`(\` or \`\\(\`. Curves are on notes and chords, never on rests.
- **Articulations:** ${Object.entries(ARTICULATIONS).map(([sign, name]) => `\`-${sign}\` (${name})`).join(" ")} \`\\fermata\`
- **Ornaments:** ${cmds(ORNAMENTS)}; a trill line ${cmds(TRILL_SPAN, " … ")}
- **Other:** ${cmds(OTHER_MARKS)} (a tie to nothing, "let ring")
- **Fingering:** \`-${FINGERS[0]}\` to \`-${FINGERS[FINGERS.length - 1]}\`
- **Dynamics:** ${cmd(GRADED_DYNAMICS[0])} … ${cmd(GRADED_DYNAMICS[GRADED_DYNAMICS.length - 1])}, ${cmds(ACCENT_DYNAMICS)}; hairpins \`\\<\` \`\\>\`, ended by \`\\!\` or the next dynamic. A dynamic or hairpin printed between the two staves of a braced instrument (piano, harp, organ): write it in a voice of the upper staff, below it with \`_\` (\`c'4_\\p\`); it applies to both staves. Every other dynamic applies to its own staff. Dynamics in words ("cresc.", "dim.", "p dolce") are quoted text, as printed.
- **Beams:** \`[\` after the first note, \`]\` after the last
- **Tremolo on one note:** on its duration, \`c'4:32\`
- **Pedal:** ${cmds(PEDAL)}
- **Navigation:** a jump instruction as quoted text, exactly one of ${JUMPS.map((j) => `\`"${j}"\``).join(", ")}. A printed instruction not on the list: the closest one, and a format issue naming the printed text
- **Text:** \`^"dolce"\` above, \`_"rit."\` below, \`-"…"\` either. Placement prefixes (\`-\`, \`^\`, \`_\`) are allowed on every mark.

### Between notes, where they are printed
- **Pauses:** \`\\breathe\` (a breath mark), \`\\caesura\` (a full stop of the music, //): \`c4 \\breathe d4\`
- **Navigation signs:** ${cmds(NAVIGATION_SIGNS, ", ")} where the sign or "Fine" is printed
- **Tempo marks:** \`\\tempo\` as in LilyPond, where the mark is printed, with its text as printed, its metronome mark, or both: \`\\tempo "Allegro" 4 = 132\`, \`\\tempo 4. = 60\`, \`\\tempo 4 = 120-132\` (a range), \`\\tempo "Andante"\`, \`\\tempo "a tempo"\`. Words such as "ca." or "M.M." go in the text; the metronome mark never does (not \`\\tempo "Allegro ♩ = 132"\`). Gradual changes ("rit.", "accel.") aren't tempo marks: quoted text. An equation at a change of metre (♩ = ♩.) can't be written: quoted text, and a format issue. Where the same mark is printed above several staves (an orchestral score), write it on each of them.

### Commands, before the notes they apply to
- \`\\clef\` with ${CLEFS.map((c) => `\`${c}\``).join(", ")}, and octave suffixes in quotes (\`\\clef "treble_8"\`, \`"bass^8"\`, \`_15\`, \`^15\`). A clef change is always written here, also at the start of a stretch; the clefs at the system's start are in the JSON.
- \`\\ottava #1\` (8va), \`#-1\` (8vb), \`#2\` (15ma), \`#-2\` (15mb); \`\\ottava #0\` ends it. Write the notes where they are printed under the line; code transposes them.
- \`\\change Staff = "3"\`: the following notes are on staff 3 (the staff's number in the piece), until the next change.
- ${cmds(STEMS)}, only where the stem direction separates voices or hands.
- \`\\tuplet 3/2 { … }\` (not nested), \`\\repeat tremolo 4 { c'16 e'16 }\` (two alternating notes)
- ${cmds(GRACES, ", ")}, before one note or \`{ … }\`

**Clef, ottava, pedal, breath marks, caesuras, navigation and tempo marks belong to the staff:** write them in the voice they are printed at, in their place above; they apply to every voice on that staff (a caesura and navigation to every staff).

**Brackets close in the stretch where they open:** beams \`[ ]\`, tuplets, grace groups and tremolos \`{ }\`. If a beam or tuplet crosses a bar line, split it there and raise a format issue. Curves, hairpins, ottavas, pedal and trill lines may continue into the next stretch, and into the next system.

**If something printed can't be written with these tokens,** write your best workaround and raise a format issue.`;

// The recap at the end of every prompt that writes or reads the music (docs/notation.md, "The token list"): where the
// format differs from LilyPond, which models know well and fall back on, each rule with wrong and right examples. A test
// checks that every wrong example fails to parse and every right one parses.
// `parses`: its wrong examples are valid, only not what the page says.
export const LENS_PITFALLS: { rule: string; wrong: string[]; right: string[]; after?: string; sub?: true; parses?: true }[] = [
  { rule: "**No accidentals in note names.** A printed accidental is a token before its note, and only where it is printed:", wrong: [], right: [] },
  { sub: true, rule: "an F that sounds F♯ only because of the key signature (G major):", wrong: ["fis'4"], right: ["f'4"] },
  { sub: true, rule: "an F with a sharp printed before it:", wrong: ["fis'4"], right: ["\\sharp f'4"] },
  { sub: true, parses: true, rule: "the same F again later in the measure, with no sharp printed before it:", wrong: ["\\sharp f'4 \\sharp f'4"], right: ["\\sharp f'4 f'4"] },
  { sub: true, rule: "flats the same way:", wrong: ["bes4", "ees'4"], right: ["\\flat b4", "\\flat e'4"] },
  { rule: "**Absolute octaves, never `\\relative`:** `c'` is always middle C.", wrong: ["\\relative c' { c4 e4 g4 }"], right: ["c'4 e'4 g'4"] },
  { rule: "**Every note and rest has its own duration,** never carried over from the one before.", wrong: ["c'4 d' e' r"], right: ["c'4 d'4 e'4 r4"] },
  { rule: "In a chord, the duration goes after `>`:", wrong: ["<c'4 e'4>"], right: ["<c' e'>4"] },
  {
    rule: "**Ties and slurs are numbered curves,** closed with the number they opened with (curves left open by the previous system keep theirs).",
    wrong: ["c'2~ c'2", "c'4( d'4)", "c'4\\( d'4\\)"],
    right: ["c'2\\=1( c'2\\=1)", "c'4\\=1( d'4\\=1)"],
  },
  { rule: "**One voice per string:** no simultaneous voices inside a string; each voice is its own entry in `voices`.", wrong: ["<< { c''4 } \\\\ { a'4 } >>", "\\voiceOne c''4"], right: ["c''4"] },
  {
    rule: "**Only the tokens listed above.**",
    wrong: ["\\key g \\major c'4", "\\time 3/4 c'4", "\\bar \"||\" c'4", "\\partial 4 c'4", "\\times 2/3 { c'8 d'8 e'8 }", "c'4-\\markup { dolce }", "c'4 % comment"],
    right: ["\\tuplet 3/2 { c'8 d'8 e'8 }", "c'4^\"dolce\""],
    after:
      "Key and time signatures go in the JSON (the staves at the system's start, `changes` on a stretch), bar lines in `rightBarLine`, a pickup is a stretch of class \"new-incomplete\". A clef change is the exception: `\\clef bass` in the string.",
  },
];

const code = (examples: string[]) => examples.map((e) => `\`${e}\``).join(", ");

// `writes`: the stage writes music (`extract`, `apply_review`); otherwise it reads it (`review`).
export function lensRecap(writes: boolean): string {
  const examples = (p: (typeof LENS_PITFALLS)[number]) => (p.wrong.length > 0 ? ` ✗ ${code(p.wrong)} ✓ ${code(p.right)}` : "");
  const lines = LENS_PITFALLS.map((p) => `${p.sub ? "  " : ""}- ${p.rule}${examples(p)}${p.after ? ` ${p.after}` : ""}`);
  const json = writes
    ? `

**In the JSON:** "" means no value, but a staff or a voice that is new in the piece (not in the lists you were given) needs its description, never "". Every staff has a voice in every stretch that is part of a measure (with \`s\` or \`R\` where it has no notes).`
    : "";
  const intro = writes
    ? "Check every string you write against these before you answer: one mistake makes the whole answer unusable."
    : "Read the transcription with these in mind: `f'` in G major is an F♯, and a sharp printed earlier in the measure carries on to the same note.";
  return `## Before you answer: where this format differs from LilyPond
The format looks like LilyPond, but differs where LilyPond's habits are strongest. ${intro} (✗ wrong, ✓ right.)

${lines.join("\n")}${json}`;
}

export const EXTRACT_SYSTEM = `You transcribe printed music exactly, one system at a time, so that code can build a faithful encoding of the score. You report the symbols that are printed, and code works out what they mean. Your understanding of music is how you read well: it fills gaps and decides what isn't fully clear on the page (a smudged accidental, a faint note). But where the page is clear, what is printed wins over what would be likely.

## What you get
- Images, each after a label: the system ("System 17:"), then each of its stretches with generous margins, so that a slur crossing a bar line shows where it ends ("System 17, stretch 2:"), and the previous and the next system, for context only ("Previous system (16):", "Next system (18):").
- A request (JSON, below the images) in the same field names as your answer: the system's number and how many stretches it has; the piece's staves and voices so far; the clefs, keys and times in effect when the system begins; the marks left open by the previous system; whether the previous system's last measure continues here; and hints from an earlier look at the whole score.

**Stretches:** code cut the system at its bar lines. Stretch 1 runs from the start of the system to the first bar line, stretch k from bar line k - 1 to bar line k, and the last from the last bar line to the end of the system. You fill exactly these stretches, no more, no less. A stretch is usually a measure, but not always: a measure can be split across systems, or by a repeat bar line or a double bar in its middle, and courtesy signatures at the end of a system come after the last bar line and belong to no measure.

**Hints are hints, never ground truth:** the observations of the whole score and of this system (each with its confidence, or "confirmed" when a person checked it: then you can rely on it), the staves and voices so far, what the previous system said continues or left open. They are the current best guess, given to help. Where the page clearly says otherwise, trust your eyes, and where you contradict a hint, say so in an issue.

## What is music, and what is typesetting
Transcribe the music, never its appearance. The test: would a player read it differently? If yes, it is musical and is encoded exactly as printed: pitches, rhythms, rests, voices, which hand plays what, ties, slurs (one per chord note where there are several), articulations, dynamics and hairpins with the notes they start and end on, ottava extents, clefs, repeats, beam grouping, and stem direction where it separates voices or hands. Typesetting is ignored: spacing, the shapes of slurs and beams, the exact height of marks, fonts, the default stem direction of a single voice. Attach every dynamic, hairpin, articulation and slur to the notes it applies to; never let the layout influence what you encode (never attach a crescendo to a pedal line because it would print lower); never simplify to suit the format.

## Your answer
**A text with no value is the empty string ""**, never null (a description, a label, a time, a printed number, a location), and a number with no value is -1.

- **startRepeat:** whether the system begins with a start-repeat bar line (not the line that joins the staves at the left edge).
- **staves:** the system's staves, top to bottom, each with:
  - **staff:** its number in the piece: the number of a staff from the request's list that continues here, or a new number for a staff that is new (a staff that comes back after systems without it takes its old number);
  - **description:** for a new staff, a short description ("piano right hand", "violin I", "orchestra reduction"); "" for a staff from the list;
  - **label:** the instrument name printed at its left, as printed, or "";
  - **clef**, **key** and **time** as printed at the system's start: the clef (LilyPond's names), the key signature as the number of sharps or flats ("0", "1s" … "7s", "1f" … "7f"; no mode), and the time signature as printed ("3/4", "6/8", "C", "C|", "3+2/8"), or "" when none is printed there. Clefs and key signatures are printed on every system: report them as you see them, never "as before". The first system of a piece has a time signature on every staff.
- **groups:** the braces and brackets that join staves, as printed: the staves' numbers, the symbol ("brace", "bracket", "bracketsq", "line") and its label (e.g. "Piano I") or "".
- **stretches:** one per stretch, in order, each with:
  - **stretch:** its number;
  - **class:** whether the stretch starts a measure, and of which kind:
    - "new-normal", "new-incomplete", "new-unmeasured": it starts a measure, which is normal, incomplete (a pickup, or the short measure that completes one before a repeat or at the end of a section) or unmeasured (a cadenza, a passage without bar lines);
    - "continues": it is part of the same measure as the stretch before it that is part of a measure, even on the previous system;
    - "none": part of no measure, e.g. courtesy signatures at the end of the system;
  - **printedNumber:** a measure number printed at the stretch, as printed (e.g. "12", "12-16"), else ""; **measureNumber:** the number it gives the measure, e.g. 12, or -1;
  - **changes:** key and time signatures printed at the stretch's start, per staff (\`{ "staff": 1, "key": "2f", "time": "3/4" }\`, "" for what doesn't change), an empty list where there are none. Clef changes are never here: they are \`\\clef\` in the strings. A courtesy signature at the end of a system goes on the "none" stretch that holds it;
  - **ending:** the "1." / "2." bracket over the stretch: "none" (no ending over it), "start" (an ending starts here and runs on into the next stretch), "middle" (it runs on from the stretch before and into the next), "end" (it runs on from the stretch before and ends here), or "whole" (it starts and ends here); **endingLabel:** the ending's label as printed where it is visible over this stretch ("1.", "2."), else "";
  - **voices:** the music, one entry per voice: **voice** (its id in the piece: from the request's list where it continues, a new number otherwise; traditionally 1 the upper voice, stems up, 2 the lower), **staff** (the staff it starts on), **description** (for a new voice, where it first appears: a short description, "melody", "inner alto line", "left-hand bass"; else "") and **music** (a string, below). Every staff has a voice in every stretch that is part of a measure: where a staff has no notes, a voice with \`s\` or \`R\` of the stretch's length. All voices of a stretch last the same time. A "none" stretch has no notes or rests (an empty list, or voices with only a \`\\clef\`);
  - **rightBarLine:** the bar line at the stretch's right: "single", "double", "final", "startRepeat", "endRepeat", "bothRepeats", "dashed", or "none" (the last stretch, when the system ends without a bar line).
- **lastMeasureContinues:** whether the system's last measure continues on the next system.
- **issues:** your doubts and what the format can't express (below).

${MUSIC}

## Issues
Report every doubt as an issue, not silently: a question about what the page says at one place, with the answers you considered, each with its evidence ("dot near the A♭: staccato or smudge?"), and **applied**: the key of the answer your music reflects. Answers have keys: "a", "b", "c", …
- **boxes:** where it is: one or more boxes, each on one of the images you were sent, named by its label ("system", "stretch 3", "previous system", "next system"), as fractions of that image (left, right, top, bottom from 0 to 1).
- **People read them too:** the question, the location and the answers are shown to the user in the app, not only to the stages after you. Write them as plain sentences that a musician understands without the request: each starts with a capital letter. **Never refer to the transcription** ("as transcribed", "the current reading", "what you wrote"): a later stage may apply another answer, and the text would then be wrong. Say only what the page might show: "A D", not "A D, as transcribed".
- **location:** what in the box is meant, when the box alone doesn't say: simple and local to the box ("the middle note of the chord"), never depending on your reading of the score ("the left hand on beat 3"). Else "".
- **class:** "reading" when what the page says is hard to tell; "format" when the page is clear but the format can't express it (a mark that isn't in the list, lyrics, an ossia, a beam across a bar line). For a format issue, the answers are the workarounds (dropping the mark is one), and **lilypond** lists the LilyPond tokens that would express what is printed (e.g. ["\\\\harmonic"]), or is empty when no new token would (the tokens exist, but the format's rules don't allow what is printed, e.g. a beam across a bar line); for a reading issue it is always empty. Format issues cost nothing and are wanted.

## How to read
- Read first, compare afterwards: transcribe a stretch from the image before you look at any passage it seems to repeat. The differences are then things to look at again, never a reason to copy.
- Plan ahead within the system: follow every long mark (slur, hairpin, ottava, pedal) to its end before you write it down. Slurs and ties crossing bar lines and system breaks are the commonest mistake: look at the margins of the stretch crops and at the next system.
- A checklist per note: its accidental, dots, accents, fingering, where its slurs start and end.
- No unprinted tuplets: if the durations don't add up, read again; if they still don't, raise an issue.
- Telling marks from smudges is the hard part: neither keep every speck nor drop marks by default; raise an issue where you are unsure.
- Only the main text: ignore ossias and other alternative versions of a passage (an ossia is a format issue).

${lensRecap(true)}`;

// The request's text, after the images: the request itself as JSON.
export function extractText(request: unknown): string {
  return `Transcribe this system. The request:\n\n${JSON.stringify(request, null, 1)}`;
}

const str = { type: "string" };
const int = { type: "integer" };
const bool = { type: "boolean" };
const enumOf = (values: readonly string[]) => ({ type: "string", enum: [...values] });

function object(properties: Record<string, unknown>) {
  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
}

// The answer's schema has no nullable field: the lens as the models write it (lensForm.ts), which lensFromExtract turns
// into the lens as code uses it.
export const EXTRACT_SCHEMA = object({
  startRepeat: bool,
  staves: {
    type: "array",
    items: object({ staff: int, description: str, label: str, clef: str, key: str, time: str }),
  },
  groups: {
    type: "array",
    items: object({ staves: { type: "array", items: int }, symbol: enumOf(GROUP_SYMBOL_VALUES), label: str }),
  },
  stretches: {
    type: "array",
    items: object({
      stretch: int,
      class: enumOf(STRETCH_CLASS_VALUES),
      printedNumber: str,
      measureNumber: int,
      changes: { type: "array", items: object({ staff: int, key: str, time: str }) },
      ending: enumOf(ENDING_VALUES),
      endingLabel: str,
      voices: { type: "array", items: object({ voice: int, staff: int, description: str, music: str }) },
      rightBarLine: enumOf(RIGHT_BAR_LINES),
    }),
  },
  lastMeasureContinues: bool,
  issues: {
    type: "array",
    items: object({
      boxes: {
        type: "array",
        items: object({ image: str, box: object({ left: { type: "number" }, right: { type: "number" }, top: { type: "number" }, bottom: { type: "number" } }) }),
      },
      location: str,
      question: str,
      answers: { type: "array", items: object({ key: str, text: str }) },
      applied: str,
      class: enumOf(["reading", "format"]),
      lilypond: { type: "array", items: str },
    }),
  },
});
