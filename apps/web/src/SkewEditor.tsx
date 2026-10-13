// The editor of a WIP `fix_skew` stage (DESIGN.md §6): one page at a time, its lines in red over it. Two modes, by
// a toggle. Hand: dragging pans, tapping a line selects it, its end handles can be dragged, and Delete deletes it.
// Drawing: click, move, click with a mouse (the line follows the pointer); tap, tap on touch (the first tap leaves
// a dot). Zooming and panning work as in every editor (pageEditor.tsx). Each change is saved at once. Undo and redo
// go through a page's changes since the editor was opened (§5.4).

import type { SkewLine } from "@score3ly/imaging";
import { useEffect, useRef, useState } from "react";
import { fetchJsonContent, putContent, recordOutputs, type Project } from "./api";
import { linesBytes } from "./finishFixSkew";
import { lineThrough, type PageLines } from "./fixSkew";
import { canRedo, canUndo, pushState, redo, startHistory, undo, type History } from "./history";
import { HandIcon, LineIcon, TrashIcon } from "./icons";
import {
  ModeToggle,
  PageCanvas,
  PageNav,
  undoKey,
  UndoRedo,
  usePageImage,
  useSaver,
  useViewport,
  ZoomTools,
  type PageNavigation,
  type Point,
} from "./pageEditor";
import { pageImage } from "./pageImages";
import type { PageRecipe } from "./rasterize";
import { angleLabel } from "./skewAnalysis";

export type EditorPage = { page: number; recipe: PageRecipe; linesSha256: string; item: string; parentId: string };

type Mode = "hand" | "draw";

const MODES = [
  { value: "hand" as const, label: "Hand", title: "Hand: pan, select lines, move their ends", icon: <HandIcon /> },
  { value: "draw" as const, label: "Draw", title: "Draw: click or tap at both ends of a line", icon: <LineIcon /> },
];

// What a line is aimed at, in screen px: a tap this close to a line selects it, this close to a handle grabs it.
const LINE_REACH = 14;
const HANDLE_REACH = 26;

// Lines saved on this device and not yet in the pipeline the app has, by stage and item.
const saved = new Map<string, SkewLine[]>();

// Each page's changes while the editor is open, by item: a page keeps its own when the user flips to another.
type Histories = Map<string, History<SkewLine[]>>;

export function SkewEditor({
  project,
  stageId,
  pages,
  onEdited,
}: {
  project: Project;
  stageId: string;
  pages: EditorPage[];
  onEdited?: () => void; // a page was saved: the pipeline can be fetched again
}) {
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("hand");
  const histories = useRef<Histories>(new Map());
  const page = pages[Math.min(index, pages.length - 1)];
  const go = (i: number) => setIndex(Math.max(0, Math.min(pages.length - 1, i)));
  return (
    <PageEditor
      key={page.item}
      project={project}
      stageId={stageId}
      page={page}
      mode={mode}
      setMode={setMode}
      histories={histories.current}
      nav={{ index, count: pages.length, go }}
      onEdited={onEdited}
    />
  );
}

// What a pointer can take hold of: an end of the selected line.
type Grab = { line: number; end: 0 | 1 };

function PageEditor({
  project,
  stageId,
  page,
  mode,
  setMode,
  histories,
  nav,
  onEdited,
}: {
  project: Project;
  stageId: string;
  page: EditorPage;
  mode: Mode;
  setMode: (mode: Mode) => void;
  histories: Histories;
  nav: PageNavigation;
  onEdited?: () => void;
}) {
  const { image, error: imageError } = usePageImage(async () => (await pageImage(page.recipe)).png, page.item);
  const [lines, setLinesState] = useState<SkewLine[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [anchor, setAnchor] = useState<Point | null>(null); // drawing: the first end, in image px
  const [hover, setHover] = useState<Point | null>(null); // drawing with a mouse: where the pointer is
  const linesRef = useRef(lines); // the latest, for a drag
  const { save, error: saveError } = useSaver(saved, `${stageId}/${page.item}`, async (next: SkewLine[]) => {
    const sha256 = await putContent(linesBytes({ lines: next }), "application/json");
    await recordOutputs(project, stageId, [
      { item: page.item, type: "lines", contentSha256: sha256, parentOutputId: page.parentId, inputIds: [page.parentId] },
    ]);
  }, onEdited);

  const setLines = (next: SkewLine[]) => {
    linesRef.current = next;
    setLinesState(next);
  };

  useEffect(() => {
    let cancelled = false;
    const local = saved.get(`${stageId}/${page.item}`);
    (local ? Promise.resolve(local) : fetchJsonContent(page.linesSha256).then((json) => (json as PageLines).lines)).then(
      (found) => {
        if (cancelled) return;
        if (!histories.has(page.item)) histories.set(page.item, startHistory(found));
        setLines(found);
      },
      () => !cancelled && setLoadError("The lines couldn't be loaded."),
    );
    return () => {
      cancelled = true;
    };
  }, [page.item]);

  // A line's ends in image px.
  function ends(line: SkewLine): [Point, Point] {
    const { width, height } = image!;
    return [
      { x: line.x0 * width, y: line.y0 * height },
      { x: line.x1 * width, y: line.y1 * height },
    ];
  }

  // The line nearest a point, if it is close enough (in screen px).
  function lineAt(q: Point, scale: number): number | null {
    let best: number | null = null;
    let bestDist = LINE_REACH;
    (linesRef.current ?? []).forEach((line, i) => {
      const [a, b] = ends(line);
      const dist = segmentDistance(q, a, b) * scale;
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  }

  // A change by the user: a new state in the page's history, saved.
  function change(next: SkewLine[]) {
    const history = histories.get(page.item);
    if (!history || next === history.present) return; // e.g. a handle that was grabbed and couldn't move
    histories.set(page.item, pushState(history, next));
    setLines(next);
    save(next);
  }

  // One step back or forward in the page's history, saved like any change. A line that was started is dropped
  // first, as the last thing done.
  function step(move: typeof undo) {
    const history = histories.get(page.item);
    if (!history || viewport.dragging()) return;
    if (anchor) {
      setAnchor(null);
      if (move === undo) return;
    }
    const next = move(history);
    if (next === history) return;
    histories.set(page.item, next);
    setSelected(null);
    setLines(next.present);
    save(next.present);
  }

  function deleteSelected() {
    if (selected === null || !lines) return;
    change(lines.filter((_, i) => i !== selected));
    setSelected(null);
  }

  const viewport = useViewport<Grab>(image, {
    // The selected line's end near the pointer.
    grab: (q, scale) => {
      const current = linesRef.current;
      if (mode !== "hand" || selected === null || !current?.[selected]) return null;
      let best: Grab | null = null;
      let bestDist = HANDLE_REACH;
      ends(current[selected]).forEach((end, e) => {
        const dist = Math.hypot(end.x - q.x, end.y - q.y) * scale;
        if (dist < bestDist) {
          bestDist = dist;
          best = { line: selected, end: e as 0 | 1 };
        }
      });
      return best;
    },
    // Moves the end. A line that would be too steep stays as it was. The ends come back ordered left to right, so
    // the end being dragged may now be the other one.
    drag: (grabbed, q) => {
      const current = linesRef.current;
      if (!current?.[grabbed.line] || !image) return;
      const [a, b] = ends(current[grabbed.line]);
      const moved = lineThrough(grabbed.end === 0 ? q : a, grabbed.end === 0 ? b : q, image.width, image.height);
      if (!moved) return;
      setLines(current.map((line, j) => (j === grabbed.line ? moved : line)));
      const [m0, m1] = ends(moved);
      grabbed.end = Math.hypot(m0.x - q.x, m0.y - q.y) <= Math.hypot(m1.x - q.x, m1.y - q.y) ? 0 : 1;
    },
    release: () => linesRef.current && change(linesRef.current),
    tap: (q, scale) => {
      if (!image || !lines) return;
      if (mode === "hand") {
        setSelected(lineAt(q, scale));
        return;
      }
      if (!anchor) {
        setAnchor(q);
        return;
      }
      // A second end straight above or below the first (a slip) is ignored: the line waits for another.
      const line = lineThrough(anchor, q, image.width, image.height);
      if (!line) return;
      setAnchor(null);
      change([...lines, line]);
    },
    hover: (q) => setHover(mode === "draw" ? q : null),
  });

  function onKeyDown(event: React.KeyboardEvent) {
    if (undoKey(event, () => step(undo), () => step(redo))) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteSelected();
    } else if (event.key === "Escape") {
      setAnchor(null);
      setSelected(null);
    } else if (event.key === "ArrowLeft" && nav.index > 0) {
      nav.go(nav.index - 1);
    } else if (event.key === "ArrowRight" && nav.index < nav.count - 1) {
      nav.go(nav.index + 1);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setSelected(null);
    setAnchor(null);
    setHover(null);
  }

  const s = viewport.scale;
  const selectedLine = selected === null ? null : lines?.[selected];
  const history = histories.get(page.item);

  return (
    <div className="page-editor" onKeyDown={onKeyDown}>
      {/* After a button, the keys still go to the editor (a disabled button would leave the focus nowhere). */}
      <div className="editor-toolbar" onClick={viewport.focus}>
        <PageNav nav={nav} />
        <ModeToggle modes={MODES} mode={mode} onChange={switchMode} />
        <ZoomTools viewport={viewport}>
          <button
            type="button"
            className="icon-button"
            aria-label="Delete line"
            title="Delete the selected line"
            disabled={selected === null}
            onClick={deleteSelected}
          >
            <TrashIcon />
          </button>
        </ZoomTools>
        <UndoRedo
          canUndo={anchor !== null || (history !== undefined && canUndo(history))}
          canRedo={history !== undefined && canRedo(history)}
          onUndo={() => step(undo)}
          onRedo={() => step(redo)}
        />
      </div>

      <PageCanvas
        viewport={viewport}
        image={image}
        className={mode}
        label={`Page ${page.page}: lines that should be horizontal`}
        error={imageError ?? loadError ?? saveError}
      >
        {image && lines && (
          <>
            {lines.map((line, i) => {
              const [a, b] = ends(line);
              return (
                <g key={i} className={i === selected ? "skew-line selected" : "skew-line"}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                  <text x={a.x} y={a.y - 8 / s} fontSize={12 / s}>
                    {angleLabel(line.angle)}
                  </text>
                </g>
              );
            })}
            {selectedLine &&
              ends(selectedLine).map((end, e) => (
                <circle key={e} className="editor-handle" cx={end.x} cy={end.y} r={9 / s} strokeWidth={2 / s} />
              ))}
            {anchor && hover && <line className="skew-rubber" x1={anchor.x} y1={anchor.y} x2={hover.x} y2={hover.y} />}
            {anchor && <circle className="editor-anchor" cx={anchor.x} cy={anchor.y} r={5 / s} />}
          </>
        )}
      </PageCanvas>
    </div>
  );
}

// The distance from a point to a segment.
function segmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
