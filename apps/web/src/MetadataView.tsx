// The metadata (DESIGN.md §6): `analyze`'s and a finished `fix_metadata`'s, read-only, and a WIP `fix_metadata`'s
// form. Both list the fields by section, each with its page ("p. –" without one), an eye and its confidence. The eye
// opens the pages at the field's page (at the first without one), with only that field in a thin strip above them.
// In the form, every field has a "⋮" with Edit and Remove, also in the strip, so it can be edited while looking at
// the page, and one "+" adds any kind of field. A field is saved when it leaves edit mode, and when the form closes.

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { CONFIDENCE_SYMBOLS, type ShownConfidence } from "./analyze";
import { fetchJsonContent, recordOutputs, type Project } from "./api";
import { Filmstrip, PageImageView } from "./ArtifactView";
import { DropdownMenu, type MenuItem } from "./DropdownMenu";
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
  takenSystems,
  withKind,
  withSystem,
  type FieldKind,
  type MetadataRow,
  type Systems,
} from "./fixMetadata";
import { CheckIcon, ChevronDownIcon, CloseIcon, EyeIcon, MoreIcon, PlusIcon } from "./icons";
import type { PageLayout } from "./layout";
import type { Artifact } from "./pipeline";
import type { PageRecipe } from "./rasterize";

// What a form saved on this device and isn't yet in the pipeline the app has, by stage.
const saved = new Map<string, MetadataRow[]>();

// The field being edited: its row's index, what has been typed, whether it was just added, and why it can't be saved.
type Editing = { index: number; draft: MetadataRow; added: boolean; problem: string | null };

export function MetadataView({ project, artifact, onEdited }: { project: Project; artifact: Artifact; onEdited?: () => void }) {
  const analysis = artifact.analysis!;
  const form = artifact.editor?.step === "fix_metadata" && analysis.parents ? { stageId: artifact.editor.stageId, parents: analysis.parents } : null;
  const pages = artifact.pages ?? [];
  const [rows, setRows] = useState<MetadataRow[] | null>(null);
  const [systems, setSystems] = useState<Systems>({ pageOf: [] });
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [focus, setFocus] = useState<number | null>(null); // the row whose pages are open
  const chain = useRef(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    const own = form && saved.get(form.stageId);
    (own ? Promise.resolve(own) : fetchJsonContent(analysis.sha256).then((json) => rowsOf(normalizeMetadata(json)))).then(
      (loaded) => !cancelled && setRows(loaded),
      () => !cancelled && setError("This couldn't be loaded."),
    );
    // The systems a piece can start at: all of them, numbered across the pages, each with its page.
    if (form) {
      const withLayout = pages.filter((p) => p.layoutSha256);
      Promise.all(withLayout.map((p) => fetchJsonContent(p.layoutSha256!) as Promise<PageLayout>)).then(
        (layouts) => !cancelled && setSystems({ pageOf: layouts.flatMap((l, i) => l.systems.map(() => withLayout[i].page)) }),
        () => !cancelled && setError("The layout couldn't be loaded."),
      );
    }
    return () => {
      cancelled = true;
    };
  }, [analysis.sha256]);

  function save(next: MetadataRow[]) {
    if (!form) return;
    saved.set(form.stageId, next);
    chain.current = chain.current
      .then(async () => {
        await recordOutputs(project, form.stageId, await metadataOutputs(metadataOf(next), form.parents as MetadataParents));
        setError(null);
        onEdited?.();
      })
      .catch((err) => setError(`Saving failed: ${err instanceof Error ? err.message : err}`));
  }

  // The field being edited, ended: saved if it changed (and confirmed, DESIGN.md §6), removed if it was emptied.
  // Returns the rows after it, or null if it can't be saved yet. A field left as it was keeps its confidence.
  function commit(current: MetadataRow[], edit: Editing): MetadataRow[] | null {
    const { index, draft, added } = edit;
    if (rowEmpty(draft)) return current.filter((_, i) => i !== index);
    const problem = pieceProblem(draft, current.filter((_, i) => i !== index));
    if (problem) {
      setEditing({ ...edit, problem });
      return null;
    }
    if (!added && sameField(draft, current[index])) return current;
    return current.map((row, i) => (i === index ? { ...draft, confidence: "confirmed" } : row));
  }

  // Ends the edit. Returns the rows after it and the index of the row it removed (an emptied field), or null if the
  // field can't be saved yet: it stays in edit mode, with the reason.
  function finishEditing(): { rows: MetadataRow[]; removed: number | null } | null {
    if (!rows) return null;
    if (!editing) return { rows, removed: null };
    const next = commit(rows, editing);
    if (!next) return null;
    setEditing(null);
    const removed = next.length < rows.length ? editing.index : null;
    if (next !== rows) {
      setRows(next);
      if (focus !== null && removed !== null) setFocus(focus === removed ? null : focus > removed ? focus - 1 : focus);
      // An added field left empty was never saved, and nothing changes.
      if (!(editing.added && removed !== null)) save(next);
    }
    return { rows: next, removed };
  }

  // An index from before the edit ended, after it.
  const after = (index: number, removed: number | null) => (removed !== null && index > removed ? index - 1 : index);

  function cancelEditing() {
    if (!editing || !rows) return;
    if (editing.added) {
      setRows(rows.filter((_, i) => i !== editing.index));
      if (focus === editing.index) setFocus(null);
    }
    setEditing(null);
  }

  function edit(index: number) {
    const ended = finishEditing();
    if (!ended) return;
    const i = after(index, ended.removed);
    setEditing({ index: i, draft: ended.rows[i], added: false, problem: null });
  }

  function remove(index: number) {
    const ended = finishEditing();
    if (!ended) return;
    const i = after(index, ended.removed);
    const next = ended.rows.filter((_, j) => j !== i);
    setRows(next);
    if (focus !== null) {
      const f = after(focus, ended.removed);
      setFocus(f === i ? null : f > i ? f - 1 : f);
    }
    save(next);
  }

  function add(kind: FieldKind) {
    const ended = finishEditing();
    if (!ended) return;
    const made = newRow(kind, ended.rows, systems);
    setRows([...ended.rows, made]);
    setEditing({ index: ended.rows.length, draft: made, added: true, problem: null });
  }

  // Closing the form saves the field being edited, if it can be saved.
  const latest = useRef({ rows, editing });
  latest.current = { rows, editing };
  useEffect(
    () => () => {
      const { rows, editing } = latest.current;
      if (!rows || !editing || rowEmpty(editing.draft)) return;
      if (pieceProblem(editing.draft, rows.filter((_, i) => i !== editing.index))) return;
      if (!editing.added && sameField(editing.draft, rows[editing.index])) return;
      save(rows.map((row, i) => (i === editing.index ? { ...editing.draft, confidence: "confirmed" } : row)));
    },
    [],
  );

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
          onChange={(draft) => setEditing({ ...editing, draft, problem: null })}
          onDone={() => finishEditing() !== null}
          onCancel={cancelEditing}
        />
      );
    }
    return (
      <Field
        key={index}
        row={row}
        confirmed={analysis.confirmed}
        onOpen={focus === null ? () => setFocus(index) : undefined}
        actions={form && { edit: () => edit(index), remove: () => remove(index) }}
      />
    );
  };

  if (focus !== null && rows[focus]) {
    const page = rows[focus].page;
    return (
      <div className="analysis-focus">
        <div className="analysis-strip">
          <ul className="analysis-strip-text">{field(focus)}</ul>
          {/* Hidden while the field is edited: leaving it saves it, and the strip stays compact. */}
          {editing?.index !== focus && (
            <button type="button" className="icon-button" aria-label="Close the pages" onClick={() => setFocus(null)}>
              <CloseIcon />
            </button>
          )}
        </div>
        <PagesFilmstrip key={`${focus}:${page}`} pages={pages} page={page ?? undefined} />
      </div>
    );
  }

  const sections = sectionsOf(rows);
  return (
    <div className="text-view analysis">
      {form && (
        <div className="metadata-tools">
          {error && <p className="field-problem">{error}</p>}
          <DropdownMenu
            icon={<PlusIcon />}
            label="Add a field"
            className="metadata-add"
            groups={SECTIONS.map((s) => FIELD_KINDS.filter((k) => k.section === s).map((k) => ({ label: k.label, onSelect: () => add(k) })))}
            headings={SECTIONS}
          />
        </div>
      )}
      {sections.length === 0 && <p className="muted">{form ? "No metadata yet: add fields with +." : "No metadata was found on the pages."}</p>}
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
  confirmed,
  onOpen,
  actions,
}: {
  row: MetadataRow;
  confirmed: boolean; // every field shown as confirmed
  onOpen?: () => void; // none in the strip, where the pages are open already
  actions: { edit: () => void; remove: () => void } | null;
}) {
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
      <Confidence value={confirmed ? "confirmed" : row.confidence} />
      {actions && (
        <DropdownMenu
          icon={<MoreIcon />}
          label={`${label}: actions`}
          className="field-actions"
          groups={[[{ label: "Edit", onSelect: actions.edit }], [{ label: "Remove", onSelect: actions.remove, danger: true }]]}
        />
      )}
    </li>
  );
}

// A field in edit mode, in two rows (DESIGN.md §6): its kind, its page (a piece: its system, which sets the page) and
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
  editing: Editing;
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
    <DropdownMenu
      className={`mode-picker field-picker ${className}`}
      buttonClassName="mode-button"
      icon={
        <>
          {value}
          <ChevronDownIcon />
        </>
      }
      label={label}
      groups={groups}
      headings={headings}
    />
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

function Confidence({ value }: { value: ShownConfidence }) {
  const { symbol, label } = CONFIDENCE_SYMBOLS[value];
  return (
    <span className={value === "confirmed" ? "confidence confirmed" : "confidence"} title={label} aria-label={label}>
      {symbol}
    </span>
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
