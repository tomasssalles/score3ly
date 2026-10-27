// `fix_observations` (docs/stages/analyze.md): the observations as a form. What doesn't need React: the rows the form edits
// and the stored document, the kinds of item, the places a picker offers, adding and removing staves, the checks and
// the card's note. The form is in ObservationsView.tsx, finishing in finishFixObservations.ts.

import {
  BAR_LINE_PLACES,
  PAGE_LISTS,
  SCORE_LISTS,
  stavesProblem,
  type Confidence,
  type PageList,
  type Place,
  type Staff,
} from "@score3ly/prompts";
import { firstPlace, type ShownConfidence, type StoredObservations, type StoredPage, type StoredScore } from "./analyze.ts";
import { canonicalJson } from "@score3ly/core";

export const FIX_OBSERVATIONS_VERSION = 1;

type ScoreList = (typeof SCORE_LISTS)[number];
export type ObsList = PageList | ScoreList;

// One item of the form, whatever its list: only the fields its list has mean anything (the others stay empty).
export type ObsRow = {
  list: ObsList;
  id: string;
  page: number | null; // a page's item: its page; the whole score's: null
  kind: string; // a change's or a special bar line's kind, else ""
  text: string; // the text; an ending's numbers; recurring material's description
  system: number | null; // the system whose staves a `systems` item gives (null: none left to give)
  staves: number;
  instruments: string[];
  place: Place | null; // changes, special bar lines, directions
  start: Place | null; // ottavas and endings (null: open)
  end: Place | null;
  staff: Staff | null; // changes (optional) and ottavas
  places: Place[]; // recurring material
  confidence: Confidence | null; // the model's; none for what the user added
  confirmed: boolean;
};

// The systems of the score, from the layout: `systems[n - 1]` is system n's page and number of inner bar lines.
export type ScoreSystems = { page: number; barLines: number }[];

const blank = (list: ObsList, id: string, page: number | null): ObsRow => ({
  list,
  id,
  page,
  kind: "",
  text: "",
  system: null,
  staves: 0,
  instruments: [],
  place: null,
  start: null,
  end: null,
  staff: null,
  places: [],
  confidence: null,
  confirmed: true,
});

type AnyItem = Record<string, unknown> & { id: string; confidence: Confidence | null; confirmed?: boolean };

function rowOf(list: ObsList, page: number | null, item: AnyItem): ObsRow {
  const row = { ...blank(list, item.id, page), confidence: item.confidence, confirmed: item.confirmed ?? false };
  const get = <T>(key: string, fallback: T) => (key in item ? (item[key] as T) : fallback);
  return {
    ...row,
    kind: get("kind", ""),
    text: get("text", get("numbers", get("description", ""))),
    system: get("system", null),
    staves: get("staves", 0),
    instruments: get("instruments", []),
    place: get("place", null),
    start: get("start", null),
    end: get("end", null),
    staff: get("staff", null),
    places: get("places", []),
  };
}

// The stored observations as rows: the whole score's first, then the pages', each list in its order.
export function rowsOf(o: StoredObservations): ObsRow[] {
  return [
    ...SCORE_LISTS.flatMap((list) => (o.score[list] as unknown as AnyItem[]).map((item) => rowOf(list, null, item))),
    ...o.pages.flatMap((p) => PAGE_LISTS.flatMap((list) => (p[list] as unknown as AnyItem[]).map((item) => rowOf(list, p.page, item)))),
  ];
}

// A row as stored, in its list's own shape.
function itemOf(row: ObsRow): AnyItem {
  const common = { id: row.id, confidence: row.confidence, confirmed: row.confirmed };
  switch (row.list) {
    case "systems":
      return { ...common, system: row.system, staves: row.staves, instruments: row.instruments };
    case "changes":
      return { ...common, kind: row.kind, text: row.text, place: row.place, staff: row.staff };
    case "ottavas":
      return { ...common, text: row.text, staff: row.staff, start: row.start, end: row.end };
    case "specialBarLines":
      return { ...common, kind: row.kind, place: row.place };
    case "endings":
      return { ...common, numbers: row.text, start: row.start, end: row.end };
    case "directions":
      return { ...common, text: row.text, place: row.place };
    case "recurringMaterial":
      return { ...common, description: row.text, places: row.places };
    default:
      return { ...common, text: row.text };
  }
}

// The rows as stored: every page of `pages` and of the rows, each list but the notes in the score's order.
export function observationsOf(rows: ObsRow[], pages: number[]): StoredObservations {
  const all = [...new Set([...pages, ...rows.flatMap((r) => (r.page === null ? [] : [r.page]))])].sort((a, b) => a - b);
  const score = Object.fromEntries(
    SCORE_LISTS.map((list) => [list, rows.filter((r) => r.list === list).map(itemOf)]),
  ) as unknown as StoredScore;
  return {
    score,
    pages: all.map(
      (page) =>
        ({
          page,
          ...Object.fromEntries(
            PAGE_LISTS.map((list) => {
              const items = rows.filter((r) => r.list === list && r.page === page).map(itemOf);
              return [list, list === "notes" ? items : items.sort((a, b) => firstPlace(a) - firstPlace(b))];
            }),
          ),
        }) as unknown as StoredPage,
    ),
  };
}

// Stored observations as the form uses them: `analyze`'s have no `confirmed` (nothing is).
export function normalizeObservations(json: unknown): StoredObservations {
  const o = json as StoredObservations;
  return observationsOf(rowsOf(o), o.pages.map((p) => p.page));
}

export function shownConfidence(row: { confidence: Confidence | null; confirmed?: boolean }): ShownConfidence | null {
  return row.confirmed ? "confirmed" : row.confidence;
}

// The kinds of item, in the order of "+" (the whole score's, then a page's), each in a section of the menu.
export type ObsKind = { id: string; list: ObsList; kind: string; label: string; section: string };

const kind = (section: string, list: ObsList, label: string, k = ""): ObsKind => ({ id: k ? `${list}:${k}` : list, list, kind: k, label, section });

export const OBS_KINDS: ObsKind[] = [
  kind("Whole score", "instrumentation", "Instrumentation"),
  kind("Whole score", "style", "Style"),
  kind("Whole score", "form", "Form"),
  kind("Whole score", "recurringMaterial", "Recurring material"),
  kind("Whole score", "notesForTranscription", "For the transcription"),
  kind("Systems", "systems", "Staves"),
  kind("Changes", "changes", "Clef", "clef"),
  kind("Changes", "changes", "Key", "key"),
  kind("Changes", "changes", "Time", "time"),
  kind("Changes", "changes", "Tempo", "tempo"),
  kind("Changes", "changes", "Other change", "other"),
  kind("Spans", "ottavas", "Ottava"),
  kind("Spans", "endings", "Ending"),
  kind("Bar lines", "specialBarLines", "Double bar line", "double"),
  kind("Bar lines", "specialBarLines", "Final bar line", "final"),
  kind("Bar lines", "specialBarLines", "Start repeat", "startRepeat"),
  kind("Bar lines", "specialBarLines", "End repeat", "endRepeat"),
  kind("Bar lines", "specialBarLines", "End and start repeat", "startEndRepeat"),
  kind("Bar lines", "specialBarLines", "Dashed bar line", "dashed"),
  kind("Other", "directions", "Direction"),
  kind("Other", "notes", "Page note"),
];

export const OBS_SECTIONS = [...new Set(OBS_KINDS.map((k) => k.section))];

export function obsKindOf(row: ObsRow): ObsKind {
  return OBS_KINDS.find((k) => k.list === row.list && k.kind === row.kind) ?? OBS_KINDS.find((k) => k.list === row.list)!;
}

// The kinds a row can become, keeping everything else: the other kinds of its list (a clef a key, a double bar line
// a final one).
export function sameShapeKinds(row: ObsRow): ObsKind[] {
  return OBS_KINDS.filter((k) => k.list === row.list && k.kind !== "");
}

// The rows (by their index) in the form's order: the whole score's, then page by page, each list in its order.
export function sectionsOf(rows: ObsRow[]): { title: string; indices: number[] }[] {
  const listOrder = (r: ObsRow) => [...SCORE_LISTS, ...PAGE_LISTS].indexOf(r.list as never);
  const indices = rows.map((_, i) => i);
  const score = indices.filter((i) => rows[i].page === null).sort((a, b) => listOrder(rows[a]) - listOrder(rows[b]) || a - b);
  const pages = [...new Set(rows.flatMap((r) => (r.page === null ? [] : [r.page])))].sort((a, b) => a - b);
  const order = (r: ObsRow) => (r.list === "notes" ? 0 : firstPlace(itemOf(r)));
  return [
    ...(score.length > 0 ? [{ title: "The whole score", indices: score }] : []),
    ...pages.map((page) => ({
      title: `Page ${page}`,
      indices: indices
        .filter((i) => rows[i].page === page)
        .sort((a, b) => listOrder(rows[a]) - listOrder(rows[b]) || order(rows[a]) - order(rows[b]) || a - b),
    })),
  ];
}

// The positions in a system, in order: start, stretch 1, bar line 1, stretch 2, …, stretch n + 1, end; for a bar
// line's kind only the start, the bar lines and the end (docs/stages/analyze.md: places by pickers, never invalid).
export function positionsIn(system: number, barLines: number, barLinesOnly = false): Place[] {
  const places: Place[] = [{ system, at: "start", number: 0 }];
  for (let k = 1; k <= barLines + 1; k++) {
    if (!barLinesOnly) places.push({ system, at: "stretch", number: k });
    if (k <= barLines) places.push({ system, at: "barLine", number: k });
  }
  places.push({ system, at: "end", number: 0 });
  return places;
}

export function positionLabel(p: Place): string {
  return p.at === "start" || p.at === "end" ? p.at : `${p.at === "barLine" ? "bar line" : "stretch"} ${p.number}`;
}

export const samePlace = (a: Place | null, b: Place | null) =>
  a === b || (a !== null && b !== null && a.system === b.system && a.at === b.at && a.number === b.number);

// A place moved to another system: the same position if that system has it, else its start.
export function inSystem(p: Place, system: number, systems: ScoreSystems, barLinesOnly = false): Place {
  const moved = { ...p, system };
  return positionsIn(system, systems[system - 1]?.barLines ?? 0, barLinesOnly).some((q) => samePlace(q, moved))
    ? moved
    : { system, at: "start", number: 0 };
}

// The systems an item's staff is on: a change's, an ottava's ends', or for an ottava through the whole page every
// system of its page.
export function staffSystems(row: ObsRow, systems: ScoreSystems): number[] {
  if (row.list === "changes") return row.place ? [row.place.system] : [];
  if (row.list !== "ottavas") return [];
  const ends = [...new Set([row.start, row.end].flatMap((p) => (p ? [p.system] : [])))];
  if (ends.length > 0) return ends;
  return systems.flatMap((s, i) => (s.page === row.page ? [i + 1] : []));
}

// The reported number of staves of a system, if it is reported.
export function stavesOf(rows: ObsRow[], system: number): number | null {
  return rows.find((r) => r.list === "systems" && r.system === system)?.staves ?? null;
}

// A staff fitted to the system its item is now on: an ottava keeps its staff where it can (the bottom one where the
// system has fewer), a change loses it unless the system has as many staves.
export function fitStaff(row: ObsRow, rows: ObsRow[], systems: ScoreSystems): ObsRow {
  if (!row.staff && row.list !== "ottavas") return row;
  const [system] = staffSystems(row, systems);
  const n = system === undefined ? null : stavesOf(rows, system);
  if (n === null) return { ...row, staff: null };
  if (row.list === "changes") return row.staff && row.staff.of === n ? row : { ...row, staff: null };
  return { ...row, staff: { number: Math.min(row.staff?.number ?? 1, n), of: n } };
}

// A page item moved to `place`'s system: it takes that system's page, and a span's other end, if it was on another
// page, becomes open.
export function withPlace(row: ObsRow, which: "place" | "start" | "end", place: Place | null, rows: ObsRow[], systems: ScoreSystems): ObsRow {
  let next: ObsRow = { ...row, [which]: place };
  if (place) {
    const page = systems[place.system - 1]?.page ?? row.page;
    next = { ...next, page };
    const other = which === "start" ? "end" : which === "end" ? "start" : null;
    if (other && next[other] && systems[next[other]!.system - 1]?.page !== page) next = { ...next, [other]: null };
  }
  return fitStaff(next, rows, systems);
}

// The systems the form can give staves for: those no other `systems` item gives.
export function reportedSystems(rows: ObsRow[], except: number): Set<number> {
  return new Set(rows.flatMap((r, i) => (i !== except && r.list === "systems" && r.system !== null ? [r.system] : [])));
}

// An id for what the user adds: "u1", "u2", … after the highest so far.
function newId(rows: ObsRow[]): string {
  const numbers = rows.flatMap((r) => (/^u\d+$/.test(r.id) ? [Number(r.id.slice(1))] : []));
  return `u${Math.max(0, ...numbers) + 1}`;
}

// A new item of a kind, for the form's "+": at the start of the first system (an ottava from its first stretch,
// open at its end; an ending from its first bar line), a note on the first page, the staves of the first system that
// has none: one staff, more added with "Add a staff above/below" like on any system (docs/stages/analyze.md). The user's, so no confidence, and confirmed.
export function newRow(k: ObsKind, rows: ObsRow[], systems: ScoreSystems, pages: number[]): ObsRow {
  const row = { ...blank(k.list, newId(rows), null), kind: k.kind };
  if (k.section === "Whole score") return row;
  const first: Place = { system: 1, at: "start", number: 0 };
  const page = systems[0]?.page ?? pages[0] ?? null;
  switch (k.list) {
    case "systems": {
      const reported = reportedSystems(rows, -1);
      const free = systems.findIndex((_, i) => !reported.has(i + 1));
      if (free < 0) return { ...row, page, staves: 1, instruments: [""] };
      return { ...row, system: free + 1, page: systems[free].page, staves: 1, instruments: [""] };
    }
    case "ottavas":
      return fitStaff({ ...row, page, text: "8va", start: { system: 1, at: "stretch", number: 1 } }, rows, systems);
    case "endings":
      return { ...row, page, text: "1.", start: systems[0]?.barLines ? { system: 1, at: "barLine", number: 1 } : first };
    case "notes":
      return { ...row, page: pages[0] ?? page };
    default:
      return { ...row, page, place: first };
  }
}

// A field with nothing in it, which isn't stored: a text item without its text. Staves, ottavas and bar lines are
// never empty.
export function rowEmpty(row: ObsRow): boolean {
  if (row.list === "systems" || row.list === "specialBarLines" || row.list === "ottavas") return false;
  return !row.text.trim();
}

const order = (p: Place) => firstPlace({ place: p });

// Why an item can't be saved, if it can't: a span that ends before it starts, a system's staves given twice or not
// at all, or staves that no longer agree on its page (stavesProblem, as `analyze` checks them).
export function obsProblem(row: ObsRow, others: ObsRow[], systems: ScoreSystems): string | null {
  if (row.list === "systems") {
    if (row.system === null) return "Every system's staves are given already.";
    if (reportedSystems(others, -1).has(row.system)) return `The staves of system ${row.system} are given already.`;
  }
  if (row.start && row.end && order(row.end) < order(row.start)) return "It ends before it starts.";
  return pagesProblem([...others, row], systems);
}

// Whether the staves agree on every page, as `analyze` checks them.
export function pagesProblem(rows: ObsRow[], systems: ScoreSystems): string | null {
  const pages = [...new Set(rows.flatMap((r) => (r.page === null ? [] : [r.page])))];
  for (const page of pages) {
    const on = rows.filter((r) => r.page === page);
    const lists = {
      systems: on.filter((r) => r.list === "systems" && r.system !== null).map((r) => ({ system: r.system!, staves: r.staves })),
      changes: on.filter((r) => r.list === "changes" && r.place).map((r) => ({ kind: r.kind as never, place: r.place!, staff: r.staff })),
      ottavas: on.filter((r) => r.list === "ottavas").map((r) => ({ text: r.text, staff: r.staff!, start: r.start, end: r.end })),
    };
    if (lists.ottavas.some((o) => !o.staff)) return "An ottava needs a staff: give the staves of its system first.";
    const problem = stavesProblem(lists, systems.flatMap((s, i) => (s.page === page ? [i + 1] : [])));
    if (problem) return problem[0].toUpperCase() + problem.slice(1) + ".";
  }
  return null;
}

// Why a row can't be removed, if it can't: the staves of a system something still names.
export function removeProblem(rows: ObsRow[], index: number, systems: ScoreSystems): string | null {
  if (rows[index].list !== "systems") return null;
  const problem = pagesProblem(
    rows.filter((_, i) => i !== index),
    systems,
  );
  return problem && `The staves of system ${rows[index].system} can't be removed: ${problem[0].toLowerCase()}${problem.slice(1)}`;
}

// The items that name a staff of a system.
function naming(rows: ObsRow[], system: number, systems: ScoreSystems): number[] {
  return rows.flatMap((r, i) => (r.staff && staffSystems(r, systems).includes(system) ? [i] : []));
}

const described = (r: ObsRow) => `${obsKindOf(r).label}${r.text ? ` "${r.text}"` : ""}`;

// A staff added above or below the staves of a system (the row at `index`, a `systems` item, which the user thereby
// confirms), and the staves its items name renumbered (docs/stages/analyze.md): below, k/n becomes k/(n + 1); above,
// (k + 1)/(n + 1). The instruments get an empty entry. Not while an ottava that names a staff runs on to another system. Returns the rows, or why not.
export function addStaff(rows: ObsRow[], index: number, where: "above" | "below", systems: ScoreSystems): ObsRow[] | string {
  const row = rows[index];
  const s = row.system!;
  const named = naming(rows, s, systems);
  const spanning = named.find((i) => staffSystems(rows[i], systems).length > 1);
  if (spanning !== undefined) return `${described(rows[spanning])} runs on from system ${s} to another system: change it first.`;
  return rows.map((r, i) => {
    if (i === index) {
      return { ...r, staves: r.staves + 1, instruments: where === "above" ? ["", ...r.instruments] : [...r.instruments, ""], confirmed: true };
    }
    if (!named.includes(i)) return r;
    const { number, of } = r.staff!;
    return { ...r, staff: { number: where === "above" ? number + 1 : number, of: of + 1 } };
  });
}

// The top or the bottom staff of a system removed (and the system's staves confirmed), only when nothing names it;
// the rest renumbered. Returns the rows, or why not.
export function removeStaff(rows: ObsRow[], index: number, which: "top" | "bottom", systems: ScoreSystems): ObsRow[] | string {
  const row = rows[index];
  const s = row.system!;
  if (row.staves <= 1) return `System ${s} has only one staff.`;
  const k = which === "top" ? 1 : row.staves;
  const named = naming(rows, s, systems);
  const on = named.filter((i) => rows[i].staff!.number === k);
  if (on.length > 0) {
    return `Staff ${k}/${row.staves} of system ${s} is named by ${on.map((i) => described(rows[i])).join(", ")}: remove or change ${on.length === 1 ? "it" : "them"} first.`;
  }
  const spanning = named.find((i) => staffSystems(rows[i], systems).length > 1);
  if (spanning !== undefined) return `${described(rows[spanning])} runs on from system ${s} to another system: change it first.`;
  return rows.map((r, i) => {
    if (i === index) {
      return { ...r, staves: r.staves - 1, instruments: which === "top" ? r.instruments.slice(1) : r.instruments.slice(0, -1), confirmed: true };
    }
    if (!named.includes(i)) return r;
    const { number, of } = r.staff!;
    return { ...r, staff: { number: which === "top" ? number - 1 : number, of: of - 1 } };
  });
}

// Two items the same, but for their confidence and whether they are confirmed.
export function sameItem(a: ObsRow, b: ObsRow): boolean {
  const strip = (r: ObsRow) => canonicalJson({ ...r, confidence: null, confirmed: false });
  return strip(a) === strip(b);
}

// How many items changed between `analyze`'s observations and the user's: by id, an edit, an addition and a removal
// each count once. Confirming isn't a change.
export function changedItems(before: StoredObservations, after: StoredObservations): number {
  const byId = (o: StoredObservations) => new Map(rowsOf(o).map((r) => [r.id, r]));
  const a = byId(before);
  const b = byId(after);
  let changed = 0;
  for (const [id, row] of b) if (!a.has(id) || !sameItem(a.get(id)!, row)) changed++;
  for (const id of a.keys()) if (!b.has(id)) changed++;
  return changed;
}

export function confirmedItems(o: StoredObservations): number {
  return rowsOf(o).filter((r) => r.confirmed).length;
}
