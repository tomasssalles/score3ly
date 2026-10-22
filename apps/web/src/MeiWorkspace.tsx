// The MEI view (DESIGN.md §6, `engrave`, "The MEI view"): the file and, beside it or below it, the score engraved
// from it, a click on either showing the same element in both; search behind a magnifying glass, going to a measure of
// a piece, back to the top, and hiding the score. `engrave`'s MEI artifact shows it read-only; `fix_mei` edits
// the file in it, with its own tools in the toolbar.

import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { EditorView } from "@codemirror/view";
import { useRemembered } from "./ExtractionView";
import { Picker } from "./fieldList";
import { ChevronDownIcon, ChevronUpIcon, MusicIcon, SearchIcon, TopIcon } from "./icons";
import { elementsAt, findMeasure, indexMei, lineOfId, search, type MeiIndex } from "./meiView";

// CodeMirror comes with the view, not with the app.
const MeiCode = lazy(() => import("./MeiCode").then((m) => ({ default: m.MeiCode })));

// The line chosen, and where: the other side follows. A line clicked in the file is in view there, an element clicked
// in the score is in view there; what is gone to (a match, a measure, the top) is brought into view on both.
export type Selection = { line: number; from: "file" | "score" | "nav" };

export function MeiWorkspace({
  text,
  editable = false,
  onText,
  onView,
  pages,
  pagesError,
  tools,
  notice,
  selection: selected,
  onSelect,
}: {
  text: string; // the file as it is now (for searching and going to places); the editor starts with it
  editable?: boolean;
  onText?: (text: string) => void; // edited, a moment after typing stops
  onView?: (view: EditorView | null) => void;
  pages: string[] | null; // the engraved score's pages (SVG), null while they are made
  pagesError: string | null;
  tools?: ReactNode; // more of the toolbar, before its end
  notice?: ReactNode; // under the toolbar
  selection?: Selection | null; // chosen from outside (e.g. a problem's line)
  onSelect?: (selection: Selection) => void;
}) {
  const lines = useMemo(() => text.split("\n"), [text]);
  const index = useMemo(() => indexMei(lines), [lines]);
  const [own, setOwn] = useState<Selection | null>(null);
  const selection = selected === undefined ? own : selected;
  const [score, setScore] = useRemembered<"shown" | "hidden">("score3ly.mei.score", "shown", ["shown", "hidden"]);
  const [problem, setProblem] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const matches = useMemo(() => search(lines, query.trim()), [lines, query]);
  const [current, setCurrent] = useState(0);
  const [shown, setShown] = useState(false); // whether the current match has been gone to
  useEffect(() => {
    setCurrent(0);
    setShown(false);
  }, [query]);

  const select = (line: number, from: Selection["from"]) => {
    setOwn({ line, from });
    onSelect?.({ line, from });
    setProblem(null);
  };
  // To the next or previous match; the first time, to the first.
  function step(by: number) {
    if (matches.length === 0) return;
    const next = shown ? (current + by + matches.length) % matches.length : current;
    setCurrent(next);
    setShown(true);
    select(matches[next].line, "nav");
  }
  const closeSearch = () => {
    setSearching(false);
    setQuery("");
  };

  return (
    <div className="mei-view">
      <div className="editor-toolbar">
        <div className="editor-tools mei-search">
          <div className="editor-tools editor-modes">
            <button
              type="button"
              className="editor-mode"
              aria-pressed={searching}
              aria-label={searching ? "Close the search" : "Search the MEI file"}
              title={searching ? "Close the search" : "Search the MEI file"}
              onClick={() => (searching ? closeSearch() : setSearching(true))}
            >
              <SearchIcon />
            </button>
          </div>
          {searching && (
            <>
              <input
                type="search"
                className="mei-query"
                placeholder="Search"
                aria-label="Search the MEI file"
                spellCheck={false}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    step(e.shiftKey ? -1 : 1);
                  } else if (e.key === "Escape") {
                    closeSearch();
                  }
                }}
              />
              <span className="mei-count">{query.trim() ? (matches.length ? `${current + 1} / ${matches.length}` : "0") : ""}</span>
              <button type="button" className="icon-button" aria-label="Previous match" disabled={matches.length === 0} onClick={() => step(-1)}>
                <ChevronUpIcon />
              </button>
              <button type="button" className="icon-button" aria-label="Next match" disabled={matches.length === 0} onClick={() => step(1)}>
                <ChevronDownIcon />
              </button>
            </>
          )}
        </div>
        <GoTo index={index} goTo={(line) => select(line, "nav")} onProblem={setProblem} />
        {tools}
        <div className="editor-tools mei-end">
          <button type="button" className="icon-button" aria-label="Back to the top" title="Back to the top" onClick={() => select(0, "nav")}>
            <TopIcon />
          </button>
          <div className="editor-tools editor-modes">
            <button
              type="button"
              className="editor-mode"
              aria-pressed={score === "shown"}
              aria-label={score === "shown" ? "Hide the score" : "Show the score"}
              title={score === "shown" ? "Hide the score" : "Show the score"}
              onClick={() => setScore(score === "shown" ? "hidden" : "shown")}
            >
              <MusicIcon />
            </button>
          </div>
        </div>
      </div>
      {problem && <p className="editor-hint mei-problem">{problem}</p>}
      {notice}
      <div className={score === "shown" ? "mei-split" : "mei-split alone"}>
        <Suspense fallback={<div className="mei-code" />}>
          <MeiCode
            initial={text}
            editable={editable}
            matches={matches}
            current={current}
            selected={selection}
            onSelectLine={(line) => select(line, "file")}
            onChange={onText}
            onView={onView}
          />
        </Suspense>
        {score === "shown" && <MeiScore index={index} pages={pages} error={pagesError} selection={selection} onSelect={(line) => select(line, "score")} />}
      </div>
    </div>
  );
}

// The score engraved from the file. A click on an element goes to its line: the innermost element of the file it is
// part of (a stem is its note's, a staff line its measure's). The chosen line's element, the innermost one the score
// shows, is marked and brought to the middle of the view.
function MeiScore({
  index,
  pages,
  error,
  selection,
  onSelect,
}: {
  index: MeiIndex;
  pages: string[] | null;
  error: string | null;
  selection: Selection | null;
  onSelect: (line: number) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el || !pages) return;
    for (const marked of el.querySelectorAll(".mei-selected")) marked.classList.remove("mei-selected");
    if (!selection) return;
    const shown = shownElements(el, elementsAt(index, selection.line));
    for (const e of shown) e.classList.add("mei-selected");
    if (shown.length === 0 || selection.from === "score") return;
    const box = el.getBoundingClientRect();
    const rects = shown.map((e) => e.getBoundingClientRect());
    const middle = (Math.min(...rects.map((r) => r.top)) + Math.max(...rects.map((r) => r.bottom))) / 2;
    const centre = (Math.min(...rects.map((r) => r.left)) + Math.max(...rects.map((r) => r.right))) / 2;
    el.scrollTop += middle - (box.top + el.clientHeight / 2);
    el.scrollLeft += centre - (box.left + el.clientWidth / 2);
  }, [pages, selection, index]);

  // The smallest element of the file whose box holds the point (a hollow notehead or a thin stem lets the click
  // through to the staff line under it), a few pixels' slack around it.
  function clicked(event: React.MouseEvent) {
    const page = (event.target as Element).closest(".engraved-page");
    if (!page) return;
    const { clientX: x, clientY: y } = event;
    let best: { line: number; area: number } | null = null;
    for (const g of page.querySelectorAll("g[id]")) {
      if (g.classList.contains("system") || g.classList.contains("pageMilestone")) continue;
      const line = lineOfId(index, g.id);
      if (line === null) continue;
      const r = g.getBoundingClientRect();
      if (x < r.left - 2 || x > r.right + 2 || y < r.top - 2 || y > r.bottom + 2) continue;
      const area = (r.width + 4) * (r.height + 4);
      if (!best || area < best.area) best = { line, area };
    }
    if (best) onSelect(best.line);
  }

  return (
    <div className="mei-score" ref={scroller}>
      {error ? (
        <p className="mei-score-note">{error}</p>
      ) : !pages ? (
        <p className="mei-score-note">Engraving the score…</p>
      ) : (
        <div className="mei-pages" onClick={clicked}>
          {pages.map((svg, i) => (
            <figure key={i} className="film-item">
              <figcaption>Page {i + 1}</figcaption>
              <div className="engraved-page" dangerouslySetInnerHTML={{ __html: svg }} />
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

// The element of the score that shows a line: the innermost element it is part of that the score has. Milestones (a
// piece's start and end) are never drawn.
function shownElements(root: HTMLElement, elements: { id: string | null }[]): Element[] {
  for (const { id } of elements) {
    const found = id ? root.querySelector(`g[id="${CSS.escape(id)}"]`) : null;
    if (found && !found.classList.contains("pageMilestone")) return [found];
  }
  return [];
}

// Going to a measure of a piece: the piece by its name (when there are several), the measure by its number.
function GoTo({ index, goTo, onProblem }: { index: MeiIndex; goTo: (line: number) => void; onProblem: (p: string | null) => void }) {
  const [piece, setPiece] = useState(index.pieces[0]?.n ?? 1);
  const [number, setNumber] = useState("");
  const pieceName = (p: MeiIndex["pieces"][number]) => p.label ?? "Untitled";
  function go() {
    const n = Number(number);
    if (!Number.isInteger(n)) return onProblem("Enter a number.");
    const line = findMeasure(index, piece, n);
    if (line === null) return onProblem(`There is no measure ${n}${index.pieces.length > 1 ? " in this piece" : ""}.`);
    goTo(line);
  }
  return (
    <form
      className="editor-tools mei-goto"
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
    >
      {index.pieces.length > 1 && (
        <Picker
          value={pieceName(index.pieces.find((p) => p.n === piece) ?? index.pieces[0])}
          label="The piece"
          className="mei-piece"
          groups={[
            index.pieces.map((p) => ({
              label: pieceName(p),
              current: p.n === piece,
              onSelect: () => {
                setPiece(p.n);
                goTo(p.line);
              },
            })),
          ]}
        />
      )}
      <label className="mei-measure">
        measure:
        <input
          className="mei-number-input"
          inputMode="numeric"
          aria-label="Measure number"
          value={number}
          onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))}
        />
      </label>
      <div className="editor-tools editor-modes">
        <button type="submit" className="editor-mode mei-go" disabled={number === ""}>
          Go
        </button>
      </div>
    </form>
  );
}
