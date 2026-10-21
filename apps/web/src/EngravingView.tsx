// `engrave`'s artifacts (DESIGN.md §6, `engrave`): the MEI file, indented and highlighted, with search and a way to go
// to a piece, a page, a system or a measure (a file of thousands of lines: only the lines in view are drawn); and the
// engraving, Verovio's pages, made when they are shown.

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchTextContent } from "./api";
import { Filmstrip } from "./ArtifactView";
import { engravedPages } from "./engraving";
import { Picker } from "./fieldList";
import { ChevronDownIcon, ChevronUpIcon, TopIcon } from "./icons";
import { findMeasure, highlight, indexMei, marked, pieceAt, search, type MeiIndex } from "./meiView";
import type { Artifact } from "./pipeline";

type Engraving = NonNullable<Artifact["engraving"]>;

export function EngravingView({ artifact }: { artifact: Artifact }) {
  const engraving = artifact.engraving!;
  return engraving.view === "mei" ? <MeiView sha256={engraving.meiSha256} /> : <EngravedPages engraving={engraving} />;
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

function MeiView({ sha256 }: { sha256: string }) {
  const [lines, setLines] = useState<string[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetchTextContent(sha256).then(
      (text) => !cancelled && setLines(text.replace(/\n$/, "").split("\n")),
      () => !cancelled && setError(true),
    );
    return () => {
      cancelled = true;
    };
  }, [sha256]);
  if (error) return <div className="text-view"><p>The MEI file couldn't be loaded.</p></div>;
  if (!lines) return <div className="text-view"><p>Loading the MEI file…</p></div>;
  return <MeiLines lines={lines} />;
}

function MeiLines({ lines }: { lines: string[] }) {
  const index = useMemo(() => indexMei(lines), [lines]);
  const scroller = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);
  const [height, setHeight] = useState(600);
  const [query, setQuery] = useState("");
  const matches = useMemo(() => search(lines, query.trim()), [lines, query]);
  const [current, setCurrent] = useState(0);
  const [shown, setShown] = useState(false); // whether the current match has been gone to
  const [target, setTarget] = useState<number | null>(null); // a line gone to, shown for a moment
  const [problem, setProblem] = useState<string | null>(null);

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

  // A line brought to about a third of the view, and marked for a moment.
  function goTo(line: number) {
    scroller.current!.scrollTop = Math.max(0, line * LINE_HEIGHT - height / 3);
    setTarget(line);
    setProblem(null);
  }
  useEffect(() => {
    if (target === null) return;
    const timer = setTimeout(() => setTarget(null), 1500);
    return () => clearTimeout(timer);
  }, [target]);

  // To the next or previous match; the first time, to the first.
  function step(by: number) {
    if (matches.length === 0) return;
    const next = shown ? (current + by + matches.length) % matches.length : current;
    setCurrent(next);
    setShown(true);
    goTo(matches[next].line);
  }
  useEffect(() => {
    setCurrent(0);
    setShown(false);
  }, [query]);

  const first = Math.max(0, Math.floor(top / LINE_HEIGHT) - OVERSCAN);
  const last = Math.min(lines.length, Math.ceil((top + height) / LINE_HEIGHT) + OVERSCAN);
  const longest = useMemo(() => lines.reduce((n, l) => Math.max(n, l.length), 0), [lines]);
  const gutter = String(lines.length).length;
  const byLine = useMemo(() => {
    const map = new Map<number, { start: number; end: number; current: boolean }[]>();
    matches.forEach((m, i) => map.set(m.line, [...(map.get(m.line) ?? []), { start: m.start, end: m.end, current: i === current }]));
    return map;
  }, [matches, current]);
  const pieceInView = pieceAt(index, Math.floor((top + height / 3) / LINE_HEIGHT));

  return (
    <div className="mei-view">
      <div className="editor-toolbar">
        <div className="editor-tools mei-search">
          <input
            type="search"
            className="mei-query"
            placeholder="Search"
            aria-label="Search the MEI file"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                step(e.shiftKey ? -1 : 1);
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
        </div>
        <GoTo index={index} piece={pieceInView} goTo={goTo} onProblem={setProblem} />
        <button type="button" className="icon-button" aria-label="Back to the top" title="Back to the top" onClick={() => goTo(0)}>
          <TopIcon />
        </button>
      </div>
      {problem && <p className="editor-hint mei-problem">{problem}</p>}
      <div className="mei-scroller" ref={scroller}>
        <div className="mei-lines" style={{ height: lines.length * LINE_HEIGHT, width: `calc(${longest + gutter + 3}ch + 24px)` }}>
          {lines.slice(first, last).map((line, k) => {
            const i = first + k;
            return (
              <div key={i} className={i === target ? "mei-line target" : "mei-line"} style={{ top: i * LINE_HEIGHT }}>
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
    </div>
  );
}

// Going to a piece (a picker, when there are several), or to a page, a system, or a measure of the piece in view.
function GoTo({ index, piece, goTo, onProblem }: { index: MeiIndex; piece: number; goTo: (line: number) => void; onProblem: (p: string | null) => void }) {
  const [kind, setKind] = useState<"measure" | "system" | "page">("measure");
  const [number, setNumber] = useState("");
  const KINDS = { measure: "Measure", system: "System", page: "Page" } as const;
  const pieceName = (p: MeiIndex["pieces"][number]) => (p.label ? `${p.n}. ${p.label}` : `Piece ${p.n}`);
  function go() {
    const n = Number(number);
    if (!Number.isInteger(n)) return onProblem("Enter a number.");
    const line = kind === "measure" ? findMeasure(index, piece, n) : kind === "system" ? (index.systems.get(n) ?? null) : (index.pages.get(n) ?? null);
    if (line === null) {
      const where = kind === "measure" && index.pieces.length > 1 ? " in this piece" : "";
      return onProblem(`There is no ${KINDS[kind].toLowerCase()} ${n}${where}.`);
    }
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
          label="Go to a piece"
          className="mei-piece"
          groups={[index.pieces.map((p) => ({ label: pieceName(p), current: p.n === piece, onSelect: () => goTo(p.line) }))]}
        />
      )}
      <Picker
        value={KINDS[kind]}
        label="Go to a measure, a system or a page"
        groups={[(Object.keys(KINDS) as (keyof typeof KINDS)[]).map((k) => ({ label: KINDS[k], current: k === kind, onSelect: () => setKind(k) }))]}
      />
      <input
        className="mei-number-input"
        inputMode="numeric"
        aria-label={`${KINDS[kind]} number`}
        placeholder="No."
        value={number}
        onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))}
      />
      <button type="submit" className="button-secondary mei-go" disabled={number === ""}>
        Go
      </button>
    </form>
  );
}
