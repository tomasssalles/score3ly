// `analyze` (DESIGN.md §6): what the pages say, as metadata and observations for the extraction. One call per page,
// each page on its own (the clean page, and the page with the layout drawn on it: systems numbered in the whole score,
// bar lines numbered within their system), then one call for the whole score that merges the pages' results. Places
// are the labels drawn on the pages: "system 17, bar line 4"; bar line 0 is the start of the system.

// Raise whenever the texts, the schemas or the checks change.
export const ANALYZE_PROMPT_VERSION = 1;

export const ANALYZE_PAGE_MAX_OUTPUT_TOKENS = 16_000;
export const ANALYZE_SCORE_MAX_OUTPUT_TOKENS = 32_000;

export const CONFIDENCES = ["low", "medium", "high"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export const TITLE_TYPES = ["main", "subtitle", "alternative", "translated"] as const;
// MEI's header has an element for each but "translator" and "other" (DESIGN.md §6, "Metadata").
export const ROLES = ["composer", "arranger", "editor", "lyricist", "librettist", "translator", "other"] as const;
export const SPECIAL_BAR_LINES = ["double", "final", "startRepeat", "endRepeat", "startEndRepeat", "dashed"] as const;
export const CHANGE_KINDS = ["clef", "key", "time", "ottava", "tempo", "other"] as const;

// The metadata fields that are plain text, besides titles, people and pieces.
export const TEXT_FIELDS = [
  "catalogueNumbers",
  "dedications",
  "instrumentation",
  "publishers",
  "places",
  "dates",
  "plateNumbers",
  "notices",
] as const;
export type TextField = (typeof TEXT_FIELDS)[number];

// What a page gives, or (with `page` on every item) what the whole score gives.
export type Metadata<Extra = object> = {
  titles: ({ text: string; type: (typeof TITLE_TYPES)[number]; confidence: Confidence } & Extra)[];
  people: ({ name: string; role: (typeof ROLES)[number]; printedRole: string; confidence: Confidence } & Extra)[];
  pieces: ({ title: string; system: number; confidence: Confidence } & Extra)[];
} & Record<TextField, ({ text: string; confidence: Confidence } & Extra)[]>;

export type PageMetadata = Metadata;
export type ScoreMetadata = Metadata<{ page: number }>;

export type Place = { system: number; barLine: number };

export type PageObservations = {
  systems: { system: number; staves: number; instruments: string[] }[];
  changes: (Place & { kind: (typeof CHANGE_KINDS)[number]; text: string })[];
  specialBarLines: (Place & { kind: (typeof SPECIAL_BAR_LINES)[number] })[];
  endings: {
    numbers: string;
    start: Place;
    end: Place;
    fromPreviousPage: boolean;
    toNextPage: boolean;
  }[];
  directions: (Place & { text: string })[];
  notes: string;
};

export type PageAnswer = { metadata: PageMetadata; observations: PageObservations };

export type ScoreObservations = {
  instrumentation: string;
  style: string;
  form: string;
  repeats: { from: Place; to: Place; endings: { numbers: string; start: Place; end: Place }[]; text: string }[];
  recurringMaterial: { description: string; places: Place[] }[];
  notesForExtraction: string;
};

export type ScoreAnswer = { metadata: ScoreMetadata; observations: ScoreObservations };

const SHARED = `You analyse pages of printed music (sheet music, usually for piano, sometimes for other instruments or voices), so that later steps can transcribe the music exactly. You report only what is printed on the pages, never what you know about the work from elsewhere: if the composer's name, an opus number or a date isn't printed, leave it out, even for a famous piece.

The pages come with their layout drawn on them: each system in a box of its own colour, labelled at its top left corner with its number in the whole score, and its bar lines drawn in the same colour, each numbered within its system in a small label just above the box. You name places with these labels: a system by its number, a place in a system by the number of the bar line it is at ("system 17, bar line 4"); bar line 0 is the start of the system, before its first bar line. Read the numbers from the labels; don't count.

Metadata fields, each as printed (keep the page's language and spelling):
- titles, each with its type: main, subtitle, alternative (another title of the same work), translated (the title in another language, e.g. "Kinderscenen / Scènes d'enfants");
- people, each with a role (composer, arranger, editor, lyricist, librettist, translator, other) and the role as printed ("Revidiert und mit Fingersatz versehen von", "Op. 15 von"); empty if no role is printed;
- pieces or movements, each with its title or number as printed and the system where it starts;
- catalogue numbers (e.g. "Op. 15", "BWV 846", "No. 3"), dedications, instrumentation as printed (e.g. "für Klavier zu vier Händen");
- the edition: publishers, places, dates, plate numbers (e.g. "E. 1234 B."), and other notices (copyright, printer).

Give every metadata item your confidence in your reading of it: "high" when it is clearly legible, "medium" when it is a reasonable guess (partly legible, or an unusual spelling you are unsure of), "low" when you are very unsure (stained, faded, cut off).`;

export const ANALYZE_PAGE_SYSTEM = `${SHARED}

You see one page: first the page as it is, then the same page with its layout drawn on it. Use the first to read what the drawing might hide (repeat dots beside a bar line, text under a label), and the second for the labels. The page is one of several, and you don't see the others: report what this page shows, nothing else.

Observations, for the later transcription:
- for every system on the page: its number of staves, and the probable instrument of each staff, top to bottom (e.g. "piano right hand", "violin", "voice");
- changes: every clef, key signature and time signature at the start of the page's first system, and every change of them, of an ottava (8va, 8vb, 15ma, loco), or of tempo, with its place;
- special bar lines only: double, final, start repeat, end repeat, start and end repeat together, dashed. Not the ordinary single bar lines;
- endings (the brackets "1." and "2." of a repeat, or "1.-3."): their numbers as printed, where each starts and ends, and whether it runs on from the previous page or on to the next;
- directions such as "D.C. al Fine", "Fine", "D.S.", a segno, a coda sign, with their place;
- notes: anything else that will help to transcribe the music: voices per staff, the texture, large-scale dynamics, a melody that repeats on the page, cross-staff writing, ossias, lyrics, the general style. Brief.`;

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

You see the whole score: every page with its layout drawn on it (in gray, small), and what was found on each page when it was analysed on its own. Combine them:
- metadata: one entry per thing, from the pages' candidates. Where pages disagree, take the best reading: a title legible on the cover is better than the same title faded on a later page, which must not replace it, but a legible reading replaces an unsure one. Give each entry the page it was read on and your confidence in it. Several titles may all be right (a title in two languages, a subtitle). Pieces or movements: in order, each with the system where it starts.
- observations about the whole: the instrumentation (which staves are which instrument, and where that changes), the style, the form, the repeats (from where to where, with their endings, which may span systems and pages), music that recurs (a theme that returns, a passage repeated note for note), and notes for the transcription: anything a person transcribing one system at a time should know about the rest.`;

export const ANALYZE_SCORE_TEXT = `These were the results of the pages, one by one (JSON; every metadata item has the page it was found on). Combine them, looking at the pages above where you need to.`;

const confidence = { type: "string", enum: [...CONFIDENCES] };
const str = { type: "string" };
const int = { type: "integer" };
const place = {
  type: "object",
  properties: { system: int, barLine: int },
  required: ["system", "barLine"],
  additionalProperties: false,
};

function object(properties: Record<string, unknown>) {
  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
}

function metadataSchema(withPage: boolean) {
  const extra = withPage ? { page: int } : {};
  const list = (properties: Record<string, unknown>) => ({ type: "array", items: object({ ...properties, ...extra }) });
  return object({
    titles: list({ text: str, type: { type: "string", enum: [...TITLE_TYPES] }, confidence }),
    people: list({ name: str, role: { type: "string", enum: [...ROLES] }, printedRole: str, confidence }),
    pieces: list({ title: str, system: int, confidence }),
    ...Object.fromEntries(TEXT_FIELDS.map((field) => [field, list({ text: str, confidence })])),
  });
}

export const ANALYZE_PAGE_SCHEMA = object({
  metadata: metadataSchema(false),
  observations: object({
    systems: { type: "array", items: object({ system: int, staves: int, instruments: { type: "array", items: str } }) },
    changes: {
      type: "array",
      items: object({ system: int, barLine: int, kind: { type: "string", enum: [...CHANGE_KINDS] }, text: str }),
    },
    specialBarLines: {
      type: "array",
      items: object({ system: int, barLine: int, kind: { type: "string", enum: [...SPECIAL_BAR_LINES] } }),
    },
    endings: {
      type: "array",
      items: object({ numbers: str, start: place, end: place, fromPreviousPage: { type: "boolean" }, toNextPage: { type: "boolean" } }),
    },
    directions: { type: "array", items: object({ system: int, barLine: int, text: str }) },
    notes: str,
  }),
});

export const ANALYZE_SCORE_SCHEMA = object({
  metadata: metadataSchema(true),
  observations: object({
    instrumentation: str,
    style: str,
    form: str,
    repeats: {
      type: "array",
      items: object({
        from: place,
        to: place,
        endings: { type: "array", items: object({ numbers: str, start: place, end: place }) },
        text: str,
      }),
    },
    recurringMaterial: { type: "array", items: object({ description: str, places: { type: "array", items: place } }) },
    notesForExtraction: str,
  }),
});

// What the checks need to know: the systems that can be named (by number) with their number of bar lines, and for
// the whole score, the pages.
export type AnalyzeContext = { systems: Map<number, number>; pages?: number[] };

type Problem = { problem: string };

// The places in an answer, with what they are, for the checks.
function placeProblem(p: Place, what: string, context: AnalyzeContext): string | null {
  const count = context.systems.get(p.system);
  if (count === undefined) return `${what}: there is no system ${p.system} here`;
  if (!Number.isInteger(p.barLine) || p.barLine < 0 || p.barLine > count) {
    return `${what}: system ${p.system} has no bar line ${p.barLine} (it has ${count})`;
  }
  return null;
}

function shapeProblem(value: unknown, schema: Record<string, unknown>, path: string): string | null {
  if (Array.isArray(schema.enum)) return schema.enum.includes(value) ? null : `${path} isn't one of ${schema.enum.join(", ")}`;
  switch (schema.type) {
    case "object": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) return `${path} isn't an object`;
      for (const [key, sub] of Object.entries(schema.properties as Record<string, Record<string, unknown>>)) {
        const problem = shapeProblem((value as Record<string, unknown>)[key], sub, path ? `${path}.${key}` : key);
        if (problem) return problem;
      }
      return null;
    }
    case "array": {
      if (!Array.isArray(value)) return `${path} isn't a list`;
      for (const [i, item] of value.entries()) {
        const problem = shapeProblem(item, schema.items as Record<string, unknown>, `${path}[${i}]`);
        if (problem) return problem;
      }
      return null;
    }
    case "string":
      return typeof value === "string" ? null : `${path} isn't text`;
    case "integer":
      return Number.isInteger(value) ? null : `${path} isn't a whole number`;
    case "boolean":
      return typeof value === "boolean" ? null : `${path} isn't true or false`;
    default:
      return null;
  }
}

function metadataProblem(metadata: Metadata<{ page?: number }>, context: AnalyzeContext): string | null {
  for (const piece of metadata.pieces) {
    if (!context.systems.has(piece.system)) return `the piece "${piece.title}" starts at system ${piece.system}, which isn't here`;
  }
  if (context.pages) {
    const items = [
      ...metadata.titles,
      ...metadata.people,
      ...metadata.pieces,
      ...TEXT_FIELDS.flatMap((field) => metadata[field]),
    ];
    const wrong = items.find((item) => !context.pages!.includes(item.page!));
    if (wrong) return `metadata names page ${wrong.page}, which isn't one of the pages`;
  }
  return null;
}

// A page's answer, checked: the expected shape, and every place on the page. Returns the reason it can't be used, or
// the answer.
export function checkPageAnswer(json: unknown, context: AnalyzeContext): PageAnswer | Problem {
  const shape = shapeProblem(json, ANALYZE_PAGE_SCHEMA, "");
  if (shape) return { problem: `the answer doesn't have the expected form: ${shape}` };
  const answer = json as PageAnswer;
  const o = answer.observations;
  for (const s of o.systems) {
    if (!context.systems.has(s.system)) return { problem: `there is no system ${s.system} on this page` };
    if (s.staves < 1) return { problem: `system ${s.system} has ${s.staves} staves` };
  }
  const places: [Place, string][] = [
    ...o.changes.map((c): [Place, string] => [c, `a ${c.kind} change`]),
    ...o.specialBarLines.map((b): [Place, string] => [b, `a ${b.kind} bar line`]),
    ...o.endings.flatMap((e): [Place, string][] => [
      [e.start, `ending ${e.numbers}`],
      [e.end, `ending ${e.numbers}`],
    ]),
    ...o.directions.map((d): [Place, string] => [d, `"${d.text}"`]),
  ];
  for (const [p, what] of places) {
    const problem = placeProblem(p, what, context);
    if (problem) return { problem };
  }
  const problem = metadataProblem(answer.metadata, context);
  return problem ? { problem } : answer;
}

// The whole score's answer, checked: the expected shape, every place in the score, every page among the pages.
export function checkScoreAnswer(json: unknown, context: AnalyzeContext): ScoreAnswer | Problem {
  const shape = shapeProblem(json, ANALYZE_SCORE_SCHEMA, "");
  if (shape) return { problem: `the answer doesn't have the expected form: ${shape}` };
  const answer = json as ScoreAnswer;
  const o = answer.observations;
  const places: [Place, string][] = [
    ...o.repeats.flatMap((r): [Place, string][] => [
      [r.from, "a repeat"],
      [r.to, "a repeat"],
      ...r.endings.flatMap((e): [Place, string][] => [
        [e.start, `ending ${e.numbers}`],
        [e.end, `ending ${e.numbers}`],
      ]),
    ]),
    ...o.recurringMaterial.flatMap((m) => m.places.map((p): [Place, string] => [p, "recurring material"])),
  ];
  for (const [p, what] of places) {
    const problem = placeProblem(p, what, context);
    if (problem) return { problem };
  }
  const problem = metadataProblem(answer.metadata, context);
  return problem ? { problem } : answer;
}
