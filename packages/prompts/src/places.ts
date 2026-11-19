// Places in a system, as analyze's models name them by the labels drawn on the pages (docs/stages/analyze.md):
// "system 17, start", "system 17, bar line 4", "system 17, stretch 2", "system 17, end".

// A place in a system (docs/stages/analyze.md): its start or its end (the box's edges), one of its inner bar lines
// (1 to n, as drawn), or a stretch between two of these (1 to n + 1). `number` is the bar line's or the stretch's, 0
// at the start and the end.
export const PLACE_KINDS = ["start", "barLine", "stretch", "end"] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];
export type Place = { system: number; at: PlaceKind; number: number };
// Where a bar line's kind can be: not inside a stretch.
export const BAR_LINE_PLACES: PlaceKind[] = ["start", "barLine", "end"];

// Where a place is in the score, for sorting: by system, then start, stretch 1, bar line 1, stretch 2, …, end.
export function placeOrder(p: Place): number {
  const within = p.at === "start" ? 1 : p.at === "stretch" ? 2 * p.number : p.at === "barLine" ? 2 * p.number + 1 : 1e6;
  return p.system * 1e7 + within;
}

// Where an item starts, for sorting a list: an item open at its start before everything on its end's system, one open
// at both ends before everything.
export function firstPlace(item: object): number {
  const i = item as { system?: number; place?: Place; start?: Place | null; end?: Place | null };
  if (i.system !== undefined) return i.system * 1e7;
  if (i.place) return placeOrder(i.place);
  if (i.start) return placeOrder(i.start);
  return i.end ? i.end.system * 1e7 : 0;
}

// A span (an ottava, an ending) that ends before it starts: refused by `analyze`'s checks and by the form alike. One
// open at either end, or starting and ending at one place, doesn't.
export function endsBeforeStart(start: Place | null, end: Place | null): boolean {
  return start !== null && end !== null && placeOrder(end) < placeOrder(start);
}

export const samePlace = (a: Place | null, b: Place | null) =>
  a === b || (a !== null && b !== null && a.system === b.system && a.at === b.at && a.number === b.number);

// A place within its system, as the forms' pickers name it: "start", "bar line 4", "stretch 3", "end".
export function positionLabel(p: Place): string {
  return p.at === "start" || p.at === "end" ? p.at : `${p.at === "barLine" ? "bar line" : "stretch"} ${p.number}`;
}

// A place by name, as the views and the reasons an answer can't be used say it: "system 17, start", "system 17, bar
// line 4", "system 17, stretch 3", "system 17, end".
export function placeLabel(p: Place): string {
  return `system ${p.system}, ${positionLabel(p)}`;
}
