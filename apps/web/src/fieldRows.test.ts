import { test } from "node:test";
import assert from "node:assert/strict";
import { afterRemoval, committed, type FieldRules } from "./fieldRows.ts";

type Row = { text: string; confirmed: boolean };
const rules: FieldRules<Row> = {
  empty: (r) => !r.text.trim(),
  problem: (r, others) => (others.some((o) => o.text === r.text) ? "Twice." : null),
  same: (a, b) => a.text === b.text,
};
const rows: Row[] = [
  { text: "a", confirmed: false },
  { text: "b", confirmed: false },
];
const edit = (index: number, text: string, added = false) => ({ index, draft: { text, confirmed: false }, added, problem: null });

test("an edit ends emptied, refused, unchanged, or saved and confirmed", () => {
  assert.deepEqual(committed(rows, edit(0, " "), rules), { rows: [rows[1]] });
  assert.deepEqual(committed(rows, edit(0, "b"), rules), { problem: "Twice." });
  const same = committed(rows, edit(1, "b"), rules);
  assert.ok("rows" in same && same.rows === rows); // nothing to save
  assert.deepEqual(committed(rows, edit(1, "c"), rules), { rows: [rows[0], { text: "c", confirmed: true }] });
  // An added field is saved, and confirmed, even as it was made.
  const added = [...rows, { text: "c", confirmed: true }];
  assert.deepEqual(committed(added, edit(2, "c", true), rules), { rows: [...rows, { text: "c", confirmed: true }] });
});

test("an index after a removal", () => {
  assert.equal(afterRemoval(1, 3), 1);
  assert.equal(afterRemoval(3, 3), null);
  assert.equal(afterRemoval(4, 3), 3);
});
