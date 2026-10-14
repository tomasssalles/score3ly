// `fix_metadata` (DESIGN.md §6): the metadata as a form. What doesn't need React: the kinds of field and their
// sections, the stored format and the rows the form edits, the checks, and the card's note. The form is in
// MetadataView.tsx, finishing in finishFixMetadata.ts.

import { ROLES, TEXT_FIELDS, TITLE_TYPES, type Role, type TextField } from "@score3ly/prompts";
import type { ShownConfidence } from "./analyze";
import type { ApiStage } from "./api";

export const FIX_METADATA_VERSION = 1;

type TitleType = (typeof TITLE_TYPES)[number];
// The text fields the form knows: the model's, and the user's comment (never set by `analyze`).
export type TextKind = TextField | "comments";

// Every item: its page (none for what the user adds without one) and its confidence.
type Common = { page: number | null; confidence: ShownConfidence };

// The metadata as stored by `analyze` (pages always set, nothing confirmed) and by `fix_metadata`, and as shown.
export type ShownMetadata = {
  titles: ({ text: string; type: TitleType } & Common)[];
  people: ({ name: string; role: Role; printedRole: string } & Common)[];
  pieces: ({ title: string; system: number } & Common)[];
} & Record<TextKind, ({ text: string } & Common)[]>;

// One field of the form. A piece's system is null only while it is being typed.
export type MetadataRow = Common &
  (
    | { kind: "title"; type: TitleType; text: string }
    | { kind: "person"; role: Role; name: string; printedRole: string }
    | { kind: "piece"; title: string; system: number | null }
    | { kind: "text"; field: TextKind; text: string }
  );

// `analyze`'s metadata output, and its pieces output if it has one.
export function analyzeOutputs(analyze: ApiStage | undefined) {
  const metadata = analyze?.outputs.find((o) => o.item === "" && o.type === "metadata" && o.contentSha256);
  return metadata ? { metadata, pieces: analyze!.outputs.find((o) => o.item === "" && o.type === "pieces") } : null;
}

// Stored metadata, with the lists an older version didn't have (e.g. `compositionDates`, `comments`) as empty.
export function normalizeMetadata(json: unknown): ShownMetadata {
  const m = (json ?? {}) as Partial<ShownMetadata>;
  return {
    titles: m.titles ?? [],
    people: m.people ?? [],
    pieces: m.pieces ?? [],
    ...(Object.fromEntries([...TEXT_FIELDS, "comments"].map((f) => [f, m[f as TextKind] ?? []])) as Record<TextKind, []>),
  };
}

export function rowsOf(m: ShownMetadata): MetadataRow[] {
  return [
    ...m.titles.map((t): MetadataRow => ({ kind: "title", ...t })),
    ...m.people.map((p): MetadataRow => ({ kind: "person", ...p })),
    ...m.pieces.map((p): MetadataRow => ({ kind: "piece", ...p })),
    ...[...TEXT_FIELDS, "comments" as const].flatMap((field) => m[field].map((t): MetadataRow => ({ kind: "text", field, ...t }))),
  ];
}

// A field with nothing in it, which isn't stored.
export function rowEmpty(row: MetadataRow): boolean {
  switch (row.kind) {
    case "person":
      return !row.name.trim();
    case "piece":
      return !row.title.trim() && row.system === null;
    default:
      return !row.text.trim();
  }
}

// The rows as stored: empty ones dropped, the pieces by their system.
export function metadataOf(rows: MetadataRow[]): ShownMetadata {
  const m = normalizeMetadata({});
  for (const row of rows) {
    if (rowEmpty(row)) continue;
    const { page, confidence } = row;
    switch (row.kind) {
      case "title":
        m.titles.push({ text: row.text.trim(), type: row.type, page, confidence });
        break;
      case "person":
        m.people.push({ name: row.name.trim(), role: row.role, printedRole: row.printedRole.trim(), page, confidence });
        break;
      case "piece":
        if (row.system !== null) m.pieces.push({ title: row.title.trim(), system: row.system, page, confidence });
        break;
      case "text":
        m[row.field].push({ text: row.text.trim(), page, confidence });
    }
  }
  m.pieces.sort((a, b) => a.system - b.system);
  return m;
}

// Every field confirmed: what finishing the stage records.
export function confirmAll(m: ShownMetadata): ShownMetadata {
  return metadataOf(rowsOf(m).map((row) => ({ ...row, confidence: "confirmed" })));
}

// Two fields the same, but for their confidence.
export function sameField(a: MetadataRow, b: MetadataRow): boolean {
  const strip = (row: MetadataRow) => JSON.stringify({ ...row, confidence: null }, Object.keys({ ...row }).sort());
  return strip(a) === strip(b);
}

// Why a piece can't be saved, if it can't: its system is required, must exist, and starts no other piece.
export function pieceProblem(row: MetadataRow, others: MetadataRow[], systemCount: number): string | null {
  if (row.kind !== "piece") return null;
  if (row.system === null) return "A piece needs the system where it starts.";
  if (Number.isNaN(row.system)) return "The system is a number.";
  if (!Number.isInteger(row.system) || row.system < 1 || row.system > systemCount) {
    return `There is no system ${row.system}: the systems are numbered 1 to ${systemCount}.`;
  }
  if (others.some((o) => o.kind === "piece" && o.system === row.system)) return `Another piece starts at system ${row.system}.`;
  return null;
}

// How many fields changed between the model's metadata and the user's: an edit, an addition and a removal each
// count once (an edited field is one the original no longer has, and one it didn't have).
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

export function fixMetadataNote(changed: number): string {
  return changed === 0 ? "no changes" : `${changed} field${changed === 1 ? "" : "s"} changed`;
}

// The kinds of field, in the form's order: the sections in their order, and each section's kinds in theirs
// (DESIGN.md §6, "Metadata"). `label` names the field; `make` is a new, empty one, for the form's "+".
export type FieldKind = { section: string; label: string; matches: (row: MetadataRow) => boolean; make: () => MetadataRow };

const blank = { page: null, confidence: "confirmed" as const };
const title = (type: TitleType, label: string): FieldKind => ({
  section: "Titles",
  label,
  matches: (r) => r.kind === "title" && r.type === type,
  make: () => ({ kind: "title", type, text: "", ...blank }),
});
const person = (section: string, role: Role, label: string): FieldKind => ({
  section,
  label,
  matches: (r) => r.kind === "person" && r.role === role,
  make: () => ({ kind: "person", role, name: "", printedRole: "", ...blank }),
});
const text = (section: string, field: TextKind, label: string): FieldKind => ({
  section,
  label,
  matches: (r) => r.kind === "text" && r.field === field,
  make: () => ({ kind: "text", field, text: "", ...blank }),
});

export const FIELD_KINDS: FieldKind[] = [
  title("main", "Title"),
  title("subtitle", "Subtitle"),
  title("alternative", "Alternative title"),
  title("translated", "Translated title"),
  person("Work", "composer", "Composer"),
  person("Work", "lyricist", "Lyricist"),
  person("Work", "librettist", "Librettist"),
  text("Work", "catalogueNumbers", "Catalogue number"),
  text("Work", "dedications", "Dedication"),
  text("Work", "instrumentation", "Instrumentation"),
  text("Work", "compositionDates", "Composition date"),
  person("Arrangement", "arranger", "Arranger"),
  person("Arrangement", "translator", "Translator"),
  {
    section: "Pieces or movements",
    label: "Piece or movement",
    matches: (r) => r.kind === "piece",
    make: () => ({ kind: "piece", title: "", system: null, ...blank }),
  },
  person("Edition", "editor", "Editor"),
  person("Edition", "other", "Other person"),
  text("Edition", "publishers", "Publisher"),
  text("Edition", "places", "Place"),
  text("Edition", "dates", "Date"),
  text("Edition", "plateNumbers", "Plate number"),
  text("Edition", "notices", "Notice"),
  text("Comment", "comments", "Comment"),
];

export const SECTIONS = [...new Set(FIELD_KINDS.map((k) => k.section))];

export function kindOf(row: MetadataRow): FieldKind {
  return FIELD_KINDS.find((k) => k.matches(row))!;
}

// The rows (by their index) in the form's order: section by section, kind by kind, and within a kind as stored;
// the pieces by their system (one still being typed last).
export function sectionsOf(rows: MetadataRow[]): { title: string; indices: number[] }[] {
  const order = (i: number) => FIELD_KINDS.indexOf(kindOf(rows[i]));
  const system = (i: number) => {
    const row = rows[i];
    return row.kind === "piece" ? (row.system ?? Infinity) : 0;
  };
  const sorted = rows.map((_, i) => i).sort((a, b) => order(a) - order(b) || system(a) - system(b) || a - b);
  return SECTIONS.map((title) => ({ title, indices: sorted.filter((i) => kindOf(rows[i]).section === title) })).filter(
    (s) => s.indices.length > 0,
  );
}

// The choices of a field's drop-down in edit mode: the other kinds it can become, keeping what was typed.
export const TITLE_CHOICES = FIELD_KINDS.filter((k) => k.section === "Titles");
export const ROLE_CHOICES = ROLES.map((role) => FIELD_KINDS.find((k) => k.matches({ kind: "person", role, name: "", printedRole: "", ...blank }))!);
export const TEXT_CHOICES = FIELD_KINDS.filter((k) => {
  const row = k.make();
  return row.kind === "text" && row.field !== "comments";
});

// A field turned into another kind (a composer into an arranger), what was typed kept.
export function withKind(row: MetadataRow, kind: FieldKind): MetadataRow {
  const made = kind.make();
  if (made.kind === "title" && row.kind === "title") return { ...row, type: made.type };
  if (made.kind === "person" && row.kind === "person") return { ...row, role: made.role };
  if (made.kind === "text" && row.kind === "text") return { ...row, field: made.field };
  return row;
}
