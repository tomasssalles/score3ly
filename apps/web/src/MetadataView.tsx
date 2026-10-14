// The metadata (DESIGN.md §6): `analyze`'s and a finished `fix_metadata`'s, read-only, and a WIP `fix_metadata`'s
// form. Both list the fields by section, each with its page as a link and its confidence. Clicking a page opens the
// pages there (a field without a page opens them at the first), with only that field in a thin strip above them.
// In the form, every field has a "⋮" with Edit and Remove, also in the strip, so it can be edited while looking at
// the page, and one "+" adds any kind of field. A field is saved when it leaves edit mode, and when the form closes.

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { CONFIDENCE_SYMBOLS, type ShownConfidence } from "./analyze";
import { fetchJsonContent, recordOutputs, type Project } from "./api";
import { Filmstrip, PageImageView } from "./ArtifactView";
import { DropdownMenu } from "./DropdownMenu";
import { metadataOutputs, type MetadataParents } from "./finishFixMetadata";
import {
  FIELD_KINDS,
  kindOf,
  metadataOf,
  normalizeMetadata,
  pieceProblem,
  ROLE_CHOICES,
  rowEmpty,
  rowsOf,
  sameField,
  SECTIONS,
  sectionsOf,
  TEXT_CHOICES,
  TITLE_CHOICES,
  withKind,
  type FieldKind,
  type MetadataRow,
} from "./fixMetadata";
import { AnalyzeIcon, CloseIcon, MoreIcon, PlusIcon } from "./icons";
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
  const [systemCount, setSystemCount] = useState(0);
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
    // The systems a piece can start at: all of them, numbered across the pages.
    if (form) {
      Promise.all(pages.flatMap((p) => (p.layoutSha256 ? [fetchJsonContent(p.layoutSha256) as Promise<PageLayout>] : []))).then(
        (layouts) => !cancelled && setSystemCount(layouts.reduce((n, l) => n + l.systems.length, 0)),
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
    const problem = pieceProblem(draft, current.filter((_, i) => i !== index), systemCount);
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
    setRows([...ended.rows, kind.make()]);
    setEditing({ index: ended.rows.length, draft: kind.make(), added: true, problem: null });
  }

  // Closing the form saves the field being edited, if it can be saved.
  const latest = useRef({ rows, editing, systemCount });
  latest.current = { rows, editing, systemCount };
  useEffect(
    () => () => {
      const { rows, editing, systemCount } = latest.current;
      if (!rows || !editing || rowEmpty(editing.draft)) return;
      if (pieceProblem(editing.draft, rows.filter((_, i) => i !== editing.index), systemCount)) return;
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
        onOpen={() => setFocus(index)}
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
          <button
            type="button"
            className="icon-button"
            aria-label="Close the pages"
            onClick={() => {
              if (finishEditing()) setFocus(null);
            }}
          >
            <CloseIcon />
          </button>
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
  switch (row.kind) {
    case "piece":
      return { label: row.system === null ? "Piece or movement" : `From system ${row.system}`, text: row.title };
    case "person":
      return { label: kindOf(row).label, text: row.printedRole ? `${row.name} (${row.printedRole})` : row.name };
    default:
      return { label: kindOf(row).label, text: row.text };
  }
}

function Field({
  row,
  confirmed,
  onOpen,
  actions,
}: {
  row: MetadataRow;
  confirmed: boolean; // every field shown as confirmed
  onOpen: () => void;
  actions: { edit: () => void; remove: () => void } | null;
}) {
  const { label, text } = shown(row);
  return (
    <li className="analysis-row">
      <span className="field-label">{label}</span>
      <span className="field-text">{text}</span>
      {row.page === null ? (
        <button type="button" className="page-link icon" aria-label="Look in the score" title="Look in the score" onClick={onOpen}>
          <AnalyzeIcon />
        </button>
      ) : (
        <button type="button" className="page-link" onClick={onOpen}>
          p. {row.page}
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

// A field in edit mode: its kind as a drop-down where it has others to become, its text as inputs, its page.
function FieldEditor({
  editing,
  onChange,
  onDone,
  onCancel,
}: {
  editing: Editing;
  onChange: (draft: MetadataRow) => void;
  onDone: () => boolean;
  onCancel: () => void;
}) {
  const row = editing.draft;
  const first = useRef<HTMLElement | null>(null);
  useEffect(() => first.current?.focus(), []);
  const set = (change: Partial<MetadataRow>) => onChange({ ...row, ...change } as MetadataRow);

  const choices = row.kind === "title" ? TITLE_CHOICES : row.kind === "person" ? ROLE_CHOICES : row.kind === "text" && row.field !== "comments" ? TEXT_CHOICES : null;
  const kind = kindOf(row);
  const input = (value: string, onValue: (v: string) => void, placeholder: string, focusFirst = false) => (
    <input
      ref={focusFirst ? (el) => void (first.current = el) : undefined}
      className="field-input"
      value={value}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(e) => onValue(e.target.value)}
    />
  );

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onCancel();
    } else if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
      onDone();
    }
  }

  return (
    <li
      className="analysis-row editing"
      onKeyDown={onKeyDown}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onDone();
      }}
    >
      {choices ? (
        <select
          className="field-label field-kind"
          aria-label="Kind of field"
          value={kind.label}
          onChange={(e) => onChange(withKind(row, choices.find((k) => k.label === e.target.value)!))}
        >
          {choices.map((k) => (
            <option key={k.label}>{k.label}</option>
          ))}
        </select>
      ) : (
        <span className="field-label">{kind.label}</span>
      )}
      <span className="field-inputs">
        {row.kind === "title" && input(row.text, (text) => set({ text }), "Title as printed", true)}
        {row.kind === "person" && (
          <>
            {input(row.name, (name) => set({ name }), "Name", true)}
            {input(row.printedRole, (printedRole) => set({ printedRole }), "Role as printed (optional)")}
          </>
        )}
        {row.kind === "piece" && (
          <>
            {input(row.title, (title) => set({ title }), "Title or number", true)}
            <input
              className="field-input number"
              inputMode="numeric"
              value={row.system ?? ""}
              placeholder="Starts at system"
              aria-label="Starts at system"
              onChange={(e) => set({ system: e.target.value.trim() === "" ? null : Number(e.target.value) })}
            />
          </>
        )}
        {row.kind === "text" &&
          (row.field === "comments" ? (
            <textarea
              ref={(el) => void (first.current = el)}
              className="field-input"
              rows={3}
              value={row.text}
              placeholder="Comment"
              aria-label="Comment"
              onChange={(e) => set({ text: e.target.value })}
            />
          ) : (
            input(row.text, (text) => set({ text }), "As printed", true)
          ))}
        <input
          className="field-input number"
          inputMode="numeric"
          value={row.page ?? ""}
          placeholder="Page"
          aria-label="Page (empty: none)"
          title="Page (empty: none)"
          onChange={(e) => {
            const page = e.target.value.trim();
            set({ page: page === "" || !/^\d+$/.test(page) ? null : Number(page) });
          }}
        />
        <button type="button" className="field-done" onClick={onDone}>
          Done
        </button>
      </span>
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
