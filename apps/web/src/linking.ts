// Linking the observations (DESIGN.md §6, `analyze`, "Code links when the links are needed"): one piece of code for
// items with a kind and a place. Spanning items open at a page's edge (ottavas, endings) are joined to their other part
// on the next page, matched by kind and staff or numbers, so a request can say plainly what is in effect on a system
// instead of leaving the model to find it in the whole document. What can't be linked unambiguously stays as it is:
// a hint less, said nothing about. A linked item is as certain as its weakest part.

import type { Confidence, Place } from "@score3ly/prompts";
import { placeLabel, type Stored, type StoredObservations, type StoredPage } from "./analyze.ts";

// An item's state as the requests give it (§6, `extract`): its confidence, or "confirmed" when a person checked it or
// wrote it.
export type ItemState = Confidence | "confirmed";

export function stateOf(item: { confidence: Confidence | null; confirmed?: boolean }): ItemState {
  return item.confirmed || item.confidence === null ? "confirmed" : item.confidence;
}

const RANK: Record<ItemState, number> = { low: 0, medium: 1, high: 2, confirmed: 3 };
const weakest = (states: ItemState[]): ItemState => states.reduce((a, b) => (RANK[a] <= RANK[b] ? a : b));

type Spanning = { kind: "ottava" | "ending"; text: string; staff: string | null; start: Place | null; end: Place | null; page: number; state: ItemState };

// A spanning item, with all its parts joined: where it starts and ends in the score (null: before or after the pages
// seen), and the systems it is in effect on.
export type Span = {
  kind: "ottava" | "ending";
  text: string; // the ottava's sign, the ending's numbers
  staff: string | null; // an ottava's staff, as "staff k/n"
  start: Place | null;
  end: Place | null;
  from: number; // the first system it covers (in part)
  to: number; // the last
  state: ItemState;
};

function spanningItems(page: StoredPage): Spanning[] {
  return [
    ...page.ottavas.map((o) => ({ kind: "ottava" as const, text: o.text, staff: `staff ${o.staff.number}/${o.staff.of}`, start: o.start, end: o.end, page: page.page, state: stateOf(o) })),
    ...page.endings.map((e) => ({ kind: "ending" as const, text: e.numbers, staff: null, start: e.start, end: e.end, page: page.page, state: stateOf(e) })),
  ];
}

// The spans of the score, linked across pages. `systemsOf` gives a page's systems (their numbers in the score).
export function linkSpans(observations: StoredObservations, systemsOf: (page: number) => number[]): Span[] {
  const pages = [...observations.pages].sort((a, b) => a.page - b.page);
  const items = pages.map(spanningItems);
  const used = new Set<Spanning>();
  const spans: Span[] = [];
  for (const [p, list] of items.entries()) {
    for (const item of list) {
      if (used.has(item)) continue;
      used.add(item);
      const parts = [item];
      // Follow an open end onto the next page: one item there open at its start, of the same kind and staff or
      // numbers. Not when there are several: ambiguous.
      let q = p;
      while (parts[parts.length - 1].end === null && q + 1 < items.length) {
        const last = parts[parts.length - 1];
        const candidates = items[q + 1].filter((c) => !used.has(c) && c.start === null && c.kind === last.kind && c.staff === last.staff && c.text === last.text);
        if (candidates.length !== 1) break;
        used.add(candidates[0]);
        parts.push(candidates[0]);
        q++;
      }
      const first = parts[0];
      const last = parts[parts.length - 1];
      const firstSystems = systemsOf(first.page);
      const lastSystems = systemsOf(last.page);
      spans.push({
        kind: item.kind,
        text: item.text,
        staff: item.staff,
        start: first.start,
        end: last.end,
        from: first.start?.system ?? firstSystems[0] ?? 0,
        to: last.end?.system ?? lastSystems[lastSystems.length - 1] ?? 0,
        state: weakest(parts.map((x) => x.state)),
      });
    }
  }
  return spans;
}

// A place as a request about `system` names it: in the lens's terms on the system itself (its stretches and the bar
// lines at their right), by its label elsewhere.
export function placeFor(system: number, p: Place | null, open: "before" | "after"): string {
  if (!p) return open === "before" ? "before the pages seen" : "after the pages seen";
  if (p.system !== system) return placeLabel(p);
  switch (p.at) {
    case "start":
      return "the start of this system";
    case "end":
      return "the end of this system";
    case "barLine":
      return `the bar line at the right of stretch ${p.number}`;
    case "stretch":
      return `stretch ${p.number}`;
  }
}

// What the observations say about one system, for its request: its staves, the items placed on it, the spans in
// effect on it (or starting or ending there), and the notes of its page.
export type SystemHints = {
  staves: { count: number; instruments: string[]; state: ItemState } | null;
  onThisSystem: { what: string; text: string; place: string; staff: string | null; state: ItemState }[];
  spans: { what: string; text: string; staff: string | null; from: string; to: string; state: ItemState }[];
  pageNotes: { text: string; state: ItemState }[];
};

export function systemHints(observations: StoredObservations, spans: Span[], system: number, page: number): SystemHints {
  const p = observations.pages.find((x) => x.page === page);
  const staves = p?.systems.find((s) => s.system === system);
  const here = <T extends { place: Place }>(list: Stored<T>[] | undefined) => (list ?? []).filter((i) => i.place.system === system);
  const staffName = (s: { number: number; of: number } | null) => (s ? `staff ${s.number}/${s.of}` : null);
  return {
    staves: staves ? { count: staves.staves, instruments: staves.instruments, state: stateOf(staves) } : null,
    onThisSystem: [
      ...here(p?.changes).map((c) => ({ what: `${c.kind} change`, text: c.text, place: placeFor(system, c.place, "before"), staff: staffName(c.staff), state: stateOf(c) })),
      ...here(p?.specialBarLines).map((b) => ({ what: "special bar line", text: b.kind, place: placeFor(system, b.place, "before"), staff: null, state: stateOf(b) })),
      ...here(p?.directions).map((d) => ({ what: "direction", text: d.text, place: placeFor(system, d.place, "before"), staff: null, state: stateOf(d) })),
    ],
    spans: spans
      .filter((s) => s.from <= system && system <= s.to)
      .map((s) => ({ what: s.kind, text: s.text, staff: s.staff, from: placeFor(system, s.start, "before"), to: placeFor(system, s.end, "after"), state: s.state })),
    pageNotes: (p?.notes ?? []).map((n) => ({ text: n.text, state: stateOf(n) })),
  };
}
