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

// A place in words, for the reasons an answer can't be used.
export const placeName = (p: Place) =>
  p.at === "start" || p.at === "end" ? `the ${p.at} of system ${p.system}` : `system ${p.system}, ${p.at === "barLine" ? "bar line" : "stretch"} ${p.number}`;
