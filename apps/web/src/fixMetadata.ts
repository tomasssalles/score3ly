// `fix_metadata` (docs/stages/analyze.md): the metadata as a form. What doesn't need React: the kinds of field and their
// sections, the stored format and the rows the form edits, the checks, and the card's note. The form is in
// MetadataView.tsx, finishing in finishFixMetadata.ts.

import { TEXT_FIELDS, TITLE_TYPES, type Confidence, type Role, type TextField } from "@score3ly/prompts";
import type { ShownConfidence } from "./analyze";
import type { ApiStage } from "./api";

export const FIX_METADATA_VERSION = 1;

type TitleType = (typeof TITLE_TYPES)[number];
// The text fields the form knows: the model's, and the user's comment (never set by `analyze`).
export type TextKind = TextField | "comments";

// Every item: its page (none for what the user adds without one), the model's confidence (none for what the user
// added) and whether the user confirmed it (docs/stages/analyze.md: stored beside the confidence, not instead of it).
type Common = { page: number | null; confidence: Confidence | null; confirmed: boolean };

// The metadata as stored by `analyze` (pages always set, nothing confirmed) and by `fix_metadata`, and as shown.
export type ShownMetadata = {
  titles: ({ text: string; type: TitleType } & Common)[];
  people: ({ name: string; role: Role } & Common)[];
  pieces: ({ title: string; system: number } & Common)[];
} & Record<TextKind, ({ text: string } & Common)[]>;

// One field of the form: its kind (an id in FIELD_KINDS), its text, and for a piece the system where it starts (null
// only when every system already starts another piece). A piece's page is its system's.
export type MetadataRow = Common & { kind: string; text: string; system: number | null };

// `analyze`'s metadata output, and its pieces output if it has one.
export function analyzeOutputs(analyze: ApiStage | undefined) {
  const metadata = analyze?.outputs.find((o) => o.item === "" && o.type === "metadata" && o.contentSha256);
  return metadata ? { metadata, pieces: analyze!.outputs.find((o) => o.item === "" && o.type === "pieces") } : null;
}

// Stored metadata as the form uses it: `analyze`'s has no `confirmed` (nothing is), and the lists an older version
// didn't have (e.g. `compositionDates`, `comments`) are empty.
export function normalizeMetadata(json: unknown): ShownMetadata {
  const m = (json ?? {}) as Partial<ShownMetadata>;
  const common = <T extends Partial<Common>>(item: T) => ({ ...item, confidence: item.confidence ?? null, confirmed: item.confirmed ?? false });
  return {
    titles: (m.titles ?? []).map(common),
    people: (m.people ?? []).map(({ name, role, page, confidence, confirmed }) => common({ name, role, page, confidence, confirmed })),
    pieces: (m.pieces ?? []).map(common),
    ...(Object.fromEntries([...TEXT_FIELDS, "comments"].map((f) => [f, (m[f as TextKind] ?? []).map(common)])) as Record<TextKind, []>),
  };
}

// A field's confidence as the views show it: confirmed, else the model's.
export function shownConfidence(item: Common): ShownConfidence | null {
  return item.confirmed ? "confirmed" : item.confidence;
}

export function rowsOf(m: ShownMetadata): MetadataRow[] {
  const row = (kind: string, text: string, item: Common, system: number | null = null): MetadataRow => ({
    kind,
    text,
    system,
    page: item.page,
    confidence: item.confidence,
    confirmed: item.confirmed,
  });
  return [
    ...m.titles.map((t) => row(`title:${t.type}`, t.text, t)),
    ...m.people.map((p) => row(`person:${p.role}`, p.name, p)),
    ...m.pieces.map((p) => row("piece", p.title, p, p.system)),
    ...[...TEXT_FIELDS, "comments" as const].flatMap((field) => m[field].map((t) => row(`text:${field}`, t.text, t))),
  ];
}

// A field with nothing in it, which isn't stored. A piece without a title still says where it starts.
export function rowEmpty(row: MetadataRow): boolean {
  return !row.text.trim() && (row.kind !== "piece" || row.system === null);
}

// The rows as stored: empty ones dropped, the pieces by their system.
export function metadataOf(rows: MetadataRow[]): ShownMetadata {
  const m = normalizeMetadata({});
  for (const row of rows) {
    if (rowEmpty(row)) continue;
    const { page, confidence, confirmed } = row;
    const common = { page, confidence, confirmed };
    const text = row.text.trim();
    const [sort, which] = row.kind.split(":");
    if (sort === "title") m.titles.push({ text, type: which as TitleType, ...common });
    else if (sort === "person") m.people.push({ name: text, role: which as Role, ...common });
    else if (sort === "piece") m.pieces.push({ title: text, system: row.system!, ...common });
    else m[which as TextKind].push({ text, ...common });
  }
  m.pieces.sort((a, b) => a.system - b.system);
  return m;
}

// Two fields the same, but for their confidence and whether they are confirmed.
export function sameField(a: MetadataRow, b: MetadataRow): boolean {
  return a.kind === b.kind && a.text === b.text && a.system === b.system && a.page === b.page;
}

// The systems pieces start at, but for the one being edited: they can't be picked for it.
export function takenSystems(rows: MetadataRow[], except: number): Set<number> {
  return new Set(rows.flatMap((r, i) => (i !== except && r.kind === "piece" && r.system !== null ? [r.system] : [])));
}

// Why a piece can't be saved, if it can't: it starts at a system no other piece starts at.
export function pieceProblem(row: MetadataRow, others: MetadataRow[]): string | null {
  if (row.kind !== "piece") return null;
  if (row.system === null) return "Every system already starts a piece.";
  if (others.some((o) => o.kind === "piece" && o.system === row.system)) return `Another piece starts at system ${row.system}.`;
  return null;
}

// How many fields changed between the model's metadata and the user's: an edit, an addition and a removal each
// count once (an edited field is one the original no longer has, and one it didn't have). Confirming isn't a change.
export function changedFields(before: ShownMetadata, after: ShownMetadata): number {
  const unmatched = rowsOf(before);
  let added = 0;
  for (const row of rowsOf(after)) {
    const i = unmatched.findIndex((o) => sameField(o, row));
    if (i >= 0) unmatched.splice(i, 1);
    else added++;
  }
  return Math.max(added, unmatched.length);
}

export function confirmedFields(m: ShownMetadata): number {
  return rowsOf(m).filter((row) => row.confirmed).length;
}

// The card's result: "2 changed · 5 confirmed", "5 confirmed", or "no changes".
export function fixNote(changed: number, confirmed: number): string {
  const parts = [changed > 0 && `${changed} changed`, confirmed > 0 && `${confirmed} confirmed`].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "no changes";
}

// The kinds of field, in the form's order: the sections in their order, and each section's kinds in theirs
// (docs/stages/analyze.md, "The metadata"). `label` names the field, `short` too where the edit mode's picker needs it shorter.
export type FieldKind = { id: string; section: string; label: string; short?: string };

const kind = (section: string, id: string, label: string, short?: string): FieldKind => ({ id, section, label, short });

export const FIELD_KINDS: FieldKind[] = [
  kind("Titles", "title:main", "Title"),
  kind("Titles", "title:subtitle", "Subtitle"),
  kind("Titles", "title:alternative", "Alternative title"),
  kind("Titles", "title:translated", "Translated title"),
  kind("Work", "person:composer", "Composer"),
  kind("Work", "person:lyricist", "Lyricist"),
  kind("Work", "person:librettist", "Librettist"),
  kind("Work", "text:catalogueNumbers", "Catalogue number"),
  kind("Work", "text:dedications", "Dedication"),
  kind("Work", "text:instrumentation", "Instrumentation"),
  kind("Work", "text:compositionDates", "Composition date"),
  kind("Arrangement", "person:arranger", "Arranger"),
  kind("Arrangement", "person:translator", "Translator"),
  kind("Pieces or movements", "piece", "Piece or movement", "Piece/Mov."),
  kind("Edition", "person:editor", "Editor"),
  kind("Edition", "person:other", "Other person"),
  kind("Edition", "text:publishers", "Publisher"),
  kind("Edition", "text:places", "Place"),
  kind("Edition", "text:dates", "Date"),
  kind("Edition", "text:plateNumbers", "Plate number"),
  kind("Edition", "text:notices", "Notice"),
  kind("Comment", "text:comments", "Comment"),
];

export const SECTIONS = [...new Set(FIELD_KINDS.map((k) => k.section))];

export function kindOf(row: MetadataRow): FieldKind {
  return FIELD_KINDS.find((k) => k.id === row.kind)!;
}

// The systems and their pages, for the pieces: `pageOf[n - 1]` is the page of system n.
export type Systems = { pageOf: number[] };

// The first system no other piece starts at, or null.
function freeSystem(rows: MetadataRow[], except: number, systems: Systems): number | null {
  const taken = takenSystems(rows, except);
  for (let n = 1; n <= systems.pageOf.length; n++) if (!taken.has(n)) return n;
  return null;
}

// A new, empty field of a kind, for the form's "+" (a piece at the first free system, on its page): the user's, so no
// confidence, and confirmed.
export function newRow(kind: FieldKind, rows: MetadataRow[], systems: Systems): MetadataRow {
  const empty: MetadataRow = { kind: "text:comments", text: "", system: null, page: null, confidence: null, confirmed: true };
  return withKind(empty, kind, rows, -1, systems);
}

// A field (the row at `index`, or a new one) turned into another kind, its text kept. Becoming a piece, it starts at
// the first free system and takes that system's page; no longer a piece, it keeps the page.
export function withKind(row: MetadataRow, kind: FieldKind, rows: MetadataRow[], index: number, systems: Systems): MetadataRow {
  if (kind.id !== "piece") return { ...row, kind: kind.id, system: null };
  if (row.kind === "piece") return row;
  const system = freeSystem(rows, index, systems);
  return { ...row, kind: "piece", system, page: system === null ? row.page : (systems.pageOf[system - 1] ?? null) };
}

// A piece moved to another system, and to its page.
export function withSystem(row: MetadataRow, system: number, systems: Systems): MetadataRow {
  return { ...row, system, page: systems.pageOf[system - 1] ?? null };
}

// The rows (by their index) in the form's order: section by section, kind by kind, and within a kind as stored;
// the pieces by their system.
export function sectionsOf(rows: MetadataRow[]): { title: string; indices: number[] }[] {
  const order = (i: number) => FIELD_KINDS.indexOf(kindOf(rows[i]));
  const system = (i: number) => rows[i].system ?? Infinity;
  const sorted = rows.map((_, i) => i).sort((a, b) => order(a) - order(b) || system(a) - system(b) || a - b);
  return SECTIONS.map((title) => ({ title, indices: sorted.filter((i) => kindOf(rows[i]).section === title) })).filter(
    (s) => s.indices.length > 0,
  );
}
