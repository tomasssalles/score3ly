// What the forms of `fix_metadata` and `fix_observations` share (DESIGN.md §6): a list of fields (rows) read from a
// stored document, edited one at a time, each with a "⋮" (Edit, Confirm or Unconfirm, Remove) and an eye that opens
// the pages with only that field in a strip above them. A field is saved when it leaves edit mode, when it is
// confirmed, unconfirmed or removed, and when the form closes; saving an edit confirms the field, adding one too. An
// edit left as it was confirms nothing. The rows and their meaning are each form's own.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CONFIDENCE_SYMBOLS, type ShownConfidence } from "./analyze";
import { DropdownMenu, type MenuItem } from "./DropdownMenu";
import { ChevronDownIcon, CloseIcon } from "./icons";

// What forms saved on this device and isn't yet in the pipeline the app has, by stage.
const saved = new Map<string, unknown[]>();

// The field being edited: its row's index, what has been typed, whether it was just added, and why it can't be saved.
export type Editing<R> = { index: number; draft: R; added: boolean; problem: string | null };

export type FieldRules<R> = {
  empty: (row: R) => boolean; // a field with nothing in it, dropped when it leaves edit mode
  problem: (draft: R, others: R[]) => string | null; // why a field can't be saved as it is
  same: (a: R, b: R) => boolean; // the same but for confidence and confirmation
};

export function useFieldList<R extends { confirmed: boolean }>(
  source: { sha256: string; load: () => Promise<R[]> },
  form: { stageId: string; save: (rows: R[]) => Promise<void> } | null,
  rules: FieldRules<R>,
) {
  const [rows, setRows] = useState<R[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing<R> | null>(null);
  const [focus, setFocus] = useState<number | null>(null); // the row whose pages are open
  const chain = useRef(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    const own = form && (saved.get(form.stageId) as R[] | undefined);
    (own ? Promise.resolve(own) : source.load()).then(
      (loaded) => !cancelled && setRows(loaded),
      () => !cancelled && setError("This couldn't be loaded."),
    );
    return () => {
      cancelled = true;
    };
  }, [source.sha256]);

  function save(next: R[]) {
    if (!form) return;
    saved.set(form.stageId, next);
    chain.current = chain.current
      .then(async () => {
        await form.save(next);
        setError(null);
      })
      .catch((err) => setError(`Saving failed: ${err instanceof Error ? err.message : err}`));
  }

  // The field being edited, ended: saved if it changed (and confirmed, keeping the model's confidence), removed if it
  // was emptied. Returns the rows after it, or null if it can't be saved yet.
  function commit(current: R[], edit: Editing<R>): R[] | null {
    const { index, draft, added } = edit;
    if (rules.empty(draft)) return current.filter((_, i) => i !== index);
    const problem = rules.problem(draft, current.filter((_, i) => i !== index));
    if (problem) {
      setEditing({ ...edit, problem });
      return null;
    }
    if (!added && rules.same(draft, current[index])) return current;
    return current.map((row, i) => (i === index ? { ...draft, confirmed: true } : row));
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
    if (focus !== null) {
      const f = after(focus, ended.removed);
      setFocus(f === i ? null : f > i ? f - 1 : f);
    }
    save(next);
  }

  function add(made: (rows: R[]) => R) {
    const ended = finishEditing();
    if (!ended) return;
    const row = made(ended.rows);
    setRows([...ended.rows, row]);
    setEditing({ index: ended.rows.length, draft: row, added: true, problem: null });
  }

  // Closing the form saves the field being edited, if it can be saved.
  const latest = useRef({ rows, editing, rules });
  latest.current = { rows, editing, rules };
  useEffect(
    () => () => {
      const { rows, editing, rules } = latest.current;
      if (!rows || !editing || rules.empty(editing.draft)) return;
      const others = rows.filter((_, i) => i !== editing.index);
      if (rules.problem(editing.draft, others)) return;
      if (!editing.added && rules.same(editing.draft, rows[editing.index])) return;
      save(rows.map((row, i) => (i === editing.index ? { ...editing.draft, confirmed: true } : row)));
    },
    [],
  );

  return {
    rows,
    error,
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

// A picker in the style of the run mode's (the app's own menu, which can dim choices).
export function Picker({
  value,
  label,
  groups,
  headings,
  className = "",
}: {
  value: string;
  label: string;
  groups: MenuItem[][];
  headings?: string[];
  className?: string;
}) {
  return (
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
