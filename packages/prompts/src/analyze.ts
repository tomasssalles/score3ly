// `analyze` (docs/stages/analyze.md): what the pages say, as metadata and observations for the extraction. One call per page,
// each page on its own (the clean page, and the page with the layout drawn on it: systems numbered in the whole score,
// bar lines numbered within their system), then one call for the whole score that merges the pages' results. Places
// are named by the labels drawn on the pages: "system 17, bar line 4", "system 17, stretch 2", "system 17, end".

// Raise whenever the texts or the schemas change: what is sent. The checks (analyzeChecks.ts) and the conversions
// (analyzeForm.ts) are code: a change to them raises the step's version, ANALYZE_VERSION (apps/web/src/analyze.ts).
export const ANALYZE_PROMPT_VERSION = 7;

export const ANALYZE_PAGE_MAX_OUTPUT_TOKENS = 16_000;
export const ANALYZE_SCORE_MAX_OUTPUT_TOKENS = 32_000;

const SHARED = `You analyse pages of printed music (sheet music, usually for piano, sometimes for other instruments or voices), so that later steps can transcribe the music exactly. You report only what is printed on the pages, never what you know about the work from elsewhere: if the composer's name, an opus number or a date isn't printed, leave it out, even for a famous piece.

The pages come with their layout drawn on them: each system in a box of its own colour, labelled at its top left corner with its number in the whole score, and the bar lines inside it drawn in the same colour, each numbered within its system (1, 2, …) in a small label just above the box. The box's left and right edges stand for the system's start and end, which have no bar line drawn and no number. You name a system by its number, and a place in a system ("at") as one of:
- "start": the start of the system (the box's left edge), e.g. for a start repeat or a key signature at the beginning;
- "barLine" with its number: one of the bar lines drawn inside the system;
- "end": the end of the system (the box's right edge), e.g. for a final bar line;
- "stretch" with its number: the music between two of these. Stretch 1 runs from the start to bar line 1, stretch k from bar line k - 1 to bar line k, and the last from the last bar line to the end: a system with n bar lines drawn has n + 1 stretches (one stretch when it has none).
Give "number" 0 for "start" and "end". Read the numbers from the labels; don't count.

A staff is named by its position in its system: staff k of n, numbered from the top, where n is the number of staves you give for that system ("number": 2, "of": 3 for the middle staff of three).

Metadata: what is printed about the work and the edition, as one list of items, each with its category, its text as printed (keep the page's language and spelling), a system, and your confidence. Report each thing as you come to it, in any order. The categories:
- titles: mainTitle, subtitle, alternativeTitle (another title of the same work), translatedTitle (the title in another language, e.g. "Kinderscenen / Scènes d'enfants");
- people, by role: composer, arranger, editor, lyricist, librettist, translator, otherPerson; the text is the name. Where the printed role says more than the category does, or for otherPerson, add it after the name in parentheses, as printed ("H. Germer (Fingersatz)", "J. Schmidt (Stecher)");
- piece: a piece or movement, its title or number as printed. The only category with a system: the one where the piece starts. Every other category has system null;
- catalogueNumber (e.g. "Op. 15", "BWV 846", "No. 3"), dedication, instrumentation as printed (e.g. "für Klavier zu vier Händen");
- compositionDate: when or where the work was written, as printed (e.g. "komponiert 1838", "Wien, im März 1825"); rarely printed;
- the edition: publisher, editionPlace, editionDate (of its publication or printing, not of the composition), plateNumber (e.g. "E. 1234 B."), and notice (copyright, printer, anything else).

Give every item, metadata and observations alike, free texts too, your confidence in it: "high" when it is clearly legible or clearly right, "medium" when it is a reasonable guess (partly legible, an unusual spelling, a judgment you are unsure of), "low" when you are very unsure (stained, faded, cut off).

Observations of a page, for the later transcription. They are a bird's-eye view for someone who will transcribe one system at a time: close is useful, exact is better.
- systems: for every system on the page, its number of staves, and the probable instrument of each staff, top to bottom (e.g. "piano right hand", "violin", "voice");
- items: everything else, as one list, each item as you come to it, in any order. Every item has a kind, a text, a staff, a start, an end and your confidence; a field the kind doesn't use is null (the text empty). The kinds:
  - clef, key, time, tempo, otherChange: every clef, key signature and time signature at the start of the page's first system, and every change of them, or of tempo. Text: what it is ("bass clef", "G major", "3/4", "Allegro"); start: its place. A clef belongs to one staff: give it; for the others, give the staff only when the change is on one staff only, else null;
  - ottava (8va, 8vb, 15ma, …): text: the sign as printed; staff: its staff; start and end: where it starts and ends;
  - doubleBarLine, finalBarLine, startRepeat, endRepeat, startEndRepeat (start and end repeat together), dashedBarLine: special bar lines only, not the ordinary single ones. Start: its place, at the start, at a bar line or at the end of a system, never in a stretch;
  - ending (the brackets "1." and "2." of a repeat, or "1.-3."): text: its numbers as printed; start and end: where it starts and ends;
  - direction, such as "D.C. al Fine", "Fine", "D.S.", a segno, a coda sign: text: as printed; start: its place;
  - note: anything else that will help to transcribe the music: voices per staff, the texture, large-scale dynamics, a melody that repeats on the page, cross-staff writing, ossias, lyrics. Text only, brief, one note per thing.
An item at one place gives it as its start, and its end is null. Ottavas and endings can run on beyond the page: give their start as null when it is before this page, their end as null when it is after it, both null when one runs through the whole page. Report each thing once, where it is printed: don't join or link items to each other (a repeat is its bar lines and its endings).`;

export const ANALYZE_PAGE_SYSTEM = `${SHARED}

You see one page: first the page as it is, then the same page with its layout drawn on it. Use the first to read what the drawing might hide (repeat dots beside a bar line, text under a label), and the second for the labels. The page is one of several, and you don't see the others: report what this page shows, nothing else.`;

export function analyzePageText(page: number, systems: number[]): string {
  const which =
    systems.length === 0
      ? "It has no systems: there is no music on it, or none was found."
      : systems.length === 1
        ? `Its system is number ${systems[0]}.`
        : `Its systems are numbers ${systems[0]} to ${systems[systems.length - 1]}.`;
  return `This is page ${page} of the PDF. ${which} Analyse it.`;
}

export const ANALYZE_SCORE_SYSTEM = `${SHARED}

You see the whole score: every page with its layout drawn on it (in gray, small), and what was found on each page when it was analysed on its own, without the others. Combine them, resolving conflicts, and add what only the whole shows:
- metadata: one item per thing, from the pages' candidates, in the same categories. Where pages disagree, take the best reading: a title legible on the cover is better than the same title faded on a later page, which must not replace it, but a legible reading replaces an unsure one. Give each item the page it was read on and your confidence in it. Several titles may all be right (a title in two languages, a subtitle). Pieces or movements: each with the system where it starts.
- the pages' observations: every system and every item has an id. Don't repeat the ones that are right. Give edits and removals. Edits have systems and items, as a page's observations do, each with an id and a page: a correction is one with its id and page, and the whole system or item as it should be (a misread kind, a wrong place, a confidence that the other pages raise or lower); an addition, a system or item a page missed, has the id "" and its page (places on that page). Removals are the ids of those that are wrong or duplicated. An item open at a page's edge stays open: don't join it to its other part on the next page. If you correct a system's number of staves, correct every staff named on it too.
- observations about the whole score ("score"), one item per thing, each with its kind: instrumentation (which staves are which instrument, and where that changes, e.g. "systems 12-20 add a third staff, probably a voice: lyrics below it"), style, form, recurringMaterial (a theme that returns, a passage repeated note for note, with its places: a note hard to read in one place may be clear in another), and note (for the transcription: anything a person transcribing one system at a time should know about the rest). Only recurringMaterial has places; the others have none (an empty list).`;

export const ANALYZE_SCORE_TEXT = `These were the results of the pages, one by one (JSON; every metadata item has the page it was found on, every system and observation item its id). Combine them, looking at the pages above where you need to.`;
