// `engrave`'s artifacts (DESIGN.md §6, `engrave`): the MEI file, indented and highlighted, with search and a way to go
// to a measure of a piece (a file of thousands of lines: only the lines in view are drawn), beside the score engraved
// from it, a click on either showing the same element in both; and the engraving, Verovio's pages, made when they are
// shown.

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchTextContent } from "./api";
import { Filmstrip } from "./ArtifactView";
import { engravedPages } from "./engraving";
import { Picker } from "./fieldList";
import { ChevronDownIcon, ChevronUpIcon, MusicIcon, SearchIcon, TopIcon } from "./icons";
import { useRemembered } from "./ExtractionView";
import { elementsAt, findMeasure, highlight, indexMei, lineOfId, marked, search, type Match, type MeiIndex } from "./meiView";
import type { Artifact } from "./pipeline";

type Engraving = NonNullable<Artifact["engraving"]>;

export function EngravingView({ artifact }: { artifact: Artifact }) {
  const engraving = artifact.engraving!;
  return engraving.view === "mei" ? <MeiView engraving={engraving} /> : <EngravedPages engraving={engraving} />;
}

// --- The engraving ---------------------------------------------------------------------------------------------------

function EngravedPages({ engraving }: { engraving: Engraving }) {
  const [pages, setPages] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    engravedPages(engraving).then(
      (svgs) => !cancelled && setPages(svgs),
      (err) => !cancelled && setError(`The score can't be engraved: ${err instanceof Error ? err.message : err}`),
    );
    return () => {
      cancelled = true;
    };
  }, [engraving.meiSha256, JSON.stringify(engraving.config)]);
  if (error) return <div className="text-view"><p>{error}</p></div>;
  if (!pages) return <div className="text-view"><p>Engraving the score…</p></div>;
  return (
    <Filmstrip
      count={pages.length}
      wide={false}
      render={(i) => (
        <figure className="film-item">
          <figcaption>Page {i + 1}</figcaption>
          <div className="engraved-page" dangerouslySetInnerHTML={{ __html: pages[i] }} />
        </figure>
      )}
    />
  );
}

// --- The MEI file ----------------------------------------------------------------------------------------------------

const LINE_HEIGHT = 20; // px, as in the CSS: lines are placed by it
const OVERSCAN = 30; // lines drawn beyond the view either way

// The line chosen, and where: the other side follows. A line clicked in the file is in view there, an element clicked
// in the score is in view there; what is gone to (a match, a measure, the top) is brought into view on both.
type Selection = { line: number; from: "file" | "score" | "nav" };

function MeiView({ engraving }: { engraving: Engraving }) {
  const [lines, setLines] = useState<string[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetchTextContent(engraving.meiSha256).then(
      (text) => !cancelled && setLines(text.replace(/\n$/, "").split("\n")),
      () => !cancelled && setError(true),
    );
    return () => {
      cancelled = true;
    };
  }, [engraving.meiSha256]);
  if (error) return <div className="text-view"><p>The MEI file couldn't be loaded.</p></div>;
  if (!lines) return <div className="text-view"><p>Loading the MEI file…</p></div>;
  return <MeiWorkspace lines={lines} engraving={engraving} />;
}

// The file and, beside it or below it, the score engraved from it: a click on either shows the same element in both.
function MeiWorkspace({ lines, engraving }: { lines: string[]; engraving: Engraving }) {
  const index = useMemo(() => indexMei(lines), [lines]);
  const [selection, setSelection] = useState<Selection | null>(null);
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
    setSelection({ line, from });
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
      <div className={score === "shown" ? "mei-split" : "mei-split alone"}>
        <MeiLines lines={lines} matches={matches} current={current} selection={selection} onSelect={(line) => select(line, "file")} />
        {score === "shown" && <MeiScore index={index} engraving={engraving} selection={selection} onSelect={(line) => select(line, "score")} />}
      </div>
    </div>
  );
}

function MeiLines({
  lines,
  matches,
  current,
  selection,
  onSelect,
}: {
  lines: string[];
  matches: Match[];
  current: number;
  selection: Selection | null;
  onSelect: (line: number) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);
  const [height, setHeight] = useState(600);

  useEffect(() => {
    const el = scroller.current!;
    const onScroll = () => setTop(el.scrollTop);
    const observer = new ResizeObserver(() => setHeight(el.clientHeight));
    observer.observe(el);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  // A line chosen elsewhere is brought to the middle of the view.
  useEffect(() => {
    if (!selection || selection.from === "file") return;
    const el = scroller.current!;
    el.scrollTop = Math.max(0, (selection.line + 0.5) * LINE_HEIGHT - el.clientHeight / 2);
  }, [selection]);

  const first = Math.max(0, Math.floor(top / LINE_HEIGHT) - OVERSCAN);
  const last = Math.min(lines.length, Math.ceil((top + height) / LINE_HEIGHT) + OVERSCAN);
  const longest = useMemo(() => lines.reduce((n, l) => Math.max(n, l.length), 0), [lines]);
  const gutter = String(lines.length).length;
  const byLine = useMemo(() => {
    const map = new Map<number, { start: number; end: number; current: boolean }[]>();
    matches.forEach((m, i) => map.set(m.line, [...(map.get(m.line) ?? []), { start: m.start, end: m.end, current: i === current }]));
    return map;
  }, [matches, current]);

  return (
    <div className="mei-scroller" ref={scroller}>
      <div className="mei-lines" style={{ height: lines.length * LINE_HEIGHT, width: `calc(${longest + gutter + 3}ch + 24px)` }}>
        {lines.slice(first, last).map((line, k) => {
          const i = first + k;
          return (
            <div
              key={i}
              className={i === selection?.line ? "mei-line selected" : "mei-line"}
              style={{ top: i * LINE_HEIGHT }}
              onClick={() => {
                if (!window.getSelection()?.isCollapsed) return; // selecting text, not a line
                onSelect(i);
              }}
            >
              <span className="mei-number" style={{ width: `${gutter}ch` }}>
                {i + 1}
              </span>
              {marked(highlight(line), byLine.get(i) ?? []).map((t, j) => (
                <span key={j} className={`mei-${t.kind}${t.mark ? ` mei-${t.mark}` : ""}`}>
                  {t.text}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// The score engraved from the file, as the PDF has it. A click on an element goes to its line: the innermost element
// of the file it is part of (a stem is its note's, a staff line its measure's). The chosen line's element, the
// innermost one the score shows, is marked and brought to the middle of the view.
function MeiScore({ index, engraving, selection, onSelect }: { index: MeiIndex; engraving: Engraving; selection: Selection | null; onSelect: (line: number) => void }) {
  const [pages, setPages] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    engravedPages(engraving).then(
      (svgs) => !cancelled && setPages(svgs),
      (err) => !cancelled && setError(`The score can't be engraved: ${err instanceof Error ? err.message : err}`),
    );
    return () => {
      cancelled = true;
    };
  }, [engraving.meiSha256, JSON.stringify(engraving.config)]);

  useEffect(() => {
    const el = scroller.current;
    if (!el || !pages) return;
    for (const marked of el.querySelectorAll(".mei-selected")) marked.classList.remove("mei-selected");
    if (!selection) return;
    const shown = shownElements(el, index, selection.line);
    for (const e of shown) e.classList.add("mei-selected");
    if (shown.length === 0 || selection.from === "score") return;
    const box = el.getBoundingClientRect();
    const rects = shown.map((e) => e.getBoundingClientRect());
    const middle = (Math.min(...rects.map((r) => r.top)) + Math.max(...rects.map((r) => r.bottom))) / 2;
    const centre = (Math.min(...rects.map((r) => r.left)) + Math.max(...rects.map((r) => r.right))) / 2;
    el.scrollTop += middle - (box.top + el.clientHeight / 2);
    el.scrollLeft += centre - (box.left + el.clientWidth / 2);
  }, [pages, selection, index]);

  function clicked(target: EventTarget) {
    let g = target instanceof Element ? target.closest("g[id]") : null;
    while (g && !g.classList.contains("system")) {
      const line = lineOfId(index, g.id);
      if (line !== null) return onSelect(line);
      g = g.parentElement?.closest("g[id]") ?? null;
    }
  }

  return (
    <div className="mei-score" ref={scroller}>
      {error ? (
        <p className="mei-score-note">{error}</p>
      ) : !pages ? (
        <p className="mei-score-note">Engraving the score…</p>
      ) : (
        <div className="mei-pages" onClick={(e) => clicked(e.target)}>
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

// The elements of the score that show a line: those of the innermost element it is part of that the score has (a
// measure divided at a system break, with the original's breaks, is several). Milestones (a piece's start and end)
// are never drawn.
function shownElements(root: HTMLElement, index: MeiIndex, line: number): Element[] {
  for (const { line: start, id } of elementsAt(index, line)) {
    if (!id) continue;
    const found = [...root.querySelectorAll(`g[id="${CSS.escape(id)}"], g.measure[id^="${CSS.escape(id.replace(/-s\d+t\d+$/, ""))}-s"]`)].filter(
      (e) => !e.classList.contains("pageMilestone") && lineOfId(index, e.id) === start,
    );
    if (found.length) return found;
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
