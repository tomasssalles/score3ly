// `analyze` (DESIGN.md §6): what the pages say, as metadata and observations for the extraction. One call per page,
// each page on its own (the clean page, and the page with the layout drawn on it: systems numbered in the whole score,
// bar lines numbered within their system), then one call for the whole score that merges the pages' results. Places
// are named by the labels drawn on the pages: "system 17, bar line 4", "system 17, stretch 2", "system 17, end".

// Raise whenever the texts, the schemas or the checks change.
export const ANALYZE_PROMPT_VERSION = 5;

export const ANALYZE_PAGE_MAX_OUTPUT_TOKENS = 16_000;
export const ANALYZE_SCORE_MAX_OUTPUT_TOKENS = 32_000;

export const CONFIDENCES = ["low", "medium", "high"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export const TITLE_TYPES = ["main", "subtitle", "alternative", "translated"] as const;
// MEI's header has an element for each but "translator" and "other" (DESIGN.md §6, "Metadata").
export const ROLES = ["composer", "arranger", "editor", "lyricist", "librettist", "translator", "other"] as const;
export type Role = (typeof ROLES)[number];
export const SPECIAL_BAR_LINES = ["double", "final", "startRepeat", "endRepeat", "startEndRepeat", "dashed"] as const;
export const CHANGE_KINDS = ["clef", "key", "time", "tempo", "other"] as const;

// The metadata fields that are plain text, besides titles, people and pieces.
export const TEXT_FIELDS = [
  "catalogueNumbers",
  "dedications",
  "instrumentation",
  "compositionDates",
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
  people: ({ name: string; role: Role; confidence: Confidence } & Extra)[];
  pieces: ({ title: string; system: number; confidence: Confidence } & Extra)[];
} & Record<TextField, ({ text: string; confidence: Confidence } & Extra)[]>;

export type PageMetadata = Metadata;
export type ScoreMetadata = Metadata<{ page: number }>;

// A place in a system (DESIGN.md §6, `analyze`): its start or its end (the box's edges), one of its inner bar lines
// (1 to n, as drawn), or a stretch between two of these (1 to n + 1). `number` is the bar line's or the stretch's, 0
// at the start and the end.
export const PLACE_KINDS = ["start", "barLine", "stretch", "end"] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];
export type Place = { system: number; at: PlaceKind; number: number };
// Where a bar line's kind can be: not inside a stretch.
export const BAR_LINE_PLACES: PlaceKind[] = ["start", "barLine", "end"];

// A staff as "staff k/n": k-th from the top of a system with n staves.
export type Staff = { number: number; of: number };

type Item = { confidence: Confidence };
export type TextItem = Item & { text: string };
export type SystemItem = Item & { system: number; staves: number; instruments: string[] };
export type ChangeItem = Item & { kind: (typeof CHANGE_KINDS)[number]; text: string; place: Place; staff: Staff | null };
// Spanning items: a start without an end continues past the page's end, an end without a start continues from
// before the page, neither runs through the whole page.
export type OttavaItem = Item & { text: string; staff: Staff; start: Place | null; end: Place | null };
export type EndingItem = Item & { numbers: string; start: Place | null; end: Place | null };
export type BarLineItem = Item & { kind: (typeof SPECIAL_BAR_LINES)[number]; place: Place };
export type DirectionItem = Item & { text: string; place: Place };
export type RecurringItem = Item & { description: string; places: Place[] };

// A page's observations, every item with `Extra` (an id once code has numbered them).
export type PageObservations<Extra = object> = {
  systems: (SystemItem & Extra)[];
  changes: (ChangeItem & Extra)[];
  ottavas: (OttavaItem & Extra)[];
  specialBarLines: (BarLineItem & Extra)[];
  endings: (EndingItem & Extra)[];
  directions: (DirectionItem & Extra)[];
  notes: (TextItem & Extra)[];
};
export type PageList = keyof PageObservations;
export const PAGE_LISTS: PageList[] = ["systems", "changes", "ottavas", "specialBarLines", "endings", "directions", "notes"];

// The observations of the whole score, beyond the pages'.
export type ScoreObservations<Extra = object> = {
  instrumentation: (TextItem & Extra)[];
  style: (TextItem & Extra)[];
  form: (TextItem & Extra)[];
  recurringMaterial: (RecurringItem & Extra)[];
  notesForTranscription: (TextItem & Extra)[];
};
export const SCORE_LISTS: (keyof ScoreObservations)[] = ["instrumentation", "style", "form", "recurringMaterial", "notesForTranscription"];

export type PageAnswer = { metadata: PageMetadata; observations: PageObservations };

// The whole score's answer: the merged metadata, the pages' items corrected (by id: replaced, keeping their page),
// removed (by id) and added (with their page), and the observations of the whole score.
export type ScoreAnswer = {
  metadata: ScoreMetadata;
  corrections: PageObservations<{ id: string }>;
  removals: string[];
  additions: PageObservations<{ page: number }>;
  score: ScoreObservations;
};

// Every item of a page numbered, as the whole score's call names them: "p7-1", "p7-2", … through the lists in order.
export function withIds(page: number, o: PageObservations): PageObservations<{ id: string }> {
  let n = 0;
  return Object.fromEntries(
    PAGE_LISTS.map((list) => [list, (o[list] as object[]).map((item) => ({ id: `p${page}-${++n}`, ...item }))]),
  ) as PageObservations<{ id: string }>;
}

const SHARED = `You analyse pages of printed music (sheet music, usually for piano, sometimes for other instruments or voices), so that later steps can transcribe the music exactly. You report only what is printed on the pages, never what you know about the work from elsewhere: if the composer's name, an opus number or a date isn't printed, leave it out, even for a famous piece.

The pages come with their layout drawn on them: each system in a box of its own colour, labelled at its top left corner with its number in the whole score, and the bar lines inside it drawn in the same colour, each numbered within its system (1, 2, …) in a small label just above the box. The box's left and right edges stand for the system's start and end, which have no bar line drawn and no number. You name a system by its number, and a place in a system ("at") as one of:
- "start": the start of the system (the box's left edge), e.g. for a start repeat or a key signature at the beginning;
- "barLine" with its number: one of the bar lines drawn inside the system;
- "end": the end of the system (the box's right edge), e.g. for a final bar line;
- "stretch" with its number: the music between two of these. Stretch 1 runs from the start to bar line 1, stretch k from bar line k - 1 to bar line k, and the last from the last bar line to the end: a system with n bar lines drawn has n + 1 stretches (one stretch when it has none).
Give "number" 0 for "start" and "end". Read the numbers from the labels; don't count.

A staff is named by its position in its system: staff k of n, numbered from the top, where n is the number of staves you give for that system ("number": 2, "of": 3 for the middle staff of three).

Metadata fields, each as printed (keep the page's language and spelling):
- titles, each with its type: main, subtitle, alternative (another title of the same work), translated (the title in another language, e.g. "Kinderscenen / Scènes d'enfants");
- people, each with a role (composer, arranger, editor, lyricist, librettist, translator, other). Where the printed role says more than the role does, or for "other", add it after the name in parentheses, as printed ("H. Germer (Fingersatz)", "J. Schmidt (Stecher)");
- pieces or movements, each with its title or number as printed and the system where it starts;
- catalogue numbers (e.g. "Op. 15", "BWV 846", "No. 3"), dedications, instrumentation as printed (e.g. "für Klavier zu vier Händen");
- composition dates: when or where the work was written, as printed (e.g. "komponiert 1838", "Wien, im März 1825"); rarely printed;
- the edition: publishers, places, dates of the edition (of its publication or printing, not of the composition), plate numbers (e.g. "E. 1234 B."), and other notices (copyright, printer).

Give every item, metadata and observations alike, free texts too, your confidence in it: "high" when it is clearly legible or clearly right, "medium" when it is a reasonable guess (partly legible, an unusual spelling, a judgment you are unsure of), "low" when you are very unsure (stained, faded, cut off).

Observations of a page, for the later transcription. They are a bird's-eye view for someone who will transcribe one system at a time: close is useful, exact is better.
- systems: for every system on the page, its number of staves, and the probable instrument of each staff, top to bottom (e.g. "piano right hand", "violin", "voice");
- changes: every clef, key signature and time signature at the start of the page's first system, and every change of them, or of tempo, with its place. A clef belongs to one staff: give it; for the others, give the staff only when the change is on one staff only, else null;
- ottavas (8va, 8vb, 15ma, …): the sign as printed, its staff, and where it starts and ends;
- special bar lines only: double, final, start repeat, end repeat, start and end repeat together, dashed; at the start, at a bar line or at the end of a system, never in a stretch. Not the ordinary single bar lines;
- endings (the brackets "1." and "2." of a repeat, or "1.-3."): their numbers as printed, where each starts and ends;
- directions such as "D.C. al Fine", "Fine", "D.S.", a segno, a coda sign, with their place;
- notes: anything else that will help to transcribe the music: voices per staff, the texture, large-scale dynamics, a melody that repeats on the page, cross-staff writing, ossias, lyrics. Brief, one note per thing.
Ottavas and endings can run on beyond the page: give their start as null when it is before this page, their end as null when it is after it, both null when one runs through the whole page. Report each thing once, where it is printed: don't join or link items to each other (a repeat is its bar lines and its endings).`;

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
- metadata: one entry per thing, from the pages' candidates. Where pages disagree, take the best reading: a title legible on the cover is better than the same title faded on a later page, which must not replace it, but a legible reading replaces an unsure one. Give each entry the page it was read on and your confidence in it. Several titles may all be right (a title in two languages, a subtitle). Pieces or movements: in order, each with the system where it starts.
- the pages' observations: every item has an id. Don't repeat the items that are right. Give corrections (the item's id and the whole item as it should be: a misread kind, a wrong place, a confidence that the other pages raise or lower), removals (the ids of items that are wrong or duplicated), and additions (items a page missed, with their page; places on that page). An item open at a page's edge stays open: don't join it to its other part on the next page. If you correct a system's number of staves, correct every staff named on it too.
- observations about the whole score: the instrumentation (which staves are which instrument, and where that changes, e.g. "systems 12-20 add a third staff, probably a voice: lyrics below it"), the style, the form, music that recurs (a theme that returns, a passage repeated note for note, with its places: a note hard to read in one place may be clear in another), and notes for the transcription: anything a person transcribing one system at a time should know about the rest. One item per thing.`;

export const ANALYZE_SCORE_TEXT = `These were the results of the pages, one by one (JSON; every metadata item has the page it was found on, every observation item its id). Combine them, looking at the pages above where you need to.`;

const confidence = { type: "string", enum: [...CONFIDENCES] };
const str = { type: "string" };
const int = { type: "integer" };

function object(properties: Record<string, unknown>) {
  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
}

const place = object({ system: int, at: { type: "string", enum: [...PLACE_KINDS] }, number: int });
const openPlace = { anyOf: [place, { type: "null" }] };
const staff = object({ number: int, of: int });
const list = (properties: Record<string, unknown>) => ({ type: "array", items: object(properties) });

function metadataSchema(withPage: boolean) {
  const extra = withPage ? { page: int } : {};
  const fields = (properties: Record<string, unknown>) => list({ ...properties, ...extra });
  return object({
    titles: fields({ text: str, type: { type: "string", enum: [...TITLE_TYPES] }, confidence }),
    people: fields({ name: str, role: { type: "string", enum: [...ROLES] }, confidence }),
    pieces: fields({ title: str, system: int, confidence }),
    ...Object.fromEntries(TEXT_FIELDS.map((field) => [field, fields({ text: str, confidence })])),
  });
}

// The page's lists, each item with `extra` (an id, a page).
function pageObservationsSchema(extra: Record<string, unknown> = {}) {
  const items = (properties: Record<string, unknown>) => list({ ...extra, ...properties, confidence });
  return object({
    systems: items({ system: int, staves: int, instruments: { type: "array", items: str } }),
    changes: items({
      kind: { type: "string", enum: [...CHANGE_KINDS] },
      text: str,
      place,
      staff: { anyOf: [staff, { type: "null" }] },
    }),
    ottavas: items({ text: str, staff, start: openPlace, end: openPlace }),
    specialBarLines: items({ kind: { type: "string", enum: [...SPECIAL_BAR_LINES] }, place }),
    endings: items({ numbers: str, start: openPlace, end: openPlace }),
    directions: items({ text: str, place }),
    notes: items({ text: str }),
  });
}

export const ANALYZE_PAGE_SCHEMA = object({
  metadata: metadataSchema(false),
  observations: pageObservationsSchema(),
});

const text = list({ text: str, confidence });

export const ANALYZE_SCORE_SCHEMA = object({
  metadata: metadataSchema(true),
  corrections: pageObservationsSchema({ id: str }),
  removals: { type: "array", items: str },
  additions: pageObservationsSchema({ page: int }),
  score: object({
    instrumentation: text,
    style: text,
    form: text,
    recurringMaterial: list({ description: str, places: { type: "array", items: place }, confidence }),
    notesForTranscription: text,
  }),
});

// What the checks need to know: the systems that can be named (by number) with their number of bar lines and their
// page; for the whole score also the pages, and the pages' items by id.
export type AnalyzeContext = {
  systems: Map<number, { barLines: number; page: number }>;
  pages?: number[];
  items?: Map<string, { list: PageList; page: number }>;
};

type Problem = { problem: string };

const placeName = (p: Place) =>
  p.at === "start" || p.at === "end" ? `the ${p.at} of system ${p.system}` : `system ${p.system}, ${p.at === "barLine" ? "bar line" : "stretch"} ${p.number}`;

// Whether a place exists on a page: its system is there, and has that bar line or stretch.
function placeProblem(p: Place, what: string, page: number | null, context: AnalyzeContext): string | null {
  const system = context.systems.get(p.system);
  if (!system) return `${what}: there is no system ${p.system}`;
  if (page !== null && system.page !== page) return `${what}: system ${p.system} isn't on page ${page}`;
  const count = system.barLines;
  if (p.at === "barLine" && (p.number < 1 || p.number > count)) {
    return `${what}: system ${p.system} has no bar line ${p.number} (it has ${count})`;
  }
  if (p.at === "stretch" && (p.number < 1 || p.number > count + 1)) {
    return `${what}: system ${p.system} has no stretch ${p.number} (it has ${count + 1})`;
  }
  return null;
}

function staffProblem(staff: Staff | null, what: string): string | null {
  if (staff && (staff.of < 1 || staff.number < 1 || staff.number > staff.of)) return `${what}: there is no staff ${staff.number}/${staff.of}`;
  return null;
}

// Every item's places on its page (by `pageOf`), bar lines' kinds at a bar line, staves that exist.
function observationsProblem(
  o: PageObservations<object>,
  pageOf: (list: PageList, item: object) => number | null,
  context: AnalyzeContext,
): string | null {
  type Check = { list: PageList; item: object; what: string; places: (Place | null)[]; staves?: (Staff | null)[] };
  const checks: Check[] = [
    // A system's own place: it is on the page.
    ...o.systems.map((s): Check => ({ list: "systems", item: s, what: `system ${s.system}`, places: [{ system: s.system, at: "start", number: 0 }] })),
    ...o.changes.map((c): Check => ({ list: "changes", item: c, what: `a ${c.kind} change`, places: [c.place], staves: [c.staff] })),
    ...o.ottavas.map((c): Check => ({ list: "ottavas", item: c, what: `the ottava "${c.text}"`, places: [c.start, c.end], staves: [c.staff] })),
    ...o.specialBarLines.map((b): Check => ({ list: "specialBarLines", item: b, what: `a ${b.kind} bar line`, places: [b.place] })),
    ...o.endings.map((e): Check => ({ list: "endings", item: e, what: `ending ${e.numbers}`, places: [e.start, e.end] })),
    ...o.directions.map((d): Check => ({ list: "directions", item: d, what: `"${d.text}"`, places: [d.place] })),
  ];
  for (const { list, item, what, places, staves = [] } of checks) {
    const page = pageOf(list, item);
    for (const p of places) {
      const problem = p && placeProblem(p, what, page, context);
      if (problem) return problem;
    }
    for (const staff of staves) {
      const problem = staffProblem(staff, what);
      if (problem) return problem;
    }
  }
  for (const b of o.specialBarLines) {
    if (!BAR_LINE_PLACES.includes(b.place.at)) return `a ${b.kind} bar line is in ${placeName(b.place)}, not at a bar line`;
  }
  return null;
}

// Whether a page's staves agree (DESIGN.md §6, "staff k/n"): each system on the page reported at most once, with at
// least one staff, and every staff named on a system (k/n) with n its reported number of staves. An ottava is on the
// systems of its start and its end, or on every system of the page when it runs through it.
export function stavesProblem(o: PageObservations<object>, systemsOnPage: number[]): string | null {
  const staves = new Map<number, number>();
  for (const s of o.systems) {
    if (staves.has(s.system)) return `system ${s.system} is reported twice`;
    if (s.staves < 1) return `system ${s.system} has ${s.staves} staves`;
    staves.set(s.system, s.staves);
  }
  const named: [Staff, number[], string][] = [
    ...o.changes.flatMap((c): [Staff, number[], string][] => (c.staff ? [[c.staff, [c.place.system], `a ${c.kind} change`]] : [])),
    ...o.ottavas.map((c): [Staff, number[], string] => {
      const ends = [c.start, c.end].flatMap((p) => (p ? [p.system] : []));
      return [c.staff, ends.length > 0 ? ends : systemsOnPage, `the ottava "${c.text}"`];
    }),
  ];
  for (const [staff, systems, what] of named) {
    for (const system of systems) {
      const count = staves.get(system);
      if (count === undefined) return `${what} names staff ${staff.number}/${staff.of} of system ${system}, whose staves aren't reported`;
      if (count !== staff.of) return `${what} names staff ${staff.number}/${staff.of} of system ${system}, which has ${count} staves`;
    }
  }
  return null;
}

function shapeProblem(value: unknown, schema: Record<string, unknown>, path: string): string | null {
  if (Array.isArray(schema.anyOf)) {
    const problems = (schema.anyOf as Record<string, unknown>[]).map((option) => shapeProblem(value, option, path));
    return problems.includes(null) ? null : problems[0];
  }
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
    case "null":
      return value === null ? null : `${path} isn't null`;
    default:
      return null;
  }
}

// The answer with the start and the end of every place numbered 0, whatever the model gave.
function normalized<T>(value: T): T {
  if (Array.isArray(value)) return value.map(normalized) as T;
  if (typeof value !== "object" || value === null) return value;
  const o = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalized(v)])) as Record<string, unknown>;
  if (typeof o.system === "number" && (o.at === "start" || o.at === "end")) o.number = 0;
  return o as T;
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

// A page's answer, checked: the expected shape, every place on the page (the context's systems are the page's), and
// its staves.
// Returns the reason it can't be used, or the answer.
export function checkPageAnswer(json: unknown, context: AnalyzeContext): PageAnswer | Problem {
  const shape = shapeProblem(json, ANALYZE_PAGE_SCHEMA, "");
  if (shape) return { problem: `the answer doesn't have the expected form: ${shape}` };
  const answer = normalized(json as PageAnswer);
  const problem =
    observationsProblem(answer.observations, () => null, context) ??
    stavesProblem(answer.observations, [...context.systems.keys()]) ??
    metadataProblem(answer.metadata, context);
  return problem ? { problem } : answer;
}

// The whole score's answer, checked: the expected shape, corrections and removals of items that exist (a correction
// in the item's own list), every place on its item's page, every page among the pages. Whether the staves agree is
// checked on the pages as corrected (stavesProblem).
export function checkScoreAnswer(json: unknown, context: AnalyzeContext): ScoreAnswer | Problem {
  const shape = shapeProblem(json, ANALYZE_SCORE_SCHEMA, "");
  if (shape) return { problem: `the answer doesn't have the expected form: ${shape}` };
  const answer = normalized(json as ScoreAnswer);
  const items = context.items ?? new Map();
  for (const list of PAGE_LISTS) {
    for (const { id } of answer.corrections[list]) {
      const item = items.get(id);
      if (!item) return { problem: `a correction names the item ${id}, which doesn't exist` };
      if (item.list !== list) return { problem: `the item ${id} is corrected as one of the ${list}, but it is one of the ${item.list}` };
    }
    for (const { page } of answer.additions[list]) {
      if (!context.pages?.includes(page)) return { problem: `an addition is on page ${page}, which isn't one of the pages` };
    }
  }
  const unknown = answer.removals.find((id) => !items.has(id));
  if (unknown) return { problem: `a removal names the item ${unknown}, which doesn't exist` };
  const problem =
    observationsProblem(answer.corrections, (_, item) => items.get((item as { id: string }).id)!.page, context) ??
    observationsProblem(answer.additions, (_, item) => (item as { page: number }).page, context) ??
    answer.score.recurringMaterial
      .flatMap((m) => m.places)
      .map((p) => placeProblem(p, "recurring material", null, context))
      .find((p) => p !== null) ??
    metadataProblem(answer.metadata, context);
  return problem ? { problem } : answer;
}
