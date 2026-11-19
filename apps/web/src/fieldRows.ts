// The forms' rules for ending an edit (fieldList.tsx, docs/stages/analyze.md): what doesn't need React.

// The field being edited: its row's index, what has been typed, whether it was just added, and why it can't be saved.
export type Editing<R> = { index: number; draft: R; added: boolean; problem: string | null };

export type FieldRules<R> = {
  empty: (row: R) => boolean; // a field with nothing in it, dropped when it leaves edit mode
  problem: (draft: R, others: R[]) => string | null; // why a field can't be saved as it is
  same: (a: R, b: R) => boolean; // the same but for confidence and confirmation
};

// The rows once the field being edited is ended: without it if it was emptied, with it saved and confirmed (keeping
// the model's confidence) if it changed, the same rows (`rows` itself) if it didn't; or why it can't be saved yet.
export function committed<R extends { confirmed: boolean }>(rows: R[], edit: Editing<R>, rules: FieldRules<R>): { rows: R[] } | { problem: string } {
  const { index, draft, added } = edit;
  if (rules.empty(draft)) return { rows: rows.filter((_, i) => i !== index) };
  const problem = rules.problem(draft, rows.filter((_, i) => i !== index));
  if (problem) return { problem };
  if (!added && rules.same(draft, rows[index])) return { rows };
  return { rows: rows.map((row, i) => (i === index ? { ...draft, confirmed: true } : row)) };
}

// A row's index once the row at `removed` is gone: one less after it, none for the row itself.
export function afterRemoval(index: number, removed: number): number | null {
  return index === removed ? null : index > removed ? index - 1 : index;
}
