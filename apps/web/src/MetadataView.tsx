// The metadata (docs/stages/analyze.md): `analyze`'s and a finished `fix_metadata`'s, read-only, and a WIP `fix_metadata`'s
// form. Both list the fields by section, each with its page ("p. –" without one), an eye and its confidence. The eye
// opens the pages at the field's page (at the first without one), with only that field in a thin strip above them.
// In the form, every field has a "⋮" with Edit, Confirm (Unconfirm) and Remove, also in the strip, so it can be
// edited while looking at the page, and one "+" adds any kind of field. A field is saved when it leaves edit mode,
// when it is confirmed or unconfirmed, and when the form closes. Saving an edit confirms the field; adding one too.

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { fetchJsonContent, recordOutputs, type Project } from "./api";
import { Filmstrip, PageImageView } from "./ArtifactView";
import { DropdownMenu, type MenuItem } from "./DropdownMenu";
import { Confidence, fieldActions, FieldStrip, Picker, useFieldList, type Editing } from "./fieldList";
import { metadataOutputs, type MetadataParents } from "./finishFixMetadata";
import {
  FIELD_KINDS,
  kindOf,
  metadataOf,
  newRow,
  normalizeMetadata,
  pieceProblem,
  rowEmpty,
  rowsOf,
  sameField,
  SECTIONS,
  sectionsOf,
  shownConfidence,
  takenSystems,
  withKind,
  withSystem,
  type FieldKind,
  type MetadataRow,
  type Systems,
} from "./fixMetadata";
import { CheckIcon, EyeIcon, MoreIcon, PlusIcon } from "./icons";
import type { PageLayout } from "./layout";
import type { Artifact } from "./pipeline";
import type { PageRecipe } from "./rasterize";

export function MetadataView({ project, artifact, onEdited }: { project: Project; artifact: Artifact; onEdited?: () => void }) {
  const analysis = artifact.analysis!;
  const parents = analysis.parents;
  const editor = artifact.editor?.step === "fix_metadata" && parents ? artifact.editor : null;
  const pages = artifact.pages ?? [];
  const [systems, setSystems] = useState<Systems>({ pageOf: [] });
  const [layoutError, setLayoutError] = useState<string | null>(null);
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

  // The systems a piece can start at: all of them, numbered across the pages, each with its page.
  useEffect(() => {
    if (!editor) return;
    let cancelled = false;
    const withLayout = pages.filter((p) => p.layoutSha256);
    Promise.all(withLayout.map((p) => fetchJsonContent(p.layoutSha256!) as Promise<PageLayout>)).then(
      (layouts) => !cancelled && setSystems({ pageOf: layouts.flatMap((l, i) => l.systems.map(() => withLayout[i].page)) }),
      () => !cancelled && setLayoutError("The layout couldn't be loaded."),
    );
    return () => {
      cancelled = true;
    };
  }, [analysis.sha256]);

  const error = list.error ?? layoutError;
  if (!rows) return <div className="text-view"><p>{error ?? "Loading…"}</p></div>;

  const field = (index: number) => {
    const row = rows[index];
    if (editing?.index === index) {
      return (
        <FieldEditor
          key={index}
          editing={editing}
          rows={rows}
          systems={systems}
          pages={pages.map((p) => p.page)}
          onChange={list.setDraft}
          onDone={list.finishEditing}
          onCancel={list.cancelEditing}
        />
      );
    }
    return (
      <Field
        key={index}
        row={row}
        onOpen={focus === null ? () => list.setFocus(index) : undefined}
        actions={
          editor && {
            edit: () => list.edit(index),
            confirm: () => list.confirm(index, !row.confirmed),
            remove: () => list.remove(index),
          }
        }
      />
    );
  };

  if (focus !== null && rows[focus]) {
    const page = rows[focus].page;
    return (
      <FieldStrip field={field(focus)} editing={editing?.index === focus} onClose={() => list.setFocus(null)}>
        <PagesFilmstrip key={`${focus}:${page}`} pages={pages} page={page ?? undefined} />
      </FieldStrip>
    );
  }

  const sections = sectionsOf(rows);
  return (
    <div className="text-view analysis">
      {editor && (
        <div className="metadata-tools">
          {error && <p className="field-problem">{error}</p>}
          <DropdownMenu
            icon={<PlusIcon />}
            label="Add a field"
            className="metadata-add"
            groups={SECTIONS.map((s) =>
              FIELD_KINDS.filter((k) => k.section === s).map((k) => ({ label: k.label, onSelect: () => list.add((rows) => newRow(k, rows, systems)) })),
            )}
            headings={SECTIONS}
          />
        </div>
      )}
      {sections.length === 0 && <p className="muted">{editor ? "No metadata yet: add fields with +." : "No metadata was found on the pages."}</p>}
      {sections.map((section) => (
        <section key={section.title}>
          <h3>{section.title}</h3>
          <ul>{section.indices.map(field)}</ul>
        </section>
      ))}
    </div>
  );
}

// A field's label and text as shown.
function shown(row: MetadataRow): { label: string; text: string } {
  if (row.kind === "piece") return { label: row.system === null ? "Piece or movement" : `From system ${row.system}`, text: row.text };
  return { label: kindOf(row).label, text: row.text };
}

function Field({
  row,
  onOpen,
  actions,
}: {
  row: MetadataRow;
  onOpen?: () => void; // none in the strip, where the pages are open already
  actions: { edit: () => void; confirm: () => void; remove: () => void } | null;
}) {
  const confidence = shownConfidence(row);
  const { label, text } = shown(row);
  return (
    <li className="analysis-row metadata-row">
      <span className="field-label">{label}</span>
      <span className="field-text">{text}</span>
      <span className="field-page">p. {row.page ?? "–"}</span>
      {onOpen && (
        <button type="button" className="icon-button field-open" aria-label="Show in the score" title="Show in the score" onClick={onOpen}>
          <EyeIcon />
        </button>
      )}
      <Confidence value={confidence} />
      {actions && <DropdownMenu icon={<MoreIcon />} label={`${label}: actions`} className="field-actions" groups={fieldActions(row, actions)} />}
    </li>
  );
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

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onCancel();
    } else if (e.key === "Enter" && e.target === text.current && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
      onDone();
    }
  }

  const picker = (value: string, label: string, groups: MenuItem[][], headings?: string[], className = "") => (
    <Picker value={value} label={label} groups={groups} headings={headings} className={className} />
  );
  const numbers = (values: number[], current: number | null, pick: (n: number) => void, disabled?: Set<number>) =>
    values.map((n) => ({ label: String(n), current: n === current, disabled: disabled?.has(n), onSelect: () => pick(n) }));

  return (
    <li
      className="analysis-row editing"
      onKeyDown={onKeyDown}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onDone();
      }}
    >
      <div className="field-edit-head">
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
        <span className="field-edit-space" />
        <button type="button" className="field-done" aria-label="Done" title="Done" onClick={onDone}>
          <CheckIcon />
        </button>
      </div>
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
      {editing.problem && <p className="field-problem">{editing.problem}</p>}
    </li>
  );
}

// The pages as they are, opened at one of them (at the first without one).
function PagesFilmstrip({ pages, page }: { pages: { page: number; recipe: PageRecipe }[]; page?: number }): ReactNode {
  const index = pages.findIndex((p) => p.page === page);
  return (
    <Filmstrip
      count={pages.length}
      wide={false}
      focus={index >= 0 ? { index } : undefined}
      render={(i) => (
        <figure className="film-item">
          <figcaption>Page {pages[i].page}</figcaption>
          <PageImageView recipe={pages[i].recipe} />
        </figure>
      )}
    />
  );
}
