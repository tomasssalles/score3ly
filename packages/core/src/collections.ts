// Small helpers for collections, for the apps alike.

// The items grouped by a key, in the order the items come (the keys in the order first met), each mapped by `valueOf`
// (the item itself if not given). Linear: each group grows in place.
export function groupBy<T, K, V = T>(items: Iterable<T>, keyOf: (item: T) => K, valueOf: (item: T) => V = (item) => item as unknown as V): Map<K, V[]> {
  const groups = new Map<K, V[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(valueOf(item));
    else groups.set(key, [valueOf(item)]);
  }
  return groups;
}
