// The symbolic format as every music stage's prompt describes it (docs/notation.md, "The token list"): the music of a
// voice (MUSIC), and the recap of where it differs from LilyPond (lensRecap). `extract`, `review` and `apply_review`
// share them.

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
