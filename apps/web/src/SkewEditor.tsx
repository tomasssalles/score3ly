// The editor of a WIP `fix_skew` stage (DESIGN.md §6): one page at a time, its lines in red over it. Two modes, by
// a toggle. Hand: dragging pans, tapping a line selects it, its end handles can be dragged, and Delete deletes it.
// Drawing: click, move, click with a mouse (the line follows the pointer); tap, tap on touch (the first tap leaves
// a dot). Never press and drag: on a phone the user zooms in close for each end, and zooms out and pans in between.
// Two fingers always pan and zoom; so do Ctrl + wheel and the buttons. Each change is saved at once.

import type { SkewLine } from "@score3ly/imaging";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { fetchJsonContent, putContent, recordOutputs, type Project } from "./api";
import { linesBytes } from "./finishFixSkew";
import { lineThrough, type PageLines } from "./fixSkew";
import {
  CollapseIcon,
  ExpandIcon,
  FitIcon,
  HandIcon,
  LineIcon,
  TrashIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "./icons";
import { pageImage, pngSize } from "./pageImages";
import type { PageRecipe } from "./rasterize";
import { angleLabel } from "./skewAnalysis";

export type EditorPage = { page: number; recipe: PageRecipe; linesSha256: string; item: string; parentId: string };

type Point = { x: number; y: number };
type View = { scale: number; x: number; y: number }; // screen px per image px, and where the image's corner is
type Mode = "hand" | "draw";

// What a line is aimed at, in screen px: a tap this close to a line selects it, this close to a handle grabs it.
const LINE_REACH = 14;
const HANDLE_REACH = 26;
// A pointer that moves less than this between down and up tapped; more, it dragged.
const TAP_SLOP = { mouse: 4, touch: 10 };
const MAX_SCALE = 8;

// Lines saved on this device and not yet in the pipeline the app has, by stage and item: the editor may be closed
// and opened again before the pipeline is fetched again.
const saved = new Map<string, SkewLine[]>();

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
      nav={{ index, count: pages.length, go }}
      onEdited={onEdited}
    />
  );
}

type Gesture =
  | { kind: "none" }
  // One pointer down, not yet known whether it taps or drags.
  | { kind: "pending"; id: number; start: Point; last: Point; handle: { line: number; end: 0 | 1 } | null }
  | { kind: "pan"; id: number; last: Point }
  | { kind: "handle"; id: number; line: number; end: 0 | 1 }
  | { kind: "pinch"; mid: Point; dist: number }
  // A finger left over from a pinch: does nothing until it lifts.
  | { kind: "idle" };

function PageEditor({
  project,
  stageId,
  page,
  mode,
  setMode,
  nav,
  onEdited,
}: {
  project: Project;
  stageId: string;
  page: EditorPage;
  mode: Mode;
  setMode: (mode: Mode) => void;
  nav: { index: number; count: number; go: (i: number) => void };
  onEdited?: () => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<{ url: string; width: number; height: number } | null>(null);
  const [lines, setLinesState] = useState<SkewLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setViewState] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [selected, setSelected] = useState<number | null>(null);
  const [anchor, setAnchor] = useState<Point | null>(null); // drawing: the first end, in image px
  const [hover, setHover] = useState<Point | null>(null); // drawing with a mouse: where the pointer is
  // The latest values, for the pointer handlers.
  const viewRef = useRef(view);
  const linesRef = useRef(lines);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture>({ kind: "none" });
  const fitScale = useRef(1);
  const saveChain = useRef(Promise.resolve());
  const savedKey = `${stageId}/${page.item}`;

  const setView = (next: View) => {
    viewRef.current = next;
    setViewState(next);
  };
  const setLines = (next: SkewLine[]) => {
    linesRef.current = next;
    setLinesState(next);
  };

  // The page image and its lines.
  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    pageImage(page.recipe)
      .then(async ({ png }) => {
        const size = await pngSize(png);
        if (cancelled) return;
        url = URL.createObjectURL(png);
        setImage({ url, ...size });
      })
      .catch((err) => !cancelled && setError(`This page can't be drawn: ${err instanceof Error ? err.message : err}`));
    const local = saved.get(savedKey);
    (local ? Promise.resolve(local) : fetchJsonContent(page.linesSha256).then((json) => (json as PageLines).lines)).then(
      (found) => !cancelled && setLines(found),
      () => !cancelled && setError("The lines couldn't be loaded."),
    );
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [page.item]);

  // The whole page in view, centred.
  function fit() {
    const el = viewport.current;
    if (!el || !image) return;
    const scale = Math.min(el.clientWidth / image.width, el.clientHeight / image.height) * 0.96;
    fitScale.current = scale;
    setView({ scale, x: (el.clientWidth - image.width * scale) / 2, y: (el.clientHeight - image.height * scale) / 2 });
  }
  useLayoutEffect(fit, [image]);

  // Zooms by `factor` around a point of the viewport, which stays where it is.
  function zoomAt(at: Point, factor: number) {
    const v = viewRef.current;
    const scale = Math.max(fitScale.current * 0.5, Math.min(MAX_SCALE, v.scale * factor));
    const k = scale / v.scale;
    setView({ scale, x: at.x - (at.x - v.x) * k, y: at.y - (at.y - v.y) * k });
  }

  function panBy(dx: number, dy: number) {
    const v = viewRef.current;
    setView({ ...v, x: v.x + dx, y: v.y + dy });
  }

  function center(): Point {
    const el = viewport.current!;
    return { x: el.clientWidth / 2, y: el.clientHeight / 2 };
  }

  // Ctrl + wheel (and a trackpad's pinch) zooms; the wheel alone pans. The listener can't be passive.
  useEffect(() => {
    const el = viewport.current!;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el.clientHeight : 1;
      // At most about 1.6 times per event: a wheel's notch sends 100 or more, a trackpad's pinch a few at a time.
      if (event.ctrlKey) zoomAt(local(event), Math.exp(-Math.max(-50, Math.min(50, event.deltaY * unit)) * 0.01));
      else panBy(-event.deltaX * unit, -event.deltaY * unit);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function local(event: { clientX: number; clientY: number }): Point {
    const rect = viewport.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function toImage(p: Point): Point {
    const v = viewRef.current;
    return { x: (p.x - v.x) / v.scale, y: (p.y - v.y) / v.scale };
  }

  // A line's ends in image px.
  function ends(line: SkewLine): [Point, Point] {
    const { width, height } = image!;
    return [
      { x: line.x0 * width, y: line.y0 * height },
      { x: line.x1 * width, y: line.y1 * height },
    ];
  }

  // The selected line's handle near a point of the viewport, if any.
  function handleAt(p: Point): { line: number; end: 0 | 1 } | null {
    const i = selected;
    const current = linesRef.current;
    if (i === null || !current?.[i]) return null;
    const v = viewRef.current;
    const q = toImage(p);
    let best: { line: number; end: 0 | 1 } | null = null;
    let bestDist = HANDLE_REACH;
    ends(current[i]).forEach((end, e) => {
      const dist = Math.hypot(end.x - q.x, end.y - q.y) * v.scale;
      if (dist < bestDist) {
        bestDist = dist;
        best = { line: i, end: e as 0 | 1 };
      }
    });
    return best;
  }

  // The line nearest a point of the viewport, if it is close enough.
  function lineAt(p: Point): number | null {
    const q = toImage(p);
    const v = viewRef.current;
    let best: number | null = null;
    let bestDist = LINE_REACH;
    (linesRef.current ?? []).forEach((line, i) => {
      const [a, b] = ends(line);
      const dist = segmentDistance(q, a, b) * v.scale;
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  }

  // Saves the page's lines: stored content, and the stage's output for the page (overwritten while WIP).
  function save(next: SkewLine[]) {
    setLines(next);
    saved.set(savedKey, next);
    saveChain.current = saveChain.current
      .then(async () => {
        const sha256 = await putContent(linesBytes({ lines: next }), "application/json");
        await recordOutputs(project, stageId, [
          { item: page.item, type: "lines", contentSha256: sha256, parentOutputId: page.parentId, inputIds: [page.parentId] },
        ]);
        setError(null);
        onEdited?.();
      })
      .catch((err) => setError(`Saving failed: ${err instanceof Error ? err.message : err}`));
  }

  function deleteSelected() {
    if (selected === null || !lines) return;
    save(lines.filter((_, i) => i !== selected));
    setSelected(null);
  }

  // A tap (or a click) at a point of the viewport.
  function tap(p: Point) {
    if (!image || !lines) return;
    if (mode === "hand") {
      setSelected(lineAt(p));
      return;
    }
    const q = toImage(p);
    if (!anchor) {
      setAnchor(q);
      return;
    }
    // A second end straight above or below the first (a slip) is ignored: the line waits for another.
    const line = lineThrough(anchor, q, image.width, image.height);
    if (!line) return;
    setAnchor(null);
    save([...lines, line]);
  }

  function onPointerDown(event: React.PointerEvent) {
    try {
      viewport.current!.setPointerCapture(event.pointerId);
    } catch {
      // Not a pointer the browser knows (synthetic): it still works, without capture.
    }
    viewport.current!.focus({ preventScroll: true });
    const p = local(event);
    pointers.current.set(event.pointerId, p);
    if (pointers.current.size === 2) {
      // A handle being dragged keeps where it got to.
      if (gesture.current.kind === "handle" && linesRef.current) save(linesRef.current);
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: "pinch", mid: midpoint(a, b), dist: Math.hypot(a.x - b.x, a.y - b.y) };
    } else if (pointers.current.size === 1) {
      const handle = mode === "hand" ? handleAt(p) : null;
      gesture.current = { kind: "pending", id: event.pointerId, start: p, last: p, handle };
    }
  }

  function onPointerMove(event: React.PointerEvent) {
    const p = local(event);
    if (event.pointerType === "mouse" && mode === "draw") setHover(toImage(p));
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, p);
    const g = gesture.current;
    if (g.kind === "pinch") {
      const [a, b] = [...pointers.current.values()];
      const mid = midpoint(a, b);
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (g.dist > 0) zoomAt(g.mid, dist / g.dist);
      panBy(mid.x - g.mid.x, mid.y - g.mid.y);
      gesture.current = { kind: "pinch", mid, dist };
    } else if (g.kind === "pending" && g.id === event.pointerId) {
      const slop = event.pointerType === "mouse" ? TAP_SLOP.mouse : TAP_SLOP.touch;
      if (Math.hypot(p.x - g.start.x, p.y - g.start.y) < slop) return;
      if (g.handle) {
        gesture.current = { kind: "handle", id: g.id, ...g.handle };
        moveHandle(g.handle.line, g.handle.end, p);
      } else {
        gesture.current = { kind: "pan", id: g.id, last: p };
        panBy(p.x - g.last.x, p.y - g.last.y);
      }
    } else if (g.kind === "pan" && g.id === event.pointerId) {
      panBy(p.x - g.last.x, p.y - g.last.y);
      gesture.current = { ...g, last: p };
    } else if (g.kind === "handle" && g.id === event.pointerId) {
      moveHandle(g.line, g.end, p);
    }
  }

  // Moves one end of a line to a point of the viewport. A line that would be too steep stays as it was.
  function moveHandle(i: number, end: 0 | 1, p: Point) {
    const current = linesRef.current;
    if (!current?.[i] || !image) return;
    const [a, b] = ends(current[i]);
    const moved = lineThrough(end === 0 ? toImage(p) : a, end === 0 ? b : toImage(p), image.width, image.height);
    if (!moved) return;
    // The ends come back ordered left to right: the handle being dragged may now be the other one.
    const next = current.map((line, j) => (j === i ? moved : line));
    setLines(next);
    const g = gesture.current;
    if (g.kind === "handle") {
      const q = toImage(p);
      const [m0, m1] = ends(moved);
      gesture.current = { ...g, end: Math.hypot(m0.x - q.x, m0.y - q.y) <= Math.hypot(m1.x - q.x, m1.y - q.y) ? 0 : 1 };
    }
  }

  function onPointerUp(event: React.PointerEvent, cancelled = false) {
    if (!pointers.current.delete(event.pointerId)) return;
    const g = gesture.current;
    if (g.kind === "pinch") {
      gesture.current = pointers.current.size > 0 ? { kind: "idle" } : { kind: "none" };
      return;
    }
    if (pointers.current.size === 0) gesture.current = { kind: "none" };
    if (g.kind === "pending" && g.id === event.pointerId && !cancelled) tap(local(event));
    if (g.kind === "handle" && g.id === event.pointerId && linesRef.current) save(linesRef.current);
  }

  function onKeyDown(event: React.KeyboardEvent) {
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

  const s = view.scale;
  const selectedLine = selected === null ? null : lines?.[selected];

  return (
    <div className="skew-editor" onKeyDown={onKeyDown}>
      <div className="skew-toolbar">
        <div className="skew-tools">
          <button
            type="button"
            className="icon-button"
            aria-label="Previous page"
            disabled={nav.index === 0}
            onClick={() => nav.go(nav.index - 1)}
          >
            <CollapseIcon />
          </button>
          <span className="skew-page">
            Page {nav.index + 1}/{nav.count}
          </span>
          <button
            type="button"
            className="icon-button"
            aria-label="Next page"
            disabled={nav.index === nav.count - 1}
            onClick={() => nav.go(nav.index + 1)}
          >
            <ExpandIcon />
          </button>
        </div>
        <div className="skew-tools" role="radiogroup" aria-label="Mode">
          <button
            type="button"
            role="radio"
            aria-checked={mode === "hand"}
            className="skew-mode"
            aria-label="Hand"
            title="Hand: pan, select lines, move their ends"
            onClick={() => switchMode("hand")}
          >
            <HandIcon />
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === "draw"}
            className="skew-mode"
            aria-label="Draw"
            title="Draw: click or tap at both ends of a line"
            onClick={() => switchMode("draw")}
          >
            <LineIcon />
          </button>
        </div>
        <div className="skew-tools">
          <button type="button" className="icon-button" aria-label="Zoom out" onClick={() => zoomAt(center(), 1 / 1.5)}>
            <ZoomOutIcon />
          </button>
          <button type="button" className="icon-button" aria-label="Zoom in" onClick={() => zoomAt(center(), 1.5)}>
            <ZoomInIcon />
          </button>
          <button type="button" className="icon-button" aria-label="Whole page" onClick={fit}>
            <FitIcon />
          </button>
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
        </div>
      </div>

      <div
        ref={viewport}
        className={`skew-viewport ${mode}`}
        tabIndex={0}
        aria-label={`Page ${page.page}: lines that should be horizontal`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => onPointerUp(e)}
        onPointerCancel={(e) => onPointerUp(e, true)}
        onPointerLeave={() => setHover(null)}
      >
        {image && lines ? (
          <div
            className="skew-content"
            style={{
              width: image.width,
              height: image.height,
              transform: `translate(${view.x}px, ${view.y}px) scale(${s})`,
            }}
          >
            <img src={image.url} alt={`Page ${page.page}`} draggable={false} />
            <svg viewBox={`0 0 ${image.width} ${image.height}`} width={image.width} height={image.height} aria-hidden="true">
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
                  <circle key={e} className="skew-handle" cx={end.x} cy={end.y} r={9 / s} strokeWidth={2 / s} />
                ))}
              {anchor && hover && (
                <line className="skew-rubber" x1={anchor.x} y1={anchor.y} x2={hover.x} y2={hover.y} />
              )}
              {anchor && <circle className="skew-anchor" cx={anchor.x} cy={anchor.y} r={5 / s} />}
            </svg>
          </div>
        ) : (
          <div className="page-placeholder">{error ?? "Drawing the page…"}</div>
        )}
        {error && image && <p className="skew-error">{error}</p>}
      </div>
    </div>
  );
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// The distance from a point to a segment.
function segmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
