// What the forms of `fix_metadata` and `fix_observations` share (docs/stages/analyze.md): a list of fields (rows) read from a
// stored document, edited one at a time, each with a "⋮" (Edit, Confirm or Unconfirm, Remove) and an eye that opens
// the pages with only that field in a strip above them. A field is saved when it leaves edit mode, when it is
// confirmed, unconfirmed or removed, and when the form closes; saving an edit confirms the field, adding one too. An
// edit left as it was confirms nothing. The rows and their meaning are each form's own.

import { useEffect, useRef, useState, type ComponentProps, type KeyboardEvent, type ReactNode } from "react";
import { CONFIDENCE_SYMBOLS, type ShownConfidence } from "./analyze";
import { fetchJsonContent } from "./api";
import { UnsavedNote } from "./editor/pageEditor";
import { afterRemoval, committed, type Editing, type FieldRules } from "./fieldRows";
import { numberSystems, type PageLayout } from "./layout";
import { DropdownMenu, type MenuItem } from "./ui/DropdownMenu";
import { CheckIcon, CloseIcon, EyeIcon, MoreIcon, PlusIcon } from "./ui/icons";
import { Picker } from "./ui/Picker";
import { loadKey, useSaver } from "./saving";

export type { Editing, FieldRules } from "./fieldRows";

export function useFieldList<R extends { confirmed: boolean }>(
  source: { sha256: string; load: () => Promise<R[]> },
  form: { stageId: string; save: (rows: R[]) => Promise<void> } | null,
  rules: FieldRules<R>,
) {
  const [rows, setRows] = useState<R[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing<R> | null>(null);
  const [focus, setFocus] = useState<number | null>(null); // the row whose pages are open
  // One saver for the stage (saving.ts): what the form saved is shown when it opens again.
  const saver = useSaver(form?.stageId ?? "");

  // Loaded once for a form being edited, its own saves never read back (the document changes with each); a view's
  // when its document changes. A row being typed is never replaced (docs/style.md).
  const editingNow = useRef(editing);
  editingNow.current = editing;
  useEffect(() => {
    let cancelled = false;
    const own = form ? saver.value<R[]>("") : undefined;
    (own ? Promise.resolve(own) : source.load()).then(
      (loaded) => !cancelled && !(form && editingNow.current) && setRows(loaded),
      () => !cancelled && setError("This couldn't be loaded."),
    );
    return () => {
      cancelled = true;
    };
  }, [loadKey(source, form)]);

  function save(next: R[]) {
    if (!form) return;
    saver.save("", next, () => form.save(next));
  }

  // The field being edited, ended (committed): saved if it changed (and confirmed, keeping the model's confidence),
  // removed if it was emptied. Returns the rows after it, or null if it can't be saved yet, with the reason shown.
  function commit(current: R[], edit: Editing<R>): R[] | null {
    const result = committed(current, edit, rules);
    if ("problem" in result) {
      setEditing({ ...edit, problem: result.problem });
      return null;
    }
    return result.rows;
  }

  // Ends the edit. Returns the rows after it and the index of the row it removed (an emptied field), or null if the
  // field can't be saved yet: it stays in edit mode, with the reason.
  function finishEditing(): { rows: R[]; removed: number | null } | null {
    if (!rows) return null;
    if (!editing) return { rows, removed: null };
    const next = commit(rows, editing);
    if (!next) return null;
    setEditing(null);
    const removed = next.length < rows.length ? editing.index : null;
    if (next !== rows) {
      setRows(next);
      if (focus !== null && removed !== null) setFocus(afterRemoval(focus, removed));
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

  // A change to the rows that keeps every row where it is (confirming, a staff added): saved at once. `change`
  // returns the new rows, or why it can't be made, which is shown.
  function act(index: number, change: (rows: R[], index: number) => R[] | string) {
    const ended = finishEditing();
    if (!ended) return;
    const next = change(ended.rows, after(index, ended.removed));
    if (typeof next === "string") {
      setError(next);
      return;
    }
    setError(null);
    setRows(next);
    save(next);
  }

  function remove(index: number, problem?: (rows: R[], index: number) => string | null) {
    const ended = finishEditing();
    if (!ended) return;
    const i = after(index, ended.removed);
    const why = problem?.(ended.rows, i);
    if (why) {
      setError(why);
      return;
    }
    const next = ended.rows.filter((_, j) => j !== i);
    setRows(next);
    if (focus !== null) setFocus(afterRemoval(after(focus, ended.removed), i));
    save(next);
  }

  function add(made: (rows: R[]) => R) {
    const ended = finishEditing();
    if (!ended) return;
    const row = made(ended.rows);
    setRows([...ended.rows, row]);
    setEditing({ index: ended.rows.length, draft: row, added: true, problem: null });
  }

  // Closing the form saves the field being edited, if it can be saved (an emptied field isn't removed then).
  const latest = useRef({ rows, editing, rules });
  latest.current = { rows, editing, rules };
  useEffect(
    () => () => {
      const { rows, editing, rules } = latest.current;
      if (!rows || !editing || rules.empty(editing.draft)) return;
      const result = committed(rows, editing, rules);
      if ("rows" in result && result.rows !== rows) save(result.rows);
    },
    [],
  );

  return {
    rows,
    error,
    saving: { state: saver.state, retry: saver.retry },
    editing,
    setDraft: (draft: R) => editing && setEditing({ ...editing, draft, problem: null }),
    focus,
    setFocus,
    finishEditing: () => finishEditing() !== null,
    cancelEditing,
    edit,
    remove,
    add,
    act,
    confirm: (index: number, confirmed: boolean) =>
      act(index, (rows, i) => rows.map((row, j) => (j === i ? { ...row, confirmed } : row))),
  };
}

export type FieldList<R extends { confirmed: boolean }> = ReturnType<typeof useFieldList<R>>;

// The systems of the score, numbered across the pages (numberSystems), each with its page and number of inner bar
// lines, from the pages' layouts: what a form's pickers offer. Loaded for a form only (`active`).
export function useLayoutSystems(pages: { page: number; layoutSha256: string }[], active: boolean, key: string) {
  const [systems, setSystems] = useState<{ page: number; barLines: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    Promise.all(pages.map((p) => fetchJsonContent(p.layoutSha256) as Promise<PageLayout>)).then(
      (layouts) =>
        !cancelled &&
        setSystems(numberSystems(layouts.map((l, i) => ({ page: pages[i].page, systems: l.systems }))).map((s) => ({ page: s.page, barLines: s.layout.barLines.length }))),
      () => !cancelled && setError("The layout couldn't be loaded."),
    );
    return () => {
      cancelled = true;
    };
  }, [key]);
  return { systems, error };
}

// A form's list (and a read-only view's): the fields by section, the "+" and what went wrong above them in a form;
// one field with the pages under it when its eye was clicked (`strip`).
export function FieldListView<R extends { confirmed: boolean }>({
  list,
  error,
  editor,
  add,
  sections,
  field,
  strip,
  empty,
}: {
  list: FieldList<R>;
  error: string | null;
  editor: boolean;
  add: { label: string; groups: MenuItem[][]; headings: string[] };
  sections: (rows: R[]) => { title: string; indices: number[] }[];
  field: (index: number) => ReactNode;
  strip: (index: number) => ReactNode; // the pages, under the field `index`
  empty: { form: string; view: string };
}) {
  const { rows, editing, focus } = list;
  if (!rows) return <div className="text-view"><p>{error ?? "Loading…"}</p></div>;
  if (focus !== null && rows[focus]) {
    return (
      <FieldStrip field={field(focus)} editing={editing?.index === focus} onClose={() => list.setFocus(null)}>
        {strip(focus)}
      </FieldStrip>
    );
  }
  const shown = sections(rows);
  return (
    <div className="text-view analysis">
      {editor && (
        <div className="metadata-tools">
          {error && <p className="field-problem error-text">{error}</p>}
          <UnsavedNote className="field-problem error-text" state={list.saving.state} onRetry={list.saving.retry} />
          <DropdownMenu icon={<PlusIcon />} label={add.label} className="metadata-add" groups={add.groups} headings={add.headings} />
        </div>
      )}
      {shown.length === 0 && <p className="muted">{editor ? empty.form : empty.view}</p>}
      {shown.map((section) => (
        <section key={section.title}>
          <h3>{section.title}</h3>
          <ul>{section.indices.map(field)}</ul>
        </section>
      ))}
    </div>
  );
}

// A field as read: its label, what it says, its page if the form has pages, the eye (none in the strip, where the
// pages are open already; `keepColumn` keeps its place empty), its confidence and, in a form, its "⋮".
export function FieldRow({
  className,
  label,
  text,
  page,
  onOpen,
  keepColumn = false,
  confidence,
  actions,
}: {
  className: string;
  label: string;
  text: ReactNode;
  page?: ReactNode;
  onOpen?: () => void;
  keepColumn?: boolean;
  confidence: ShownConfidence | null;
  actions: MenuItem[][] | null;
}) {
  return (
    <li className={className}>
      <span className="field-label">{label}</span>
      <span className="field-text">{text}</span>
      {page}
      {onOpen ? (
        <button type="button" className="icon-button field-open" aria-label="Show in the score" title="Show in the score" onClick={onOpen}>
          <EyeIcon />
        </button>
      ) : (
        keepColumn && <span />
      )}
      <Confidence value={confidence} />
      {actions && <DropdownMenu icon={<MoreIcon />} label={`${label}: actions`} className="field-actions" groups={actions} />}
    </li>
  );
}

// A field in edit mode: its head (the form's pickers, then the ✓), its lines, and why it can't be saved. Escape cancels,
// Enter in a text input and leaving it end the edit.
export function EditorRow({ head, problem, onDone, onCancel, children }: { head: ReactNode; problem: string | null; onDone: () => boolean; onCancel: () => void; children: ReactNode }) {
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onCancel();
    } else if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
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
      <div className="field-edit-head">
        {head}
        <span className="field-edit-space" />
        <button type="button" className="field-done" aria-label="Done" title="Done" onClick={onDone}>
          <CheckIcon />
        </button>
      </div>
      {children}
      {problem && <p className="field-problem error-text">{problem}</p>}
    </li>
  );
}

// A field's "⋮": Edit, Confirm or Unconfirm (not on a field the user added: there is no confidence of the model's to
// go back to), the form's own actions, and Remove.
export function fieldActions(
  row: { confirmed: boolean; confidence: unknown },
  actions: { edit: () => void; confirm: () => void; remove: () => void },
  more: MenuItem[] = [],
): MenuItem[][] {
  return [
    [
      { label: "Edit", onSelect: actions.edit },
      row.confirmed
        ? { label: "Unconfirm", onSelect: actions.confirm, disabled: row.confidence === null }
        : { label: "Confirm", onSelect: actions.confirm },
    ],
    ...(more.length > 0 ? [more] : []),
    [{ label: "Remove", onSelect: actions.remove, danger: true }],
  ];
}

// The pages open under one field, in a strip above them. The strip's close button is hidden while the field is
// edited: leaving it saves it, and the strip stays compact.
export function FieldStrip({ field, editing, onClose, children }: { field: ReactNode; editing: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <div className="analysis-focus">
      <div className="analysis-strip">
        <ul className="analysis-strip-text">{field}</ul>
        {!editing && (
          <button type="button" className="icon-button" aria-label="Close the pages" onClick={onClose}>
            <CloseIcon />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// A form's picker (ui/Picker.tsx), with the forms' menu style.
export function FieldPicker({ className = "", ...props }: ComponentProps<typeof Picker>) {
  return <Picker {...props} className={className ? `field-picker ${className}` : "field-picker"} />;
}

export function Confidence({ value }: { value: ShownConfidence | null }) {
  if (!value) return <span className="confidence" />;
  const { symbol, label } = CONFIDENCE_SYMBOLS[value];
  return (
    <span className={value === "confirmed" ? "confidence confirmed" : "confidence"} title={label} aria-label={label}>
      {symbol}
    </span>
  );
}
