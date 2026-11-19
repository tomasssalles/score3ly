// `analyze`'s checks (docs/stages/analyze.md): an answer of the schema's shape, each item what its kind needs, every
// place on its page, no span ending before it starts, no two pieces at one system, the staves in agreement. Returns
// the answer in its lists, or why it can't be used. `fix_metadata`'s and `fix_observations`' forms refuse by the
// same rules (`startsWithAnother`, `endsBeforeStart`, `stavesProblem`).
// ANALYZE_PROMPT_VERSION (analyze.ts) covers them.

import { schemaProblem, type Problem } from "@score3ly/core";
import {
  ANALYZE_PAGE_SCHEMA,
  ANALYZE_SCORE_SCHEMA,
  nestedMetadata,
  nestedObservation,
  nestedObservations,
  nestedScore,
  PAGE_LISTS,
  TEXT_FIELDS,
  type ChangeItem,
  type FlatPageAnswer,
  type FlatPageObservations,
  type FlatScoreAnswer,
  type Metadata,
  type OttavaItem,
  type PageAnswer,
  type PageList,
  type PageObservations,
  type ScoreAnswer,
  type Staff,
  type SystemItem,
} from "./analyzeForm.ts";
import { BAR_LINE_PLACES, endsBeforeStart, placeLabel, type Place } from "./places.ts";

// What the checks need to know: the systems that can be named (by number) with their number of bar lines and their
// page; for the whole score also the pages, and the pages' items by id.
export type AnalyzeContext = {
  systems: Map<number, { barLines: number; page: number }>;
  pages?: number[];
  items?: Map<string, { list: PageList; page: number }>;
};

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
    if (!BAR_LINE_PLACES.includes(b.place.at)) return `a ${b.kind} bar line is in ${placeLabel(b.place)}, not at a bar line`;
  }
  const spans = [...o.ottavas.map((c) => ({ ...c, what: `the ottava "${c.text}"` })), ...o.endings.map((e) => ({ ...e, what: `ending ${e.numbers}` }))];
  const reversed = spans.find((s) => endsBeforeStart(s.start, s.end));
  if (reversed) return `${reversed.what} ends before it starts`;
  return null;
}

// Whether a page's staves agree (docs/stages/analyze.md, "staff k/n"): each system on the page reported at most once, with at
// least one staff, and every staff named on a system (k/n) with n its reported number of staves. An ottava is on the
// systems of its start and its end, or on every system of the page when it runs through it.
export type StavesOf = {
  systems: Pick<SystemItem, "system" | "staves">[];
  changes: Pick<ChangeItem, "kind" | "place" | "staff">[];
  ottavas: Pick<OttavaItem, "text" | "staff" | "start" | "end">[];
};

export function stavesProblem(o: StavesOf, systemsOnPage: number[]): string | null {
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

// The answer with the start and the end of every place numbered 0, whatever the model gave.
function normalized<T>(value: T): T {
  if (Array.isArray(value)) return value.map(normalized) as T;
  if (typeof value !== "object" || value === null) return value;
  const o = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalized(v)])) as Record<string, unknown>;
  if (typeof o.system === "number" && (o.at === "start" || o.at === "end")) o.number = 0;
  return o as T;
}

// Two pieces can't start at one system (docs/stages/analyze.md, "Pieces are structure"): whether `piece` starts where
// one of `others` does. `analyze`'s checks and `fix_metadata`'s form alike.
export function startsWithAnother(piece: { system: number }, others: { system: number }[]): boolean {
  return others.some((o) => o.system === piece.system);
}

// Every piece at a system that is here, no two at one; every other item on one of the pages (a piece's page is its
// system's, set by code: see checkScoreAnswer).
function metadataProblem(metadata: Metadata<{ page?: number }>, context: AnalyzeContext): string | null {
  for (const [i, piece] of metadata.pieces.entries()) {
    if (!context.systems.has(piece.system)) return `the piece "${piece.title}" starts at system ${piece.system}, which isn't here`;
    const before = metadata.pieces.slice(0, i);
    if (startsWithAnother(piece, before)) {
      return `two pieces start at system ${piece.system}: "${before.find((p) => p.system === piece.system)!.title}" and "${piece.title}"`;
    }
  }
  if (context.pages) {
    const items = [...metadata.titles, ...metadata.people, ...TEXT_FIELDS.flatMap((field) => metadata[field])];
    const wrong = items.find((item) => !context.pages!.includes(item.page!));
    if (wrong) return `metadata names page ${wrong.page}, which isn't one of the pages`;
  }
  return null;
}

// A page's answer, checked: the expected shape, each item what its kind needs, every place on the page (the
// context's systems are the page's), and its staves.
// Returns the reason it can't be used, or the answer in its lists.
export function checkPageAnswer(json: unknown, context: AnalyzeContext): PageAnswer | Problem {
  const shape = schemaProblem(ANALYZE_PAGE_SCHEMA, json);
  if (shape) return { problem: `the answer doesn't have the expected form: ${shape}` };
  const flat = normalized(json as FlatPageAnswer);
  const metadata = nestedMetadata(flat.metadata);
  if ("problem" in metadata) return metadata;
  const observations = nestedObservations(flat.observations);
  if ("problem" in observations) return observations;
  const answer: PageAnswer = { metadata, observations };
  const problem =
    observationsProblem(answer.observations, () => null, context) ??
    stavesProblem(answer.observations, [...context.systems.keys()]) ??
    metadataProblem(answer.metadata, context);
  return problem ? { problem } : answer;
}

// The whole score's answer, checked: the expected shape, each item what its kind needs, corrections (edits with an
// id) and removals of items that exist (a system's correction a system), on the item's own page, additions (edits
// with the id "") on one of the pages, every place on its item's page, every page among the pages.
// A correction that moves an item to another list (a direction that is a change) becomes its removal and an addition
// on its page. Whether the staves agree is checked on the pages as corrected (stavesProblem).
// Returns the reason it can't be used, or the answer in its lists.
export function checkScoreAnswer(json: unknown, context: AnalyzeContext): ScoreAnswer | Problem {
  const shape = schemaProblem(ANALYZE_SCORE_SCHEMA, json);
  if (shape) return { problem: `the answer doesn't have the expected form: ${shape}` };
  const flat = normalized(json as FlatScoreAnswer);
  const items = context.items ?? new Map<string, { list: PageList; page: number }>();
  const metadata = nestedMetadata(flat.metadata);
  if ("problem" in metadata) return metadata;
  const removals = [...flat.removals];
  const corrections: FlatPageObservations<{ id: string }> = { systems: [], items: [] };
  const added: FlatPageObservations<{ page: number }> = { systems: [], items: [] };
  for (const kind of ["systems", "items"] as const) {
    for (const { id, page, ...rest } of flat.edits[kind] as ({ id: string; page: number } & object)[]) {
      if (id === "") {
        (added[kind] as object[]).push({ page, ...rest });
        continue;
      }
      const original = items.get(id);
      if (original && original.page !== page) return { problem: `a correction of the item ${id} is on page ${page}, but the item is on page ${original.page}` };
      (corrections[kind] as object[]).push({ id, ...rest });
    }
  }
  const corrected: FlatPageObservations<{ id: string }> = { systems: corrections.systems, items: [] };
  for (const item of corrections.items) {
    const nested = nestedObservation(item);
    if ("problem" in nested) return nested;
    const original = items.get(item.id);
    if (original && original.list !== "systems" && original.list !== nested.list) {
      const { id, ...rest } = item;
      removals.push(id);
      added.items.push({ page: original.page, ...rest });
    } else corrected.items.push(item);
  }
  const nestedCorrections = nestedObservations(corrected);
  if ("problem" in nestedCorrections) return nestedCorrections;
  const additions = nestedObservations(added);
  if ("problem" in additions) return additions;
  const answer: ScoreAnswer = { metadata, corrections: nestedCorrections, removals, additions, score: nestedScore(flat.score) };
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
  if (problem) return { problem };
  // A piece's page is its system's (docs/stages/analyze.md), not the page the model read it on (a contents page, a
  // title page): the page `fix_metadata` gives it too.
  const pieces = answer.metadata.pieces.map((p) => ({ ...p, page: context.systems.get(p.system)!.page }));
  return { ...answer, metadata: { ...answer.metadata, pieces } };
}
