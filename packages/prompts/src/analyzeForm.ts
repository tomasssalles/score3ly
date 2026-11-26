// `analyze`'s answers (docs/stages/analyze.md): what a page and the whole score give, in the lists code uses; the flat
// form the model writes, and the conversions both ways; the schemas. ANALYZE_PROMPT_VERSION (analyze.ts) covers the
// schemas (they are sent), ANALYZE_VERSION (apps/web/src/analyze.ts) the conversions (code).

import type { JsonSchema, Problem } from "@score3ly/core";
import { PLACE_KINDS, type Place } from "./places.ts";
import { described, enumOf, int, list, nullable, object, str } from "./schema.ts";

export const CONFIDENCES = ["low", "medium", "high"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export const TITLE_TYPES = ["main", "subtitle", "alternative", "translated"] as const;
// MEI's header has an element for each but "translator" and "other" (docs/stages/analyze.md, "The metadata").
export const ROLES = ["composer", "arranger", "editor", "lyricist", "librettist", "translator", "other"] as const;
export type Role = (typeof ROLES)[number];
export const SPECIAL_BAR_LINES = ["double", "final", "startRepeat", "endRepeat", "bothRepeats", "dashed"] as const;
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

// What the model answers is flat (docs/stages/analyze.md, "The answer's shape"): the metadata one list of items, each
// with its category, and the observations besides the systems one list of items, each with its kind, so the model
// reports each thing as it comes to it, and the schema stays small enough for Anthropic's constrained output
// (docs/llm.md, "Claude's limit on schemas"). Code turns it into the lists above at once (checkPageAnswer,
// checkScoreAnswer), and back for the whole score's request (flatMetadata, flatObservations).

// Each metadata category, and where it goes in Metadata.
const TITLE_CATEGORIES = { mainTitle: "main", subtitle: "subtitle", alternativeTitle: "alternative", translatedTitle: "translated" } as const;
const PERSON_CATEGORIES = {
  composer: "composer",
  arranger: "arranger",
  editor: "editor",
  lyricist: "lyricist",
  librettist: "librettist",
  translator: "translator",
  otherPerson: "other",
} as const;
const TEXT_CATEGORIES = {
  catalogueNumber: "catalogueNumbers",
  dedication: "dedications",
  instrumentation: "instrumentation",
  compositionDate: "compositionDates",
  publisher: "publishers",
  editionPlace: "places",
  editionDate: "dates",
  plateNumber: "plateNumbers",
  notice: "notices",
} as const;
export const METADATA_CATEGORIES = [
  ...Object.keys(TITLE_CATEGORIES),
  ...Object.keys(PERSON_CATEGORIES),
  "piece",
  ...Object.keys(TEXT_CATEGORIES),
] as MetadataCategory[];
export type MetadataCategory = keyof typeof TITLE_CATEGORIES | keyof typeof PERSON_CATEGORIES | "piece" | keyof typeof TEXT_CATEGORIES;
export type FlatMetadataItem = { category: MetadataCategory; text: string; system: number | null; confidence: Confidence };

// Each kind of observation item, and the list it goes in.
const CHANGE_ITEM_KINDS = { clef: "clef", key: "key", time: "time", tempo: "tempo", otherChange: "other" } as const;
const BAR_LINE_ITEM_KINDS = {
  doubleBarLine: "double",
  finalBarLine: "final",
  startRepeat: "startRepeat",
  endRepeat: "endRepeat",
  bothRepeats: "bothRepeats",
  dashedBarLine: "dashed",
} as const;
export type ObservationKind = keyof typeof CHANGE_ITEM_KINDS | "ottava" | keyof typeof BAR_LINE_ITEM_KINDS | "ending" | "direction" | "note";
export const OBSERVATION_KINDS = [
  ...Object.keys(CHANGE_ITEM_KINDS),
  "ottava",
  ...Object.keys(BAR_LINE_ITEM_KINDS),
  "ending",
  "direction",
  "note",
] as ObservationKind[];
// An item at one place has it as its start, and its end null; a field its kind doesn't use is null, the text "".
export type FlatObservation = {
  kind: ObservationKind;
  text: string;
  staff: Staff | null;
  start: Place | null;
  end: Place | null;
  confidence: Confidence;
};
export type FlatPageObservations<Extra = object> = { systems: (SystemItem & Extra)[]; items: (FlatObservation & Extra)[] };

const SCORE_ITEM_KINDS = {
  instrumentation: "instrumentation",
  style: "style",
  form: "form",
  recurringMaterial: "recurringMaterial",
  note: "notesForTranscription",
} as const;
export const SCORE_KINDS = Object.keys(SCORE_ITEM_KINDS) as (keyof typeof SCORE_ITEM_KINDS)[];
export type FlatScoreItem = { kind: (typeof SCORE_KINDS)[number]; text: string; places: Place[]; confidence: Confidence };

// The key of one of a map's values (the model's kinds and fields, whose values the schema's enums are).
const keyOfValue = <T extends Record<string, string>>(map: T, value: string) => Object.keys(map).find((k) => map[k] === value) as keyof T;

// An item's fields besides those the flat form names: its confidence, and the `Extra` (an id, a page).
type Rest = { confidence: Confidence } & Record<string, unknown>;

// The metadata as the model writes it, every item with its `Extra` (a page).
export function flatMetadata<Extra extends object>(metadata: Metadata<Extra>): (FlatMetadataItem & Extra)[] {
  const item = (category: MetadataCategory, text: string, system: number | null, { confidence, ...extra }: Rest) =>
    ({ category, text, system, ...extra, confidence }) as FlatMetadataItem & Extra;
  return [
    ...metadata.titles.map(({ text, type, ...rest }) => item(keyOfValue(TITLE_CATEGORIES, type), text, null, rest as Rest)),
    ...metadata.people.map(({ name, role, ...rest }) => item(keyOfValue(PERSON_CATEGORIES, role), name, null, rest as Rest)),
    ...metadata.pieces.map(({ title, system, ...rest }) => item("piece", title, system, rest as Rest)),
    ...TEXT_FIELDS.flatMap((field) =>
      metadata[field].map(({ text, ...rest }) => item(keyOfValue(TEXT_CATEGORIES, field), text, null, rest as Rest)),
    ),
  ];
}

// The metadata as the model wrote it, in its lists; a piece needs its system, the other categories' systems are
// dropped.
export function nestedMetadata<Extra extends object>(items: (FlatMetadataItem & Extra)[]): Metadata<Extra> | Problem {
  const metadata = { titles: [], people: [], pieces: [], ...Object.fromEntries(TEXT_FIELDS.map((f) => [f, []])) } as unknown as Record<string, object[]>;
  for (const { category, text, system, ...rest } of items) {
    if (category in TITLE_CATEGORIES) metadata.titles.push({ text, type: TITLE_CATEGORIES[category as keyof typeof TITLE_CATEGORIES], ...rest });
    else if (category in PERSON_CATEGORIES) metadata.people.push({ name: text, role: PERSON_CATEGORIES[category as keyof typeof PERSON_CATEGORIES], ...rest });
    else if (category === "piece") {
      if (system === null) return { problem: `the piece "${text}" has no system` };
      metadata.pieces.push({ title: text, system, ...rest });
    } else metadata[TEXT_CATEGORIES[category as keyof typeof TEXT_CATEGORIES]].push({ text, ...rest });
  }
  return metadata as unknown as Metadata<Extra>;
}

// The observations as the model writes them, every system and item with its `Extra` (an id, a page), in the order of
// the lists.
export function flatObservations<Extra extends object>(o: PageObservations<Extra>): FlatPageObservations<Extra> {
  const item = (kind: ObservationKind, text: string, staff: Staff | null, start: Place | null, end: Place | null, rest: Rest) => {
    const { confidence, ...extra } = rest;
    return { ...extra, kind, text, staff, start, end, confidence } as FlatObservation & Extra;
  };
  return {
    systems: o.systems,
    items: [
      ...o.changes.map(({ kind, text, place, staff, ...rest }) => item(keyOfValue(CHANGE_ITEM_KINDS, kind), text, staff, place, null, rest as Rest)),
      ...o.ottavas.map(({ text, staff, start, end, ...rest }) => item("ottava", text, staff, start, end, rest as Rest)),
      ...o.specialBarLines.map(({ kind, place, ...rest }) => item(keyOfValue(BAR_LINE_ITEM_KINDS, kind), "", null, place, null, rest as Rest)),
      ...o.endings.map(({ numbers, start, end, ...rest }) => item("ending", numbers, null, start, end, rest as Rest)),
      ...o.directions.map(({ text, place, ...rest }) => item("direction", text, null, place, null, rest as Rest)),
      ...o.notes.map(({ text, ...rest }) => item("note", text, null, null, null, rest as Rest)),
    ],
  };
}

// An item as the model wrote it, in its list: an ottava needs its staff, a change, a bar line and a direction their
// place (its start); the fields its kind doesn't use are dropped.
export function nestedObservation(flat: FlatObservation & object): { list: PageList; item: object } | Problem {
  const { kind, text, staff, start, end, ...rest } = flat;
  if (kind in CHANGE_ITEM_KINDS) {
    const change = CHANGE_ITEM_KINDS[kind as keyof typeof CHANGE_ITEM_KINDS];
    if (!start) return { problem: `a ${change} change has no place` };
    return { list: "changes", item: { kind: change, text, place: start, staff, ...rest } };
  }
  if (kind in BAR_LINE_ITEM_KINDS) {
    const barLine = BAR_LINE_ITEM_KINDS[kind as keyof typeof BAR_LINE_ITEM_KINDS];
    if (!start) return { problem: `a ${barLine} bar line has no place` };
    return { list: "specialBarLines", item: { kind: barLine, place: start, ...rest } };
  }
  switch (kind) {
    case "ottava":
      if (!staff) return { problem: `the ottava "${text}" has no staff` };
      return { list: "ottavas", item: { text, staff, start, end, ...rest } };
    case "ending":
      return { list: "endings", item: { numbers: text, start, end, ...rest } };
    case "direction":
      if (!start) return { problem: `"${text}" has no place` };
      return { list: "directions", item: { text, place: start, ...rest } };
    default:
      return { list: "notes", item: { text, ...rest } };
  }
}

export function nestedObservations<Extra extends object>(o: FlatPageObservations<Extra>): PageObservations<Extra> | Problem {
  const lists = Object.fromEntries(PAGE_LISTS.map((list) => [list, [] as object[]])) as Record<PageList, object[]>;
  lists.systems.push(...o.systems);
  for (const flat of o.items) {
    const nested = nestedObservation(flat);
    if ("problem" in nested) return nested;
    lists[nested.list].push(nested.item);
  }
  return lists as unknown as PageObservations<Extra>;
}

export function nestedScore(items: FlatScoreItem[]): ScoreObservations {
  const lists = Object.fromEntries(SCORE_LISTS.map((list) => [list, [] as object[]])) as Record<keyof ScoreObservations, object[]>;
  for (const { kind, text, places, confidence } of items) {
    if (kind === "recurringMaterial") lists.recurringMaterial.push({ description: text, places, confidence });
    else lists[SCORE_ITEM_KINDS[kind]].push({ text, confidence });
  }
  return lists as unknown as ScoreObservations;
}

// A list of objects, with its description.
const objects = (properties: Record<string, JsonSchema>, description: string) => described(list(object(properties)), description);

const confidence = described(
  enumOf(CONFIDENCES),
  '"high": clearly legible or clearly right; "medium": a reasonable guess; "low": very unsure (stained, faded, cut off).',
);
const place = object({
  system: described(int, "The system's number, from its label."),
  at: described(enumOf(PLACE_KINDS), "Where in the system: its start, one of its bar lines, a stretch, or its end."),
  number: described(int, "The bar line's or the stretch's number, read from the labels; 0 for start and end."),
});
const staff = described(
  object({
    number: described(int, "k: the staff's position in its system, from the top."),
    of: described(int, "n: the number of staves you give for that system."),
  }),
  "Staff k of n in its system.",
);

const metadataSchema = (extra: Record<string, JsonSchema> = {}) =>
  objects(
    {
      category: described(enumOf(METADATA_CATEGORIES), "What the item is: one of the categories of the metadata."),
      text: described(str, "As printed, in the page's language and spelling. For a person, the name, with the printed role in parentheses where it says more."),
      system: described(nullable(int), "For a piece: the system where it starts. Null for every other category."),
      ...extra,
      confidence,
    },
    "What is printed about the work and the edition, one item per thing, in any order. Only what is printed.",
  );

// The page's systems and items, each with `extra` (an id, a page).
function pageObservationsSchema(extra: Record<string, JsonSchema> = {}, description: string) {
  return described(
    object({
      systems: objects(
        {
          ...extra,
          system: described(int, "The system's number, from its label."),
          staves: described(int, "Its number of staves."),
          instruments: described(list(str), 'The probable instrument of each staff, top to bottom ("piano right hand", "violin", "voice").'),
          confidence,
        },
        "Every system on the page.",
      ),
      items: objects(
        {
          ...extra,
          kind: described(enumOf(OBSERVATION_KINDS), "What the item is: one of the kinds of observations."),
          text: described(str, 'What it is, as its kind says ("bass clef", "3/4", the sign or numbers as printed, the note); "" where the kind uses none.'),
          staff: described(nullable(staff), "For a clef or an ottava, and a change on one staff only: its staff. Else null."),
          start: described(nullable(place), "Its place, or where it starts. Null for a note, and for an ottava or ending that starts before this page."),
          end: described(nullable(place), "Where an ottava or ending ends. Null where it ends after this page, and for an item at one place."),
          confidence,
        },
        "Everything else, one item per thing, each where it is printed, in any order. A field its kind doesn't use is null (the text \"\").",
      ),
    }),
    description,
  );
}

export const ANALYZE_PAGE_SCHEMA = object({
  metadata: metadataSchema(),
  observations: pageObservationsSchema({}, "This page's observations, for the later transcription."),
});

export const ANALYZE_SCORE_SCHEMA = object({
  metadata: metadataSchema({ page: described(int, "The page it was read on.") }),
  edits: pageObservationsSchema(
    {
      id: described(str, 'The id of the system or item it corrects, or "" for an addition.'),
      page: described(int, "The page it is on."),
    },
    "Corrections of the pages' systems and items (each whole, as it should be, with its id) and additions (id \"\"). Not the ones that are right.",
  ),
  removals: described(list(str), "The ids of the pages' systems and items that are wrong or duplicated."),
  score: objects(
    {
      kind: described(enumOf(SCORE_KINDS), "What the item is about."),
      text: str,
      places: described(list(place), "For recurringMaterial, its places; else an empty list."),
      confidence,
    },
    "Observations about the whole score, one item per thing.",
  ),
});

// The answers as the model writes them.
export type FlatPageAnswer = { metadata: FlatMetadataItem[]; observations: FlatPageObservations };
export type FlatScoreAnswer = {
  metadata: (FlatMetadataItem & { page: number })[];
  // Corrections (an item's id and its page) and additions (the id "" and a page) in one, so the schema has the
  // observations once (docs/llm.md, "Claude's limit on schemas").
  edits: FlatPageObservations<{ id: string; page: number }>;
  removals: string[];
  score: FlatScoreItem[];
};
