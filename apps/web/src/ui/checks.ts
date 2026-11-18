// The selection of a check list (ui/CheckList.tsx), kept as what is taken out: the items not selected.

// `out` after the items `keys` were selected (`on`) or taken out; a new set, `out` unchanged.
export function toggled(out: Iterable<string>, keys: string[], on: boolean): Set<string> {
  const next = new Set(out);
  for (const key of keys) {
    if (on) next.delete(key);
    else next.add(key);
  }
  return next;
}
