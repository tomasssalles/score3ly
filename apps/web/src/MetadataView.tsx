// The metadata (docs/stages/analyze.md): `analyze`'s and a finished `fix_metadata`'s, read-only, and a WIP `fix_metadata`'s
// form. Both list the fields by section, each with its page ("p. –" without one), an eye and its confidence. The eye
// opens the pages at the field's page (at the first without one), with only that field in a thin strip above them.
// In the form, every field has a "⋮" with Edit, Confirm (Unconfirm) and Remove, also in the strip, so it can be
// edited while looking at the page, and one "+" adds any kind of field. A field is saved when it leaves edit mode,
// when it is confirmed or unconfirmed, and when the form closes. Saving an edit confirms the field; adding one too.

import { useEffect, useRef } from "react";
import { fetchJsonContent, recordOutputs, type Project } from "./api";
import { PagesFilmstrip } from "./editor/PageViews";
import type { MenuItem } from "./ui/DropdownMenu";
import { EditorRow, fieldActions, FieldListView, FieldPicker, FieldRow, useFieldList, useLayoutSystems, type Editing } from "./fieldList";
import { metadataOutputs, type MetadataParents } from "./finishFixMetadata";
import {
  FIELD_KINDS,
  kindOf,
  metadataOf,
  newRow,
  pieceProblem,
  rowEmpty,
  rowsOf,
  sameField,
  SECTIONS,
  sectionsOf,
  takenSystems,
  withKind,
  withSystem,
  type MetadataRow,
  type Systems,
} from "./fixMetadata";
import { normalizeMetadata, shownConfidence } from "./analyze";
import type { Artifact } from "./pipeline";

export function MetadataView({ project, artifact, onEdited }: { project: Project; artifact: Artifact; onEdited?: () => void }) {
  const analysis = artifact.analysis!;
  const parents = analysis.parents;
  const editor = artifact.editor?.step === "fix_metadata" && parents ? artifact.editor : null;
  const pages = artifact.pages ?? [];
  // The systems a piece can start at: all of them, numbered across the pages, each with its page.
  const layouts = useLayoutSystems(
    pages.flatMap((p) => (p.layoutSha256 ? [{ page: p.page, layoutSha256: p.layoutSha256 }] : [])),
    !!editor,
    analysis.sha256,
  );
  const systems: Systems = { pageOf: layouts.systems.map((s) => s.page) };
  const list = useFieldList<MetadataRow>(
    { sha256: analysis.sha256, load: async () => rowsOf(normalizeMetadata(await fetchJsonContent(analysis.sha256))) },
    editor && {
      stageId: editor.stageId,
      save: async (rows) => {
        await recordOutputs(project, editor.stageId, await metadataOutputs(metadataOf(rows), parents as MetadataParents));
        onEdited?.();
      },
    },
    { empty: rowEmpty, problem: pieceProblem, same: sameField },
  );
  const { rows, editing, focus } = list;

  const field = (index: number) => {
    const row = rows![index];
    if (editing?.index === index) {
      return (
        <FieldEditor
          key={index}
          editing={editing}
          rows={rows!}
          systems={systems}
          pages={pages.map((p) => p.page)}
          onChange={list.setDraft}
          onDone={list.finishEditing}
          onCancel={list.cancelEditing}
        />
      );
    }
    const { label, text } = shown(row);
    return (
      <FieldRow
        key={index}
        className="analysis-row metadata-row"
        label={label}
        text={text}
        page={<span className="field-page">p. {row.page ?? "–"}</span>}
        onOpen={focus === null ? () => list.setFocus(index) : undefined}
        confidence={shownConfidence(row)}
        actions={
          editor &&
          fieldActions(row, {
            edit: () => list.edit(index),
            confirm: () => list.confirm(index, !row.confirmed),
            remove: () => list.remove(index),
          })
        }
      />
    );
  };

  return (
    <FieldListView
      list={list}
      error={list.error ?? layouts.error}
      editor={!!editor}
      add={{
        label: "Add a field",
        groups: SECTIONS.map((s) =>
          FIELD_KINDS.filter((k) => k.section === s).map((k) => ({ label: k.label, onSelect: () => list.add((rows) => newRow(k, rows, systems)) })),
        ),
        headings: SECTIONS,
      }}
      sections={sectionsOf}
      field={field}
      strip={(index) => {
        const page = rows![index].page;
        return <PagesFilmstrip key={`${index}:${page}`} pages={pages} page={page ?? undefined} />;
      }}
      empty={{ form: "No metadata yet: add fields with +.", view: "No metadata was found on the pages." }}
    />
  );
}

// A field's label and text as shown.
function shown(row: MetadataRow): { label: string; text: string } {
  if (row.kind === "piece") return { label: row.system === null ? "Piece or movement" : `From system ${row.system}`, text: row.text };
  return { label: kindOf(row).label, text: row.text };
}

// A field in edit mode, in two rows (docs/stages/analyze.md): its kind, its page (a piece: its system, which sets the page) and
// the ✓; then its text.
function FieldEditor({
  editing,
  rows,
  systems,
  pages,
  onChange,
  onDone,
  onCancel,
}: {
  editing: Editing<MetadataRow>;
  rows: MetadataRow[];
  systems: Systems;
  pages: number[]; // the pages of the score, for the page picker
  onChange: (draft: MetadataRow) => void;
  onDone: () => boolean;
  onCancel: () => void;
}) {
  const row = editing.draft;
  const text = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => text.current?.focus(), []);
  const kind = kindOf(row);
  const taken = takenSystems(rows, editing.index);

  const picker = (value: string, label: string, groups: MenuItem[][], headings?: string[], className = "") => (
    <FieldPicker value={value} label={label} groups={groups} headings={headings} className={className} />
  );
  const numbers = (values: number[], current: number | null, pick: (n: number) => void, disabled?: Set<number>) =>
    values.map((n) => ({ label: String(n), current: n === current, disabled: disabled?.has(n), onSelect: () => pick(n) }));

  return (
    <EditorRow
      problem={editing.problem}
      onDone={onDone}
      onCancel={onCancel}
      head={
        <>
          {picker(
            kind.short ?? kind.label,
            "Kind of field",
            SECTIONS.map((s) =>
              FIELD_KINDS.filter((k) => k.section === s).map((k) => ({
                label: k.label,
                current: k.id === kind.id,
                onSelect: () => onChange(withKind(row, k, rows, editing.index, systems)),
              })),
            ),
            SECTIONS,
            "field-kind-picker",
          )}
          {row.kind === "piece" ? (
            <>
              <span className="field-edit-label">from system</span>
              {picker(
                row.system === null ? "–" : String(row.system),
                "Starts at system",
                [numbers(systems.pageOf.map((_, i) => i + 1), row.system, (n) => onChange(withSystem(row, n, systems)), taken)],
                undefined,
                "number-picker",
              )}
            </>
          ) : (
            <>
              <span className="field-edit-label">p.</span>
              {picker(
                row.page === null ? "–" : String(row.page),
                "Page",
                [[{ label: "–", current: row.page === null, onSelect: () => onChange({ ...row, page: null }) }, ...numbers(pages, row.page, (n) => onChange({ ...row, page: n }))]],
                undefined,
                "number-picker",
              )}
            </>
          )}
        </>
      }
    >
      {row.kind === "text:comments" ? (
        <textarea
          ref={text}
          className="field-input"
          rows={2}
          value={row.text}
          placeholder="Comment"
          aria-label="Comment"
          onChange={(e) => onChange({ ...row, text: e.target.value })}
        />
      ) : (
        <input
          ref={text}
          className="field-input"
          value={row.text}
          placeholder={row.kind === "piece" ? "Title or number" : row.kind.startsWith("person:") ? "Name" : "As printed"}
          aria-label={kind.label}
          onChange={(e) => onChange({ ...row, text: e.target.value })}
        />
      )}
    </EditorRow>
  );
}
